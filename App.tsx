
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { SoundSet, SoundSlot, ActiveSound } from './types';
import { INITIAL_SETS, COLORS } from './constants';
import { SoundPad } from './components/SoundPad';
import { VUMeter } from './components/VUMeter';
import { MasterClock } from './components/MasterClock';
import { OSCManager } from './components/OSCManager';
import { AudioEditor } from './components/AudioEditor';
import { LoudnessSync } from './components/LoudnessSync';
import { ContactInfo } from './components/ContactInfo';

const App: React.FC = () => {
  const [soundSets, setSoundSets] = useState<SoundSet[]>(() => {
    const saved = localStorage.getItem('voxboard_library');
    return saved ? JSON.parse(saved) : INITIAL_SETS;
  });
  
  const [activeSetId, setActiveSetId] = useState<string>(soundSets[0]?.id || INITIAL_SETS[0].id);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSounds, setActiveSounds] = useState<Record<string, ActiveSound>>({});
  const [audioBuffers, setAudioBuffers] = useState<Record<string, AudioBuffer>>({});
  const [masterVolume, setMasterVolume] = useState(0.8);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [isDraggingOverGrid, setIsDraggingOverGrid] = useState(false);

  // States cho quản lý Sound Set Library và UI
  const [renamingSetId, setRenamingSetId] = useState<string | null>(null);
  const [renamingValue, setRenamingValue] = useState('');
  const [setToDeleteId, setSetToDeleteId] = useState<string | null>(null);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [isSetsListExpanded, setIsSetsListExpanded] = useState(true);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  useEffect(() => {
    localStorage.setItem('voxboard_library', JSON.stringify(soundSets));
  }, [soundSets]);

  useEffect(() => {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContextClass();
    const gain = ctx.createGain();
    const analyser = ctx.createAnalyser();
    gain.connect(analyser);
    analyser.connect(ctx.destination);
    audioCtxRef.current = ctx;
    masterGainRef.current = gain;
    analyserRef.current = analyser;
    return () => { ctx.close(); };
  }, []);

  useEffect(() => {
    if (masterGainRef.current) {
      masterGainRef.current.gain.setValueAtTime(masterVolume, audioCtxRef.current?.currentTime || 0);
    }
  }, [masterVolume]);

  const activeSet = useMemo(() => 
    soundSets.find(s => s.id === activeSetId) || soundSets[0], 
  [soundSets, activeSetId]);

  const filteredSets = useMemo(() => 
    soundSets.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase())),
  [soundSets, searchTerm]);

  const loadBuffer = useCallback(async (slot: SoundSlot) => {
    if (!slot.url || audioBuffers[slot.id]) return;
    if (!audioCtxRef.current) return;
    try {
      const response = await fetch(slot.url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioCtxRef.current.decodeAudioData(arrayBuffer);
      setAudioBuffers(prev => ({ ...prev, [slot.id]: audioBuffer }));
    } catch (e) {
      console.warn(`Audio fail: ${slot.name}`);
    }
  }, [audioBuffers]);

  useEffect(() => {
    if (activeSet) {
      activeSet.slots.forEach(slot => {
        if (slot.url && !audioBuffers[slot.id]) loadBuffer(slot);
      });
    }
  }, [activeSet, audioBuffers, loadBuffer]);

  const stopSound = useCallback((slotId: string) => {
    setActiveSounds(prev => {
      const active = prev[slotId];
      if (active) {
        try { active.source.stop(); active.source.disconnect(); active.gainNode.disconnect(); } catch (e) {}
        const next = { ...prev };
        delete next[slotId];
        return next;
      }
      return prev;
    });
  }, []);

  const handlePanic = useCallback(() => {
    setActiveSounds(prev => {
      // FIX: Added explicit type annotation (active: ActiveSound) to avoid 'unknown' type error
      Object.values(prev).forEach((active: ActiveSound) => {
        try { active.source.stop(); active.source.disconnect(); active.gainNode.disconnect(); } catch (e) {}
      });
      return {};
    });
  }, []);

  const playSound = useCallback((slot: SoundSlot, offset = 0) => {
    if (!audioCtxRef.current || !masterGainRef.current || !audioBuffers[slot.id]) return;
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') ctx.resume();
    stopSound(slot.id);
    const buffer = audioBuffers[slot.id];
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const start = Math.max(slot.trimStart, offset);
    const end = slot.trimEnd || buffer.duration;
    if (slot.loop) {
      source.loop = true;
      source.loopStart = slot.trimStart;
      source.loopEnd = end;
    }
    const gainNode = ctx.createGain();
    const durationToPlay = Math.max(0, end - start);
    const now = ctx.currentTime;
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(slot.volume, now + slot.fadeIn);
    if (!slot.loop && slot.fadeOut > 0) {
      const fadeOutStart = now + durationToPlay - slot.fadeOut;
      if (fadeOutStart > now) {
        gainNode.gain.setValueAtTime(slot.volume, fadeOutStart);
        gainNode.gain.linearRampToValueAtTime(0, now + durationToPlay);
      }
    }
    source.connect(gainNode);
    gainNode.connect(masterGainRef.current);
    source.start(now, start, slot.loop ? undefined : durationToPlay);
    source.onended = () => {
      setActiveSounds(prev => {
        if (prev[slot.id]?.source === source) {
          const next = { ...prev };
          delete next[slot.id];
          return next;
        }
        return prev;
      });
    };
    setActiveSounds(prev => ({
      ...prev,
      [slot.id]: {
        id: slot.id, source, gainNode, startTime: now, offset: start,
        duration: durationToPlay, isPaused: false, pauseOffset: 0
      }
    }));
  }, [audioBuffers, stopSound]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'Escape') { handlePanic(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        setIsSidebarVisible(prev => !prev);
      }
      const pressedKey = e.key.toUpperCase();
      const slotToTrigger = activeSet?.slots.find(s => s.shortcut === pressedKey);
      if (slotToTrigger && slotToTrigger.url) {
        e.preventDefault();
        playSound(slotToTrigger);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePanic, activeSet, playSound]);

  const pauseSound = useCallback((slot: SoundSlot) => {
    const active = activeSounds[slot.id];
    if (active && !active.isPaused && audioCtxRef.current) {
      const elapsed = audioCtxRef.current.currentTime - active.startTime;
      const pauseOffset = active.offset + elapsed;
      try { active.source.stop(); active.source.disconnect(); } catch(e) {}
      setActiveSounds(prev => ({ ...prev, [slot.id]: { ...active, isPaused: true, pauseOffset } }));
    }
  }, [activeSounds]);

  const resumeSound = useCallback((slot: SoundSlot) => {
    const active = activeSounds[slot.id];
    if (active && active.isPaused) playSound(slot, active.pauseOffset);
  }, [activeSounds, playSound]);

  const handleUpdateSlot = (slotId: string, updates: Partial<SoundSlot>) => {
    setSoundSets(prev => prev.map(set => ({
      ...set,
      slots: set.slots.map(slot => slot.id === slotId ? { ...slot, ...updates } : slot)
    })));
  };

  const handleMoveSlot = (sourceSlotId: string, targetSlotId: string) => {
    if (sourceSlotId === targetSlotId) return;
    setSoundSets(prev => prev.map(set => {
      const sourceSlot = set.slots.find(s => s.id === sourceSlotId);
      const targetSlot = set.slots.find(s => s.id === targetSlotId);
      if (sourceSlot && targetSlot) {
        return {
          ...set,
          slots: set.slots.map(slot => {
            if (slot.id === sourceSlotId) return { ...targetSlot, id: sourceSlotId, shortcut: slot.shortcut };
            if (slot.id === targetSlotId) return { ...sourceSlot, id: targetSlotId, shortcut: slot.shortcut };
            return slot;
          })
        };
      }
      return set;
    }));
    stopSound(sourceSlotId);
    stopSound(targetSlotId);
  };

  const handleCreateSet = () => {
    const newId = `set-${Date.now()}`;
    const newName = `New Sound Set ${soundSets.length + 1}`;
    const newSet: SoundSet = {
      id: newId, 
      name: newName,
      slots: Array.from({ length: 28 }, (_, i) => ({
        id: `slot-${newId}-${i}`, name: `Pad trống ${i + 1}`, url: null, volume: 0.8, loop: false,
        color: COLORS[i % COLORS.length], trimStart: 0, trimEnd: null, fadeIn: 0, fadeOut: 0
      }))
    };
    setSoundSets(prev => [...prev, newSet]);
    setActiveSetId(newId);
    setRenamingSetId(newId);
    setRenamingValue(newName);
    setIsSetsListExpanded(true);
  };

  const startRename = (id: string, currentName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingSetId(id);
    setRenamingValue(currentName);
  };

  const saveRename = () => {
    if (renamingSetId && renamingValue.trim()) {
      setSoundSets(prev => prev.map(s => s.id === renamingSetId ? { ...s, name: renamingValue.trim() } : s));
    }
    setRenamingSetId(null);
  };

  const cancelRename = () => setRenamingSetId(null);

  const handleDeleteSetRequest = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (soundSets.length <= 1) return alert("Hệ thống yêu cầu ít nhất 1 Sound Set.");
    
    if (setToDeleteId === id) {
      const set = soundSets.find(s => s.id === id);
      if (set) {
        set.slots.forEach(slot => stopSound(slot.id));
        const nextSets = soundSets.filter(s => s.id !== id);
        setSoundSets(nextSets);
        if (activeSetId === id) setActiveSetId(nextSets[0]?.id || '');
      }
      setToDeleteId(null);
    } else {
      setToDeleteId(id);
      setTimeout(() => setSetToDeleteId(prev => prev === id ? null : prev), 3000);
    }
  };

  const handleDuplicateSet = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const set = soundSets.find(s => s.id === id);
    if (!set) return;
    const newId = `set-${Date.now()}`;
    const newSet: SoundSet = {
      ...set,
      id: newId,
      name: `${set.name} (Copy)`,
      slots: set.slots.map((slot, i) => ({ ...slot, id: `slot-${newId}-${i}` }))
    };
    setSoundSets(prev => [...prev, newSet]);
    setActiveSetId(newId);
  };

  const handleExportLibrary = () => {
    const dataStr = JSON.stringify(soundSets, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', `voxboard_lib_${new Date().toISOString().slice(0, 10)}.json`);
    linkElement.click();
  };

  const handleImportLibrary = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (Array.isArray(imported)) {
          setSoundSets(imported);
          setActiveSetId(imported[0]?.id || '');
        }
      } catch (err) { alert("File không hợp lệ!"); }
    };
    reader.readAsText(file);
  };

  const handleGridDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOverGrid(false);
    // FIX: Added explicit type annotation (f: File) to avoid 'unknown' type error
    const files = Array.from(e.dataTransfer.files).filter((f: File) => f.type.startsWith('audio/'));
    if (files.length === 0) return;
    setSoundSets(prev => prev.map(set => {
      if (set.id !== activeSetId) return set;
      const nextSlots = [...set.slots];
      // FIX: Added explicit type annotation (file: File) to avoid 'unknown' type errors below
      files.forEach((file: File, idx) => {
        const url = URL.createObjectURL(file);
        const emptyIdx = nextSlots.findIndex(s => !s.url);
        const newSlot: SoundSlot = {
          id: `slot-${Date.now()}-${idx}`, name: file.name.split('.')[0], url, volume: 0.8, loop: false,
          color: COLORS[(emptyIdx === -1 ? nextSlots.length : emptyIdx) % COLORS.length],
          trimStart: 0, trimEnd: null, fadeIn: 0, fadeOut: 0
        };
        if (emptyIdx !== -1) nextSlots[emptyIdx] = newSlot;
        else nextSlots.push(newSlot);
      });
      return { ...set, slots: nextSlots };
    }));
  };

  const [times, setTimes] = useState<Record<string, number>>({});
  useEffect(() => {
    const interval = setInterval(() => {
      if (!audioCtxRef.current) return;
      const now = audioCtxRef.current.currentTime;
      const newTimes: Record<string, number> = {};
      Object.entries(activeSounds).forEach(([id, active]) => {
        // FIX: Cast 'active' to 'ActiveSound' to fix 'unknown' type errors for properties like isPaused, pauseOffset, etc.
        const a = active as ActiveSound;
        newTimes[id] = a.isPaused ? a.pauseOffset : a.offset + (now - a.startTime);
      });
      setTimes(newTimes);
    }, 50);
    return () => clearInterval(interval);
  }, [activeSounds]);

  const primaryActiveId = Object.keys(activeSounds)[0];
  const primaryActive = primaryActiveId ? activeSounds[primaryActiveId] : null;
  const primarySlot = primaryActive ? activeSet?.slots.find(s => s.id === primaryActiveId) : null;

  const remainingTime = useMemo(() => {
    if (!primaryActive || !primarySlot) return 0;
    const current = times[primaryActiveId] || primaryActive.offset;
    const end = primarySlot.trimEnd || (audioBuffers[primaryActiveId]?.duration || 0);
    return Math.max(0, end - current);
  }, [primaryActive, primarySlot, primaryActiveId, times, audioBuffers]);

  const totalDuration = useMemo(() => {
    if (!primaryActive || !primarySlot) return 0;
    const end = primarySlot.trimEnd || (audioBuffers[primaryActiveId]?.duration || 0);
    return Math.max(0, end - primarySlot.trimStart);
  }, [primaryActive, primarySlot, primaryActiveId, audioBuffers]);

  const displayCurrentTime = useMemo(() => {
    if (!primaryActive || !primarySlot) return 0;
    return Math.max(0, (times[primaryActiveId] || primaryActive.offset) - primarySlot.trimStart);
  }, [primaryActive, primarySlot, primaryActiveId, times]);

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-slate-200 overflow-hidden font-sans selection:bg-red-500/30">
      <header className="flex-shrink-0 px-6 py-3 bg-slate-900/40 border-b border-slate-800/50 flex justify-between items-center backdrop-blur-xl z-50">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsSidebarVisible(!isSidebarVisible)}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${isSidebarVisible ? 'bg-slate-800 text-blue-400' : 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'}`}
            title={isSidebarVisible ? "Ẩn Sidebar" : "Hiện Sidebar"}
          >
            <i className={`fa-solid ${isSidebarVisible ? 'fa-indent' : 'fa-outdent'}`}></i>
          </button>
          
          <img 
            src="https://i.ibb.co/3mNfK8f/logo-thanhvinh.png" 
            alt="Thành Vinh Logo" 
            className="h-8 w-8 object-contain bg-[#e1322b] rounded-full p-1.5 shadow-lg shadow-red-500/20 ml-2"
            onError={(e) => { e.currentTarget.src = 'https://raw.githubusercontent.com/google/material-design-icons/master/png/av/volume_up/materialicons/48dp/2x/baseline_volume_up_black_48dp.png'; }}
          />
          <div>
            <h1 className="text-lg font-black uppercase tracking-tighter text-white">VoxBoard <span className="text-[#e1322b]">Pro</span></h1>
            <div className="flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-red-500 animate-pulse"></span>
              <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Live Performance System</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <VUMeter analyser={analyserRef.current} />
          <div className="flex flex-col gap-1 w-32">
            <div className="flex justify-between text-[7px] font-black text-slate-500 uppercase tracking-widest">
              <span>Gain</span>
              <span>{Math.round(masterVolume * 100)}%</span>
            </div>
            <input 
              type="range" min="0" max="1.5" step="0.01" value={masterVolume} 
              onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
              className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-red-600"
            />
          </div>
          <button onClick={handlePanic} title="Panic (ESC)" className="bg-red-600 hover:bg-red-500 px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all shadow-lg border border-red-500/50">
            PANIC (ESC)
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col min-h-0 px-6 py-4 gap-4 overflow-hidden">
        <div className="flex-shrink-0">
          <MasterClock 
            activeTrackName={primarySlot?.name || null}
            isPlaying={!!primaryActive && !primaryActive.isPaused}
            currentTime={displayCurrentTime}
            totalDuration={totalDuration}
            remainingTime={remainingTime}
            onSeek={(offset, absolute) => {
              if (primarySlot) playSound(primarySlot, absolute ? (primarySlot.trimStart + offset) : (times[primaryActiveId] || 0) + offset);
            }}
          />
        </div>

        <div className="flex-1 flex gap-6 min-h-0 overflow-hidden relative">
          {/* Sidebar Section */}
          <aside 
            className={`flex-shrink-0 flex flex-col gap-3 overflow-y-auto pr-1 custom-scrollbar transition-all duration-300 ${isSidebarVisible ? 'w-64 opacity-100' : 'w-0 opacity-0 pointer-events-none -ml-6'}`}
          >
            <div className="bg-slate-900/60 rounded-xl border border-slate-800/50 flex flex-col min-h-0 overflow-hidden shadow-2xl">
              <div className="p-3 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md">
                <div className="flex justify-between items-center mb-3">
                  <button 
                    onClick={() => setIsSetsListExpanded(!isSetsListExpanded)}
                    className="flex items-center gap-1.5 group/title"
                  >
                    <i className={`fa-solid fa-chevron-right text-blue-500 text-[8px] transition-transform duration-300 ${isSetsListExpanded ? 'rotate-90' : ''}`}></i>
                    <i className="fa-solid fa-layer-group text-blue-500 text-[10px]"></i>
                    <h2 className="text-[9px] font-black text-slate-200 uppercase tracking-[0.2em] group-hover/title:text-white transition-colors">Sound Sets</h2>
                  </button>
                  <div className="flex gap-1">
                    <button onClick={handleExportLibrary} className="w-6 h-6 rounded bg-slate-800 text-slate-400 hover:text-white transition-all flex items-center justify-center border border-slate-700" title="Export">
                      <i className="fa-solid fa-file-export text-[9px]"></i>
                    </button>
                    <label className="w-6 h-6 rounded bg-slate-800 text-slate-400 hover:text-white transition-all flex items-center justify-center border border-slate-700 cursor-pointer" title="Import">
                      <i className="fa-solid fa-file-import text-[9px]"></i>
                      <input type="file" className="hidden" accept=".json" onChange={handleImportLibrary} />
                    </label>
                    <button onClick={handleCreateSet} className="w-6 h-6 rounded bg-[#e1322b] text-white hover:bg-red-500 transition-all flex items-center justify-center shadow-lg" title="Add Set">
                      <i className="fa-solid fa-plus text-[10px]"></i>
                    </button>
                  </div>
                </div>
                
                {isSetsListExpanded && (
                  <div className="relative animate-in slide-in-from-top-1 duration-200">
                    <i className="fa-solid fa-magnifying-glass absolute left-2 top-1/2 -translate-y-1/2 text-slate-600 text-[9px]"></i>
                    <input 
                      type="text" placeholder="TÌM KIẾM..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-7 pr-3 py-1.5 text-[9px] font-bold text-slate-400 focus:border-blue-500 focus:text-white outline-none transition-all uppercase tracking-widest"
                    />
                  </div>
                )}
              </div>

              <div className={`transition-all duration-300 overflow-y-auto custom-scrollbar ${isSetsListExpanded ? 'max-h-[500px] p-1.5 space-y-1.5' : 'max-h-0'}`}>
                {filteredSets.length === 0 ? (
                  <div className="py-4 text-center text-slate-600 text-[9px] font-black uppercase tracking-widest">Trống</div>
                ) : (
                  filteredSets.map(set => (
                    <div key={set.id} className="group relative" onDoubleClick={(e) => startRename(set.id, set.name, e)}>
                      {renamingSetId === set.id ? (
                        <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-lg border border-blue-500 shadow-xl" onClick={(e) => e.stopPropagation()}>
                          <input 
                            autoFocus value={renamingValue} onChange={(e) => setRenamingValue(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') saveRename(); if (e.key === 'Escape') cancelRename(); }}
                            className="flex-1 bg-slate-950 text-white text-[10px] font-black px-2 py-1 outline-none rounded uppercase"
                          />
                          <button onClick={saveRename} className="w-5 h-5 bg-blue-600 rounded flex items-center justify-center text-[8px]"><i className="fa-solid fa-check"></i></button>
                        </div>
                      ) : (
                        <>
                          <button 
                            onClick={() => setActiveSetId(set.id)}
                            className={`w-full text-left px-3 py-3 rounded-lg text-[10px] font-black transition-all flex items-center justify-between uppercase tracking-wider border
                              ${activeSetId === set.id ? 'bg-[#e1322b] text-white border-red-400 shadow-lg' : 'bg-slate-800/40 hover:bg-slate-800 text-slate-400 border-slate-700/50 hover:border-slate-600'}`}
                          >
                            <span className="truncate pr-14">{set.name}</span>
                            <i className={`fa-solid fa-waveform-path text-[8px] ${activeSetId === set.id ? 'opacity-100 animate-pulse' : 'opacity-0'}`}></i>
                          </button>
                          
                          <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-all z-10">
                            <button onClick={(e) => handleDuplicateSet(set.id, e)} className="w-5 h-5 rounded flex items-center justify-center bg-slate-700/80 text-white hover:bg-blue-600" title="Duplicate"><i className="fa-solid fa-copy text-[7px]"></i></button>
                            <button onClick={(e) => startRename(set.id, set.name, e)} className="w-5 h-5 rounded flex items-center justify-center bg-slate-700/80 text-white hover:bg-blue-600" title="Rename"><i className="fa-solid fa-pen text-[7px]"></i></button>
                            <button 
                              onClick={(e) => handleDeleteSetRequest(set.id, e)} 
                              className={`w-5 h-5 rounded flex items-center justify-center transition-all ${setToDeleteId === set.id ? 'bg-red-500 text-white animate-bounce' : 'bg-slate-700/80 text-red-400 hover:bg-red-600 hover:text-white'}`}
                              title={setToDeleteId === set.id ? "Xác nhận?" : "Xóa"}
                            >
                              <i className={`fa-solid ${setToDeleteId === set.id ? 'fa-triangle-exclamation' : 'fa-trash-can'} text-[7px]`}></i>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            <LoudnessSync onApply={(gain) => setSoundSets(prev => prev.map(s => s.id === activeSetId ? {...s, slots: s.slots.map(sl => ({...sl, volume: gain}))} : s))} />
            <OSCManager onCommand={(addr, val) => {
              if (addr.startsWith('/voxboard/trigger/')) {
                const index = parseInt(addr.split('/').pop() || '1') - 1;
                const slot = activeSet?.slots[index];
                if (slot && slot.url) playSound(slot);
              } else if (addr === '/voxboard/panic') handlePanic();
            }} />
            <ContactInfo />
          </aside>

          {/* Pads Grid Section */}
          <div 
            className={`flex-1 overflow-y-auto pr-1 custom-scrollbar transition-all duration-300 rounded-2xl ${isDraggingOverGrid ? 'bg-blue-500/5 ring-4 ring-blue-500/20' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setIsDraggingOverGrid(true); }}
            onDragLeave={() => setIsDraggingOverGrid(false)}
            onDrop={handleGridDrop}
          >
            <div className="pad-grid">
              {activeSet?.slots.map(slot => (
                <SoundPad 
                  key={slot.id} slot={slot} isPlaying={!!activeSounds[slot.id]} isPaused={activeSounds[slot.id]?.isPaused || false}
                  progress={audioBuffers[slot.id] ? (Math.max(0, (times[slot.id] || 0) - slot.trimStart)) / (Math.max(0.1, (slot.trimEnd || audioBuffers[slot.id].duration) - slot.trimStart)) : 0}
                  currentTime={times[slot.id] || 0}
                  duration={audioBuffers[slot.id] ? (slot.trimEnd || audioBuffers[slot.id].duration) - slot.trimStart : 0}
                  onPlay={playSound} onPause={pauseSound} onResume={resumeSound} onStop={(s) => stopSound(s.id)}
                  onUpdate={handleUpdateSlot} onMove={handleMoveSlot} onOpenEditor={(s) => setEditingSlotId(s.id)}
                />
              ))}
              <div 
                className="h-32 border-2 border-dashed border-slate-800 rounded-xl flex flex-col items-center justify-center text-slate-600 hover:text-blue-500 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all cursor-pointer group"
                onClick={() => {
                   const input = document.createElement('input');
                   input.type = 'file'; input.multiple = true; input.accept = 'audio/*';
                   input.onchange = (e) => {
                     const files = (e.target as HTMLInputElement).files;
                     if (files) handleGridDrop({ preventDefault: () => {}, dataTransfer: { files } } as any);
                   };
                   input.click();
                }}
              >
                <i className="fa-solid fa-cloud-arrow-up text-xl mb-1 group-hover:scale-110 transition-transform"></i>
                <span className="text-[9px] font-black uppercase tracking-widest">Kéo thả thêm ô</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {editingSlotId && activeSet && (
        <AudioEditor 
          slot={activeSet.slots.find(s => s.id === editingSlotId)!}
          audioBuffer={audioBuffers[editingSlotId]}
          currentTime={times[editingSlotId] || 0}
          isPlaying={!!activeSounds[editingSlotId] && !activeSounds[editingSlotId].isPaused}
          onTogglePlay={() => {
            const slot = activeSet.slots.find(s => s.id === editingSlotId)!;
            activeSounds[editingSlotId] ? (activeSounds[editingSlotId].isPaused ? resumeSound(slot) : pauseSound(slot)) : playSound(slot);
          }}
          onUpdate={(updates) => handleUpdateSlot(editingSlotId, updates)}
          onSeek={(time, resume) => {
            const slot = activeSet.slots.find(s => s.id === editingSlotId)!;
            playSound(slot, time);
          }}
          onClose={() => setEditingSlotId(null)}
        />
      )}
    </div>
  );
};

export default App;
