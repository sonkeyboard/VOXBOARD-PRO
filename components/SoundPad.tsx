
import React, { useRef, useState, useEffect } from 'react';
import { SoundSlot } from '../types';
import { COLORS } from '../constants';

interface SoundPadProps {
  slot: SoundSlot;
  isPlaying: boolean;
  isPaused: boolean;
  progress: number;
  currentTime: number;
  duration: number;
  onPlay: (slot: SoundSlot) => void;
  onPause: (slot: SoundSlot) => void;
  onResume: (slot: SoundSlot) => void;
  onStop: (slot: SoundSlot) => void;
  onUpdate: (id: string, updates: Partial<SoundSlot>) => void;
  onMove: (sourceId: string, targetId: string) => void;
  onOpenEditor: (slot: SoundSlot) => void;
}

const formatTime = (seconds: number) => {
  if (isNaN(seconds) || !isFinite(seconds)) return "00:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const SoundPad: React.FC<SoundPadProps> = ({ 
  slot, isPlaying, isPaused, progress, currentTime, duration, onPlay, onPause, onResume, onStop, onUpdate, onMove, onOpenEditor
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isAssigning, setIsAssigning] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(slot.name);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  // Chế độ xác nhận xóa
  const [deleteConfirmState, setDeleteConfirmState] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      onUpdate(slot.id, { 
        url, 
        name: file.name.split('.')[0],
        trimStart: 0,
        trimEnd: null 
      });
    }
  };

  const onDragStart = (e: React.DragEvent) => {
    if (!slot.url) {
      e.preventDefault();
      return;
    }
    setIsDragging(true);
    e.dataTransfer.setData('voxboard/slot-id', slot.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDragEnd = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragOver(false);
    
    // Check for internal drag
    const sourceId = e.dataTransfer.getData('voxboard/slot-id');
    if (sourceId) {
      onMove(sourceId, slot.id);
      return;
    }

    // Check for external file drag
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('audio/')) {
      const url = URL.createObjectURL(file);
      onUpdate(slot.id, { 
        url, 
        name: file.name.split('.')[0],
        trimStart: 0,
        trimEnd: null
      });
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (isAssigning || isEditing || deleteConfirmState) return;
    
    // Nếu không có âm thanh, mở trình chọn tệp
    if (!slot.url) { 
      fileInputRef.current?.click(); 
      return; 
    }
    
    // Logic Toggle: 
    // Nếu đang phát và không tạm dừng -> Tạm dừng
    // Nếu đang phát và đang tạm dừng -> Tiếp tục
    // Nếu chưa phát -> Phát mới
    if (isPlaying) {
      if (isPaused) {
        onResume(slot);
      } else {
        onPause(slot);
      }
    } else {
      onPlay(slot);
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    // Dừng hẳn âm thanh khi double click (giữ tính năng stop nhanh)
    if (isPlaying) onStop(slot);
  };

  const toggleLoop = (e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdate(slot.id, { loop: !slot.loop });
  };

  const startAssigning = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsAssigning(true);
  };

  const toggleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditName(slot.name);
    setIsEditing(!isEditing);
  };

  const handleReplaceClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    fileInputRef.current?.click();
  };

  const handleDeleteRequest = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (deleteConfirmState) {
      // Thực hiện xóa thực sự
      if (isPlaying) onStop(slot);
      onUpdate(slot.id, { 
        url: null, 
        name: 'Empty Pad',
        trimStart: 0,
        trimEnd: null,
        fadeIn: 0,
        fadeOut: 0,
        loop: false,
        volume: 0.8
      });
      setDeleteConfirmState(false);
    } else {
      // Chuyển sang chế độ chờ xác nhận
      setDeleteConfirmState(true);
    }
  };

  // Tự động hủy trạng thái chờ xóa sau 3 giây
  useEffect(() => {
    if (deleteConfirmState) {
      const timer = setTimeout(() => setDeleteConfirmState(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [deleteConfirmState]);

  const saveName = () => {
    onUpdate(slot.id, { name: editName });
    setIsEditing(false);
  };

  useEffect(() => {
    if (!isAssigning) return;
    const handleKey = (e: KeyboardEvent) => {
      e.preventDefault(); e.stopPropagation();
      const key = e.key.toUpperCase();
      if (key.length === 1) onUpdate(slot.id, { shortcut: key });
      else if (e.key === 'Backspace' || e.key === 'Escape') onUpdate(slot.id, { shortcut: undefined });
      setIsAssigning(false);
    };
    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [isAssigning, slot.id, onUpdate]);

  return (
    <div 
      draggable={!!slot.url}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`relative h-32 rounded-lg transition-all duration-200 cursor-pointer overflow-hidden border-2 group
        ${slot.url ? slot.color : 'bg-slate-800 border-slate-700'} 
        ${isPlaying && !isPaused ? 'playing brightness-110 shadow-lg shadow-blue-500/20' : 'hover:brightness-110'}
        ${isPaused ? 'opacity-80 scale-[0.98]' : ''}
        ${isDragging ? 'opacity-40 grayscale-[0.5]' : ''}
        ${isDragOver ? 'border-blue-400 ring-4 ring-blue-500/30 scale-[1.02] shadow-2xl z-30' : 'border-transparent'}`}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={onDrop}
    >
      {isPlaying && (
        <div className="absolute inset-0 bg-black/20 origin-left transition-transform duration-100 ease-linear" style={{ transform: `scaleX(${progress})` }} />
      )}

      {/* Overlay xác nhận xóa */}
      {deleteConfirmState && (
        <div 
          className="absolute inset-0 z-30 bg-red-600 flex flex-col items-center justify-center text-white animate-in fade-in duration-200"
          onClick={handleDeleteRequest}
        >
          <i className="fa-solid fa-trash-can-arrow-up text-2xl mb-1 animate-bounce"></i>
          <span className="text-[10px] font-black uppercase tracking-widest">Confirm Clear?</span>
        </div>
      )}

      {isEditing && (
        <div className="absolute inset-0 z-20 bg-slate-900/95 p-2 flex flex-col gap-2 animate-in fade-in zoom-in duration-150" onClick={(e) => e.stopPropagation()}>
          <div className="flex gap-1">
            <input autoFocus className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white outline-none" value={editName} onChange={(e) => setEditName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveName()} />
            <button onClick={saveName} className="bg-blue-600 px-2 rounded text-[10px] font-bold">OK</button>
          </div>
          <div className="grid grid-cols-5 gap-1 overflow-y-auto">
            {COLORS.map(color => (
              <button key={color} className={`h-4 rounded ${color} border border-white/10 ${slot.color === color ? 'ring-2 ring-white' : ''}`} onClick={() => onUpdate(slot.id, { color })} />
            ))}
          </div>
          <button onClick={() => setIsEditing(false)} className="text-[10px] text-slate-400 mt-auto font-bold uppercase">Cancel</button>
        </div>
      )}

      <div className="relative z-10 p-3 h-full flex flex-col justify-between select-none">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2">
            {slot.url && (
              <div className="cursor-grab active:cursor-grabbing text-white/40 hover:text-white transition-colors" title="Kéo để di chuyển">
                <i className="fa-solid fa-grip-vertical text-[10px]"></i>
              </div>
            )}
            <button onClick={startAssigning} className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded ${isAssigning ? 'bg-white text-blue-600 animate-pulse' : 'bg-black/30 text-white/70'}`}>
              {isAssigning ? '?' : (slot.shortcut || 'SET')}
            </button>
          </div>
          
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {slot.url && (
              <>
                <button 
                  className="p-1 hover:bg-black/20 rounded text-amber-400" 
                  onClick={handleReplaceClick} 
                  title="Thay đổi bài hát"
                >
                  <i className="fa-solid fa-file-import text-[10px]"></i>
                </button>
                <button 
                  className={`p-1 rounded transition-colors ${deleteConfirmState ? 'bg-white text-red-600' : 'hover:bg-black/20 text-red-400'}`} 
                  onClick={handleDeleteRequest} 
                  title="Xóa bài hát"
                >
                  <i className="fa-solid fa-trash-can text-[10px]"></i>
                </button>
              </>
            )}
            <button 
              className={`p-1 rounded transition-all duration-300 ${slot.loop ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.8)] scale-110' : 'text-white/40 hover:text-white'}`} 
              onClick={toggleLoop} 
              title="Toggle Loop"
            >
              <i className="fa-solid fa-repeat text-[10px]"></i>
            </button>
            <button className="p-1 hover:bg-black/20 rounded text-blue-300" onClick={(e) => { e.stopPropagation(); onOpenEditor(slot); }} title="Open Editor">
              <i className="fa-solid fa-scissors text-[10px]"></i>
            </button>
            <button className="p-1 hover:bg-black/20 rounded" onClick={toggleEdit} title="Settings">
              <i className="fa-solid fa-gear text-[10px]"></i>
            </button>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center text-center">
          <i className={`fa-solid ${!slot.url ? 'fa-plus opacity-40' : (isPlaying ? (isPaused ? 'fa-play' : 'fa-pause') : 'fa-play')} text-2xl mb-1`}></i>
          <span className="text-sm font-bold truncate w-full px-2">{slot.name}</span>
          {isPaused && <span className="text-[8px] font-black uppercase tracking-widest text-white/60">Paused</span>}
        </div>

        <div className="flex justify-between items-end">
           <span className="text-[9px] font-mono bg-black/30 px-1.5 py-0.5 rounded">{isPlaying ? formatTime(currentTime) : (slot.url ? 'READY' : 'EMPTY')}</span>
           <span className="text-[9px] font-mono opacity-80">{slot.url && duration > 0 ? formatTime(duration) : '--:--'}</span>
        </div>
      </div>
      <input type="file" ref={fileInputRef} className="hidden" accept="audio/*" onChange={handleFileChange} />
    </div>
  );
};
