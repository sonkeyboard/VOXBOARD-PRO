
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { SoundSlot } from '../types';

interface AudioEditorProps {
  slot: SoundSlot;
  audioBuffer: AudioBuffer | null;
  currentTime: number;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onUpdate: (updates: Partial<SoundSlot>) => void;
  onSeek: (time: number, resumeAfterSeek?: boolean) => void;
  onClose: () => void;
}

export const AudioEditor: React.FC<AudioEditorProps> = ({ 
  slot, 
  audioBuffer, 
  currentTime, 
  isPlaying,
  onTogglePlay,
  onUpdate, 
  onSeek, 
  onClose 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  
  const [localTrim, setLocalTrim] = useState({ 
    start: slot.trimStart, 
    end: slot.trimEnd || (audioBuffer?.duration || 0) 
  });
  const [localFades, setLocalFades] = useState({ in: slot.fadeIn, out: slot.fadeOut });
  const [draggingHandle, setDraggingHandle] = useState<'start' | 'end' | 'fadeIn' | 'fadeOut' | 'playhead' | 'v-zoom' | 'nav-y' | null>(null);
  const [hoveredHandle, setHoveredHandle] = useState<'start' | 'end' | 'fadeIn' | 'fadeOut' | 'playhead' | null>(null);

  const [zoom, setZoom] = useState(1);
  const [vZoom, setVZoom] = useState(1);
  const [scrollPos, setScrollPos] = useState(0);
  const [navYOffset, setNavYOffset] = useState(0);

  const duration = audioBuffer?.duration || 1;
  const visibleDuration = duration / zoom;
  
  const viewStartTime = scrollPos * (duration - visibleDuration);
  const viewEndTime = viewStartTime + visibleDuration;

  // Jump Functions
  const jumpToStart = () => {
    setScrollPos(0);
    onSeek(0, isPlaying);
  };

  const jumpToEnd = () => {
    setScrollPos(1);
    onSeek(duration, isPlaying);
  };

  // Zoom at Playhead logic
  useEffect(() => {
    if (zoom <= 1) {
      setScrollPos(0);
      return;
    }
    const halfVisible = visibleDuration / 2;
    const targetStart = currentTime - halfVisible;
    const maxStart = duration - visibleDuration;
    const clampedStart = Math.max(0, Math.min(maxStart, targetStart));
    
    if (maxStart > 0) {
      setScrollPos(clampedStart / maxStart);
    }
  }, [zoom, duration, visibleDuration]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        onTogglePlay();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onTogglePlay]);

  useEffect(() => {
    if (!canvasRef.current || !audioBuffer) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;
    
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const data = audioBuffer.getChannelData(0);
    const centerY = height / 2;
    const amp = (height / 2) * vZoom;

    ctx.clearRect(0, 0, width, height);
    
    const timeToX = (time: number) => {
      return ((time - viewStartTime) / visibleDuration) * width;
    };

    // --- RULER ---
    ctx.fillStyle = '#475569';
    ctx.font = 'bold 8px "JetBrains Mono", monospace';
    const interval = zoom > 80 ? 0.001 : (zoom > 40 ? 0.005 : (zoom > 20 ? 0.01 : (zoom > 10 ? 0.1 : 0.5)));
    const startMarker = Math.floor(viewStartTime / interval) * interval;
    for (let t = startMarker; t <= viewEndTime + interval; t += interval) {
      const x = timeToX(t);
      if (x < -10 || x > width + 10) continue;
      const isMajor = zoom > 30 ? (t % (interval * 10) < 0.0001) : (t % 1 === 0);
      ctx.fillRect(x, 0, 1, isMajor ? 12 : 6);
      if (isMajor) ctx.fillText(t.toFixed(4) + 's', x + 4, 2);
    }

    const drawWaveform = (timeStart: number, timeEnd: number, color: string | CanvasGradient | CanvasPattern, opacity: number = 1) => {
      const startX = Math.max(0, timeToX(timeStart));
      const endX = Math.min(width, timeToX(timeEnd));
      if (startX >= width || endX <= 0) return;

      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.fillStyle = color;

      const samplesInView = (visibleDuration / duration) * data.length;
      const samplesPerPixel = samplesInView / width;
      const viewStartSample = (viewStartTime / duration) * data.length;

      for (let side = -1; side <= 1; side += 2) {
        ctx.beginPath();
        ctx.moveTo(startX, centerY);
        for (let i = Math.floor(startX); i < Math.ceil(endX); i++) {
          let peak = 0;
          const idx = Math.floor(viewStartSample + i * samplesPerPixel);
          const endIdx = Math.floor(viewStartSample + (i + 1) * samplesPerPixel);
          for (let j = Math.max(0, idx); j < Math.min(data.length, endIdx); j++) {
            const val = Math.abs(data[j]);
            if (val > peak) peak = val;
          }
          ctx.lineTo(i, centerY - (side * peak * amp));
        }
        ctx.lineTo(endX, centerY);
        ctx.fill();
      }
      ctx.restore();
    };

    drawWaveform(viewStartTime, viewEndTime, '#1e293b', 0.4);

    const startX = timeToX(localTrim.start);
    const endX = timeToX(localTrim.end);
    const fadeInX = timeToX(localTrim.start + localFades.in);
    const fadeOutX = timeToX(localTrim.end - localFades.out);
    
    // Fades
    if (localFades.in > 0 && fadeInX > startX) {
      const gradIn = ctx.createLinearGradient(startX, 0, fadeInX, 0);
      gradIn.addColorStop(0, 'rgba(16, 185, 129, 0.4)');
      gradIn.addColorStop(1, 'rgba(16, 185, 129, 0)');
      ctx.fillStyle = gradIn;
      ctx.fillRect(startX, 0, fadeInX - startX, height);
      ctx.strokeStyle = '#10b981';
      ctx.setLineDash([5, 5]);
      ctx.beginPath(); ctx.moveTo(fadeInX, 0); ctx.lineTo(fadeInX, height); ctx.stroke();
      ctx.setLineDash([]);
    }

    if (localFades.out > 0 && endX > fadeOutX) {
      const gradOut = ctx.createLinearGradient(fadeOutX, 0, endX, 0);
      gradOut.addColorStop(0, 'rgba(245, 158, 11, 0)');
      gradOut.addColorStop(1, 'rgba(245, 158, 11, 0.4)');
      ctx.fillStyle = gradOut;
      ctx.fillRect(fadeOutX, 0, endX - fadeOutX, height);
      ctx.strokeStyle = '#f59e0b';
      ctx.setLineDash([5, 5]);
      ctx.beginPath(); ctx.moveTo(fadeOutX, 0); ctx.lineTo(fadeOutX, height); ctx.stroke();
      ctx.setLineDash([]);
    }

    const activeGradient = ctx.createLinearGradient(0, centerY - amp, 0, centerY + amp);
    activeGradient.addColorStop(0, '#2563eb');
    activeGradient.addColorStop(0.5, '#60a5fa');
    activeGradient.addColorStop(1, '#2563eb');
    drawWaveform(localTrim.start, localTrim.end, activeGradient, 1);

    ctx.fillStyle = 'rgba(2, 6, 23, 0.85)';
    if (startX > 0) ctx.fillRect(0, 0, Math.min(width, startX), height);
    if (endX < width) ctx.fillRect(Math.max(0, endX), 0, width - endX, height);

    const drawHandle = (x: number, color: string, label: string, isDragging: boolean, isHovered: boolean, type: 'top' | 'bottom') => {
      if (x < -20 || x > width + 20) return;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = (isDragging || isHovered) ? 3 : 2;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
      
      const tabH = 24;
      const y = type === 'top' ? 0 : height - tabH;
      ctx.fillStyle = color;
      if (isDragging || isHovered) { ctx.shadowBlur = 15; ctx.shadowColor = color; }
      
      if ((ctx as any).roundRect) {
        (ctx as any).roundRect(x - 20, y, 40, tabH, 6);
      } else {
        ctx.fillRect(x - 20, y, 40, tabH);
      }
      ctx.fill();
      
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, x, y + tabH / 2 + 3);
      ctx.restore();
    };

    drawHandle(startX, '#ef4444', 'IN', draggingHandle === 'start', hoveredHandle === 'start', 'bottom');
    drawHandle(endX, '#ef4444', 'OUT', draggingHandle === 'end', hoveredHandle === 'end', 'bottom');
    drawHandle(fadeInX, '#10b981', 'F-IN', draggingHandle === 'fadeIn', hoveredHandle === 'fadeIn', 'top');
    drawHandle(fadeOutX, '#f59e0b', 'F-OUT', draggingHandle === 'fadeOut', hoveredHandle === 'fadeOut', 'top');

    const playX = timeToX(currentTime);
    if (playX >= 0 && playX <= width) {
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(playX, 0); ctx.lineTo(playX, height); ctx.stroke();
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath(); ctx.moveTo(playX - 6, 0); ctx.lineTo(playX + 6, 0); ctx.lineTo(playX, 10); ctx.fill();
    }
  }, [audioBuffer, localTrim, localFades, duration, currentTime, draggingHandle, hoveredHandle, zoom, vZoom, scrollPos, viewStartTime, viewEndTime, visibleDuration]);

  const getTimeFromX = (x: number): number => {
    if (!canvasRef.current) return 0;
    const rect = canvasRef.current.getBoundingClientRect();
    return viewStartTime + ((x / rect.width) * visibleDuration);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const threshold = 20;
    const startX = ((localTrim.start - viewStartTime) / visibleDuration) * rect.width;
    const endX = ((localTrim.end - viewStartTime) / visibleDuration) * rect.width;
    const fadeInX = ((localTrim.start + localFades.in - viewStartTime) / visibleDuration) * rect.width;
    const fadeOutX = ((localTrim.end - localFades.out - viewStartTime) / visibleDuration) * rect.width;
    const playX = ((currentTime - viewStartTime) / visibleDuration) * rect.width;

    if (Math.abs(x - playX) < threshold) setDraggingHandle('playhead');
    else if (y > rect.height - 30 && Math.abs(x - startX) < threshold) setDraggingHandle('start');
    else if (y > rect.height - 30 && Math.abs(x - endX) < threshold) setDraggingHandle('end');
    else if (y < 30 && Math.abs(x - fadeInX) < threshold) setDraggingHandle('fadeIn');
    else if (y < 30 && Math.abs(x - fadeOutX) < threshold) setDraggingHandle('fadeOut');
    else {
      onSeek(getTimeFromX(x), isPlaying);
      setDraggingHandle('v-zoom');
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onTogglePlay();
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggingHandle) return;

    if (draggingHandle === 'nav-y') {
      const deltaY = (e as any).movementY;
      setNavYOffset(prev => Math.min(0, Math.max(-400, prev + deltaY)));
      return;
    }

    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const newTime = Math.max(0, Math.min(duration, getTimeFromX(x)));

    if (draggingHandle === 'playhead') onSeek(newTime, isPlaying);
    else if (draggingHandle === 'start') setLocalTrim(p => ({ ...p, start: Math.min(newTime, p.end - 0.001) }));
    else if (draggingHandle === 'end') setLocalTrim(p => ({ ...p, end: Math.max(newTime, p.start + 0.001) }));
    else if (draggingHandle === 'fadeIn') setLocalFades(p => ({ ...p, in: Math.max(0, Math.min(newTime - localTrim.start, localTrim.end - localTrim.start)) }));
    else if (draggingHandle === 'fadeOut') setLocalFades(p => ({ ...p, out: Math.max(0, Math.min(localTrim.end - newTime, localTrim.end - localTrim.start)) }));
    else if (draggingHandle === 'v-zoom') {
      const deltaY = (e as any).movementY;
      setVZoom(prev => Math.max(1, Math.min(10, prev - deltaY * 0.05)));
    }
  };

  const handleSave = () => {
    onUpdate({ trimStart: localTrim.start, trimEnd: localTrim.end, fadeIn: localFades.in, fadeOut: localFades.out });
    onClose();
  };

  return (
    <div 
      ref={editorContainerRef}
      className="bg-slate-900/98 border border-slate-700/60 rounded-3xl p-8 mb-8 animate-in zoom-in-95 fade-in duration-300 backdrop-blur-3xl shadow-2xl z-50 relative"
      onMouseMove={handleMouseMove}
      onMouseUp={() => setDraggingHandle(null)}
      onMouseLeave={() => setDraggingHandle(null)}
    >
      {/* Header section... (giữ nguyên) */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-400 flex items-center justify-center text-white shadow-lg">
            <i className="fa-solid fa-wave-square text-xl"></i>
          </div>
          <div>
            <h3 className="text-[12px] font-black text-white uppercase tracking-[0.2em] mb-0.5">Professional Waveform Editor</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-2">
              <span className="text-blue-400">{slot.name}</span>
              <span className="w-1 h-1 rounded-full bg-slate-600"></span>
              <span>{duration.toFixed(3)}s</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 bg-slate-800/50 px-6 py-2.5 rounded-2xl border border-slate-700/50 shadow-inner">
          <div className="flex flex-col items-center min-w-[120px]">
            <span className="text-[8px] font-black text-blue-400 uppercase mb-1">Zoom At Playhead {zoom.toFixed(0)}x</span>
            <input 
              type="range" 
              min="1" max="100" step="1" 
              value={zoom} 
              onChange={(e) => setZoom(parseFloat(e.target.value))} 
              className="w-32 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500" 
            />
          </div>
          <div className="w-px h-8 bg-slate-700 mx-2"></div>
          <div className="flex flex-col items-center min-w-[120px]">
            <span className="text-[8px] font-black text-emerald-400 uppercase mb-1">Amplitude {vZoom.toFixed(1)}x</span>
            <input 
              type="range" 
              min="10" max="100" step="1" 
              value={vZoom * 10} 
              onChange={(e) => setVZoom(parseFloat(e.target.value) / 10)} 
              className="w-32 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500" 
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={onTogglePlay}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-lg ${isPlaying ? 'bg-amber-500 text-white animate-pulse shadow-amber-500/30' : 'bg-blue-600 text-white hover:scale-110 shadow-blue-500/30'}`}
          >
            <i className={`fa-solid ${isPlaying ? 'fa-pause' : 'fa-play'} text-sm`}></i>
          </button>
          <button onClick={onClose} className="w-10 h-10 rounded-2xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 transition-all">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
      </div>

      <div className="relative group/canvas select-none mb-4" onDoubleClick={handleDoubleClick}>
        <div className="bg-[#020617] rounded-3xl border border-slate-800/80 overflow-hidden shadow-[inset_0_4px_20px_rgba(0,0,0,0.8)] relative">
          <canvas 
            ref={canvasRef} 
            className="w-full h-[400px] cursor-crosshair"
            onMouseDown={handleMouseDown}
          />
          
          <div className="absolute inset-x-0 bottom-4 flex justify-center pointer-events-none opacity-0 group-hover/canvas:opacity-100 transition-opacity">
            <button 
              onClick={(e) => { e.stopPropagation(); onTogglePlay(); }}
              className="pointer-events-auto bg-white/10 hover:bg-white/20 backdrop-blur-md px-6 py-2.5 rounded-full border border-white/20 text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-3 transition-all active:scale-95"
            >
              <i className={`fa-solid ${isPlaying ? 'fa-pause' : 'fa-play'}`}></i>
              {isPlaying ? 'Pause' : 'Play'}
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Bar - Repositionable Y with Jump Buttons */}
      <div 
        className="relative transition-shadow duration-200 z-30"
        style={{ transform: `translateY(${navYOffset}px)` }}
      >
        <div 
          className="absolute -top-3 left-1/2 -translate-x-1/2 w-8 h-1.5 bg-slate-600 rounded-full cursor-ns-resize hover:bg-blue-500 transition-colors flex items-center justify-center group/grip shadow-lg"
          onMouseDown={(e) => { e.stopPropagation(); setDraggingHandle('nav-y'); }}
        >
          <div className="w-4 h-0.5 bg-slate-400 rounded-full group-hover/grip:bg-white transition-colors"></div>
        </div>

        <div className="h-14 bg-slate-950/80 backdrop-blur-md rounded-xl border border-slate-800 relative overflow-hidden p-1 shadow-2xl flex items-center gap-2">
          
          <button 
            onClick={jumpToStart}
            className="px-3 h-full bg-slate-900 hover:bg-slate-800 text-[9px] font-black text-red-500 border border-slate-800 rounded-lg flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95"
            title="Jump to Start"
          >
            <i className="fa-solid fa-backward-step"></i>
            START
          </button>

          <div className="flex-1 relative h-full bg-black/40 rounded-lg overflow-hidden">
            {/* Visual markers for current trim in navigation bar */}
            <div 
              className="absolute h-full bg-red-500/10 border-x border-red-500/20 pointer-events-none"
              style={{ 
                left: `${(localTrim.start / duration) * 100}%`,
                width: `${((localTrim.end - localTrim.start) / duration) * 100}%`
              }}
            />
            
            {/* Playhead marker in navigation bar */}
            <div 
              className="absolute h-full w-0.5 bg-yellow-500 z-10 pointer-events-none"
              style={{ left: `${(currentTime / duration) * 100}%` }}
            />

            {/* Draggable Viewport Scrollbar */}
            <div 
              className="absolute h-[calc(100%-4px)] bg-blue-500/20 border border-blue-400/50 rounded-lg cursor-grab active:cursor-grabbing hover:bg-blue-500/30 transition-all shadow-[inset_0_0_10px_rgba(59,130,246,0.2)] top-0.5 z-20"
              style={{ 
                left: `${scrollPos * (100 - (100/zoom))}%`, 
                width: `${100/zoom}%`
              }}
              onMouseDown={(e) => {
                const startX = e.clientX;
                const startScroll = scrollPos;
                const onMove = (mv: MouseEvent) => {
                  const deltaX = mv.clientX - startX;
                  const rect = e.currentTarget.parentElement!.getBoundingClientRect();
                  setScrollPos(Math.max(0, Math.min(1, startScroll + (deltaX / rect.width))));
                };
                const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
                window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
              }}
            >
              <div className="flex h-full items-center justify-center gap-1 opacity-40">
                <div className="w-0.5 h-3 bg-white"></div>
                <div className="w-0.5 h-3 bg-white"></div>
                <div className="w-0.5 h-3 bg-white"></div>
              </div>
            </div>
          </div>
          
          <button 
            onClick={jumpToEnd}
            className="px-3 h-full bg-slate-900 hover:bg-slate-800 text-[9px] font-black text-amber-500 border border-slate-800 rounded-lg flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95"
            title="Jump to End"
          >
            <i className="fa-solid fa-forward-step"></i>
            END
          </button>

          <div className="px-4 border-l border-slate-800 flex flex-col items-center justify-center min-w-[70px]">
            <span className="text-[7px] font-black text-slate-500 uppercase">View Pos</span>
            <span className="text-[10px] font-mono text-blue-400">{(scrollPos * 100).toFixed(1)}%</span>
          </div>
        </div>
      </div>

      <div className="pt-12 border-t border-slate-800 flex justify-between items-center mt-2">
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <span className="text-[8px] font-black text-slate-500 uppercase">Playback Position</span>
            <span className="text-xs font-mono text-yellow-500">{currentTime.toFixed(4)}s {isPlaying ? '(Playing)' : '(Paused)'}</span>
          </div>
          <div className="w-px h-8 bg-slate-800"></div>
          <div className="flex flex-col">
            <span className="text-[8px] font-black text-slate-500 uppercase">Trimmed Length</span>
            <span className="text-xs font-mono text-blue-400">{(localTrim.end - localTrim.start).toFixed(4)}s</span>
          </div>
        </div>
        <div className="flex gap-4">
          <button onClick={onClose} className="px-8 py-3 text-[11px] font-black text-slate-500 hover:text-white uppercase transition-all">Discard</button>
          <button onClick={handleSave} className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white px-12 py-4 rounded-2xl text-[12px] font-black uppercase tracking-widest transition-all shadow-xl shadow-blue-900/40">Apply Edits</button>
        </div>
      </div>
    </div>
  );
};
