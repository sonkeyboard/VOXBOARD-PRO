
import React, { useRef, useState, useEffect } from 'react';

interface MasterClockProps {
  activeTrackName: string | null;
  remainingTime: number;
  totalDuration: number;
  isPlaying: boolean;
  currentTime: number;
  onSeek: (offset: number, absolute?: boolean) => void;
}

export const MasterClock: React.FC<MasterClockProps> = ({ 
  activeTrackName, 
  remainingTime, 
  totalDuration, 
  isPlaying,
  currentTime,
  onSeek
}) => {
  const progressBarRef = useRef<HTMLDivElement>(null);
  const [clockHeight, setClockHeight] = useState(160); 
  const [isResizing, setIsResizing] = useState(false);

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(Math.max(0, totalSeconds) / 60);
    const secs = Math.floor(Math.max(0, totalSeconds) % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;
  const isCritical = isPlaying && remainingTime > 0 && remainingTime <= 10.1;

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || totalDuration <= 0) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    onSeek((x / rect.width) * totalDuration, true);
  };

  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      // Giới hạn chiều cao từ 100px đến 500px để linh hoạt hơn
      const newHeight = Math.max(100, Math.min(500, e.clientY - 120)); 
      setClockHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'ns-resize';
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // --- Tính toán tỉ lệ thu phóng cân đối (Dynamic Scaling) ---
  // Tỉ lệ cơ bản dựa trên chiều cao hiện tại so với chiều cao mặc định (160)
  const scaleFactor = clockHeight / 160;

  // Cỡ chữ cho số đếm ngược chính
  const mainTimeSize = Math.max(40, clockHeight * 0.65);
  // Cỡ chữ cho tên bài hát
  const trackNameSize = Math.max(12, clockHeight * 0.12);
  // Cỡ chữ cho các nhãn (labels)
  const labelSize = Math.max(7, clockHeight * 0.05);
  // Cỡ chữ cho thời gian elapsed/duration ở 2 bên
  const sideTimeSize = Math.max(14, clockHeight * 0.11);
  // Kích thước nút bấm
  const buttonSize = Math.max(24, Math.min(48, 32 * scaleFactor));

  return (
    <div 
      style={{ height: `${clockHeight}px` }}
      className={`bg-slate-900/60 border rounded-2xl px-6 py-2 flex flex-col lg:flex-row items-center justify-between gap-4 backdrop-blur-md shadow-2xl relative overflow-hidden group/clock transition-[border,background,ring] duration-500
      ${isCritical ? 'border-red-500/50 ring-2 ring-red-500/20 bg-red-950/20' : 'border-slate-800'}`}
    >
      
      {isCritical && <div className="absolute inset-0 bg-red-600/10 animate-pulse pointer-events-none"></div>}

      {/* Progress Bar ở đáy */}
      <div 
        ref={progressBarRef}
        onClick={handleProgressClick}
        className="absolute bottom-0 left-0 w-full h-1 bg-slate-800 cursor-pointer hover:h-2 transition-all z-20"
      >
        <div 
          className={`h-full relative transition-all duration-300 ${isCritical ? 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,1)]' : 'bg-blue-600 shadow-[0_0_10px_rgba(59,130,246,0.8)]'}`}
          style={{ width: `${Math.min(100, progress)}%` }}
        >
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full scale-0 group-hover/clock:scale-100 transition-transform bg-white border-2 border-current shadow-lg"></div>
        </div>
      </div>

      {/* Resizer Handle - Nâng cấp trực quan hơn */}
      <div 
        onMouseDown={startResizing}
        className="absolute bottom-0 left-0 w-full h-2 cursor-ns-resize flex items-center justify-center z-30 opacity-0 group-hover/clock:opacity-100 transition-opacity bg-blue-500/10"
      >
        <div className="w-12 h-0.5 bg-slate-600 rounded-full"></div>
      </div>

      {/* Left Section: Monitor Controls */}
      <div className="flex flex-col z-10 w-full lg:w-44 order-2 lg:order-1 items-center lg:items-start shrink-0">
        <span 
          style={{ fontSize: `${labelSize}px` }}
          className={`font-black uppercase tracking-[0.2em] mb-1 transition-colors ${isCritical ? 'text-red-400' : 'text-blue-500'}`}
        >
          {isCritical ? 'CRITICAL' : 'MONITOR'}
        </span>
        
        <div className="flex items-center gap-2">
          <button 
            style={{ width: `${buttonSize}px`, height: `${buttonSize}px` }}
            onClick={() => onSeek(-10)} 
            className="rounded-lg bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center transition-all border border-slate-700 hover:border-blue-500/50 shadow-lg active:scale-95"
          >
            <i className="fa-solid fa-rotate-left" style={{ fontSize: `${buttonSize * 0.4}px` }}></i>
          </button>
          <button 
            style={{ width: `${buttonSize}px`, height: `${buttonSize}px` }}
            onClick={() => onSeek(10)} 
            className="rounded-lg bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center transition-all border border-slate-700 hover:border-blue-500/50 shadow-lg active:scale-95"
          >
            <i className="fa-solid fa-rotate-right" style={{ fontSize: `${buttonSize * 0.4}px` }}></i>
          </button>
        </div>

        <div className="mt-2 flex flex-col items-center lg:items-start">
           <div style={{ fontSize: `${labelSize * 0.9}px` }} className="font-black text-slate-600 uppercase tracking-widest">Elapsed</div>
           <div 
            style={{ fontSize: `${sideTimeSize}px` }}
            className={`font-black font-mono leading-none ${isPlaying ? 'text-blue-400' : 'text-slate-700'}`}
           >
             {formatTime(currentTime)}
           </div>
        </div>
      </div>

      {/* Middle Section: THE BIG CLOCK + TRACK NAME - Cân đối trung tâm */}
      <div className="relative group z-10 flex flex-col items-center justify-center order-1 lg:order-2 flex-1 max-w-full min-h-0 py-1">
        <div className="flex flex-col items-center w-full px-4 overflow-hidden mb-1">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span 
              style={{ width: `${Math.max(4, 6 * scaleFactor)}px`, height: `${Math.max(4, 6 * scaleFactor)}px` }}
              className={`rounded-full ${isPlaying ? (isCritical ? 'bg-red-500 animate-ping' : 'bg-green-500 animate-pulse') : 'bg-slate-800'}`}
            ></span>
            <span style={{ fontSize: `${labelSize}px` }} className="font-black uppercase tracking-[0.3em] text-slate-500">
              {isPlaying ? 'Now Playing' : 'Standby'}
            </span>
          </div>
          <h2 
            style={{ fontSize: `${trackNameSize}px` }}
            className={`font-black uppercase tracking-tight text-center truncate max-w-[95%] transition-all duration-500 leading-tight
            ${!isPlaying ? 'text-slate-700' : (isCritical ? 'text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'text-white')}`}
          >
            {activeTrackName || 'NO ACTIVE SOUND'}
          </h2>
        </div>

        {clockHeight > 130 && (
          <div 
            style={{ fontSize: `${labelSize * 1.1}px` }}
            className={`font-black uppercase transition-colors ${isCritical ? 'text-red-400' : 'text-slate-500'} tracking-[0.3em] mb-[-2%] drop-shadow-sm opacity-60`}
          >
            {isCritical ? 'FINISHING' : 'REMAINING'}
          </div>
        )}
        
        <div 
          style={{ fontSize: `${mainTimeSize}px` }}
          className={`font-black font-mono tracking-tighter leading-none transition-all duration-100 select-none
          ${!isPlaying ? 'text-slate-800' : (isCritical ? 'text-red-500 drop-shadow-[0_0_25px_rgba(239,68,68,0.7)] scale-105' : 'text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]')}`}
        >
          {formatTime(remainingTime)}
        </div>
      </div>

      {/* Right Section: System Status */}
      <div className="flex flex-col items-center lg:items-end z-10 w-full lg:w-44 order-3 shrink-0">
        <div style={{ fontSize: `${labelSize}px` }} className="font-black text-slate-500 uppercase mb-1 tracking-widest">Status</div>
        <div 
          style={{ fontSize: `${labelSize * 1.2}px`, padding: `${4 * scaleFactor}px ${12 * scaleFactor}px` }}
          className={`rounded-lg font-black border-2 transition-all shadow-xl ${isPlaying ? (isCritical ? 'bg-red-500 text-white border-red-400 animate-pulse' : 'bg-green-500/10 border-green-500 text-green-500') : 'bg-slate-800 border-slate-700 text-slate-500'}`}
        >
          {isPlaying ? (isCritical ? 'WRAPPING' : 'ON-AIR') : 'READY'}
        </div>
        
        <div className="mt-4 flex flex-col items-center lg:items-end">
          <div style={{ fontSize: `${labelSize * 0.9}px` }} className="font-black text-slate-600 uppercase tracking-widest">Duration</div>
          <div 
            style={{ fontSize: `${sideTimeSize}px` }}
            className="font-black font-mono text-slate-400 leading-none"
          >
            {formatTime(totalDuration)}
          </div>
        </div>
      </div>
    </div>
  );
};
