
import React, { useEffect, useRef } from 'react';

interface VUMeterProps {
  analyser: AnalyserNode | null;
}

export const VUMeter: React.FC<VUMeterProps> = ({ analyser }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(null);
  const peakRef = useRef<number>(0);

  useEffect(() => {
    if (!canvasRef.current || !analyser) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      // 1. Calculate the raw peak level (0.0 to 1.0)
      let maxByte = 0;
      for (let i = 0; i < bufferLength; i++) {
        if (dataArray[i] > maxByte) maxByte = dataArray[i];
      }
      
      // 2. Convert to Decibels
      // We assume the byte data 255 is roughly 0dB in many web audio implementations, 
      // but to show +12dB headroom, we define our own scale.
      const linearLevel = maxByte / 255;
      let db = linearLevel > 0 ? 20 * Math.log10(linearLevel) : -100;

      // 3. Map dB to Meter Position (0.0 to 1.0)
      // Range: -60dB (0.0) to +12dB (1.0)
      // 0dB should be at 0.8 (80% of the meter)
      let meterPos = 0;
      if (db < -60) {
        meterPos = 0;
      } else if (db < 0) {
        // Map -60 to 0 into 0.0 to 0.8
        meterPos = ((db + 60) / 60) * 0.8;
      } else {
        // Map 0 to +12 into 0.8 to 1.0
        meterPos = 0.8 + (Math.min(db, 12) / 12) * 0.2;
      }

      // Smooth decay for the peak bar
      if (meterPos > peakRef.current) {
        peakRef.current = meterPos;
      } else {
        peakRef.current *= 0.95;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // --- Background ---
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // --- Draw the Segments ---
      const segmentCount = 60;
      const segmentGap = 1;
      const segmentWidth = (canvas.width / segmentCount) - segmentGap;

      for (let i = 0; i < segmentCount; i++) {
        const x = i * (segmentWidth + segmentGap);
        const ratio = i / segmentCount;
        
        // Determine Color based on position relative to 0dB (ratio 0.8)
        let color = '#1e3a8a'; // Default dim blue
        
        if (ratio <= meterPos) {
          if (ratio < 0.8) {
            // Under 0dB: Gradient Blue
            color = `rgb(${59 + ratio * 50}, ${130 + ratio * 100}, 246)`;
          } else if (ratio < 0.95) {
            // 0dB to +9dB: Warning Yellow/Orange
            color = '#fbbf24';
          } else {
            // Above +9dB: Peak Red
            color = '#ef4444';
          }
        } else {
          // Off state
          color = ratio < 0.8 ? '#0f172a' : (ratio < 0.95 ? '#271b01' : '#2d0a0a');
        }

        ctx.fillStyle = color;
        ctx.fillRect(x, 0, segmentWidth, canvas.height);
      }

      // --- 0dB Marker ---
      const zeroDbX = canvas.width * 0.8;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.fillRect(zeroDbX - 1, 0, 2, canvas.height);

      // --- Peak Hold Line ---
      if (peakRef.current > 0.01) {
        const peakX = peakRef.current * canvas.width;
        ctx.fillStyle = peakRef.current > 0.8 ? '#ef4444' : '#60a5fa';
        ctx.fillRect(peakX - 1, 0, 2, canvas.height);
      }
    };

    draw();
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [analyser]);

  return (
    <div className="flex flex-col gap-1 w-full max-w-[400px] group/vu">
      <div className="flex justify-between text-[7px] font-black text-slate-500 uppercase tracking-[0.1em] px-0.5">
        <span>-60</span>
        <span>-30</span>
        <span>-15</span>
        <span className="text-blue-400 font-bold">-6</span>
        <span className="text-blue-300 font-bold">0dB</span>
        <span className="text-yellow-500">+6</span>
        <span className="text-red-500">+12</span>
      </div>
      <div className="relative h-4 bg-slate-950 rounded-sm overflow-hidden border border-slate-800/50 shadow-[inset_0_1px_4px_rgba(0,0,0,0.8)]">
        <canvas 
          ref={canvasRef} 
          width={800} // Higher resolution for crisp segments
          height={16} 
          className="w-full h-full"
        />
        {/* Subtle glass reflection */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none"></div>
      </div>
    </div>
  );
};
