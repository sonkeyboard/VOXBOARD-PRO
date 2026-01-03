
import React, { useState } from 'react';

interface PlatformStandard {
  name: string;
  lufs: number;
}

const STANDARDS: PlatformStandard[] = [
  { name: 'Spotify/YT (-14)', lufs: -14 },
  { name: 'Apple (-16)', lufs: -16 },
  { name: 'Podcast (-19)', lufs: -19 },
  { name: 'TV (-23)', lufs: -23 },
];

interface LoudnessSyncProps {
  onApply: (gainFactor: number) => void;
}

export const LoudnessSync: React.FC<LoudnessSyncProps> = ({ onApply }) => {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [isApplying, setIsApplying] = useState(false);

  const handleSync = () => {
    setIsApplying(true);
    const target = STANDARDS[selectedIdx].lufs;
    const gainFactor = Math.pow(10, (target + 14) / 40) * 0.85; 
    
    setTimeout(() => {
      onApply(Math.min(1.0, Math.max(0.1, gainFactor)));
      setIsApplying(false);
    }, 600);
  };

  return (
    <div className="bg-slate-900/40 border border-slate-800/50 rounded-xl p-3 backdrop-blur-md">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
          <i className="fa-solid fa-layer-group text-indigo-500"></i>
          Loudness Sync
        </h3>
        {isApplying && <i className="fa-solid fa-circle-notch fa-spin text-[10px] text-indigo-500"></i>}
      </div>

      <div className="flex gap-2">
        <select 
          value={selectedIdx}
          onChange={(e) => setSelectedIdx(parseInt(e.target.value))}
          className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-[10px] font-bold text-slate-300 outline-none focus:ring-1 focus:ring-indigo-500"
        >
          {STANDARDS.map((std, idx) => (
            <option key={std.name} value={idx}>{std.name}</option>
          ))}
        </select>
        <button
          onClick={handleSync}
          disabled={isApplying}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all shadow-lg shadow-indigo-900/20"
        >
          {isApplying ? '...' : 'Sync'}
        </button>
      </div>
    </div>
  );
};
