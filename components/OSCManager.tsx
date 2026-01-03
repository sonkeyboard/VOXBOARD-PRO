
import React, { useState, useEffect, useRef } from 'react';

interface OSCLog {
  address: string;
  args: any;
  timestamp: string;
}

interface OSCManagerProps {
  onCommand: (address: string, args: any) => void;
}

export const OSCManager: React.FC<OSCManagerProps> = ({ onCommand }) => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [logs, setLogs] = useState<OSCLog[]>([]);
  const [port] = useState(8000);
  const logEndRef = useRef<HTMLDivElement>(null);

  const addLog = (address: string, args: any) => {
    const newLog = {
      address,
      args,
      timestamp: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };
    setLogs(prev => [newLog, ...prev].slice(0, 10));
    onCommand(address, args);
  };

  const simulateCommand = (addr: string, val: any) => {
    if (!isEnabled) return;
    addLog(addr, val);
  };

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
      <div className="p-3 border-b border-slate-700 flex items-center justify-between bg-slate-900/30">
        <h3 className="text-[10px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-2">
          <i className="fa-solid fa-network-wired"></i>
          OSC Remote Control
        </h3>
        <label className="relative inline-flex items-center cursor-pointer">
          <input 
            type="checkbox" 
            checked={isEnabled} 
            onChange={(e) => setIsEnabled(e.target.checked)} 
            className="sr-only peer"
          />
          <div className="w-7 h-4 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600"></div>
        </label>
      </div>

      <div className="p-3 space-y-3">
        {isEnabled ? (
          <>
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-slate-500 font-bold uppercase">UDP Port</span>
              <span className="text-blue-400 font-mono">{port}</span>
            </div>
            
            <div className="bg-black/40 rounded-lg p-2 h-24 overflow-y-auto font-mono text-[9px] border border-slate-800 space-y-1">
              {logs.length === 0 ? (
                <div className="text-slate-600 italic">Waiting for OSC packets...</div>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className="flex gap-2 animate-in fade-in slide-in-from-left-1 duration-200">
                    <span className="text-slate-500">[{log.timestamp}]</span>
                    <span className="text-green-500">{log.address}</span>
                    <span className="text-blue-400">{JSON.stringify(log.args)}</span>
                  </div>
                ))
              )}
              <div ref={logEndRef} />
            </div>

            <div className="grid grid-cols-2 gap-2 mt-2">
              <button 
                onClick={() => simulateCommand('/voxboard/trigger/1', 1)}
                className="bg-slate-700 hover:bg-slate-600 text-[9px] font-bold py-1 rounded border border-slate-600 uppercase"
              >
                Test Pad 1
              </button>
              <button 
                onClick={() => simulateCommand('/voxboard/panic', 1)}
                className="bg-red-500/20 hover:bg-red-500/40 text-red-400 text-[9px] font-bold py-1 rounded border border-red-500/30 uppercase"
              >
                Test Panic
              </button>
            </div>
          </>
        ) : (
          <div className="py-4 text-center">
            <p className="text-[10px] text-slate-500 leading-relaxed">
              Enable OSC to control VoxBoard Pro remotely via QLab, TouchOSC, or Stream Deck.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
