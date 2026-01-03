
import React, { useState, useEffect } from 'react';

interface CountdownProps {
  targetDate: Date;
  label: string;
  onComplete?: () => void;
}

const Countdown: React.FC<CountdownProps> = ({ targetDate, label, onComplete }) => {
  const [timeLeft, setTimeLeft] = useState<{ d: number; h: number; m: number; s: number } | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date().getTime();
      const distance = targetDate.getTime() - now;

      if (distance < 0) {
        clearInterval(timer);
        setTimeLeft(null);
        if (onComplete) onComplete();
        return;
      }

      setTimeLeft({
        d: Math.floor(distance / (1000 * 60 * 60 * 24)),
        h: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        m: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
        s: Math.floor((distance % (1000 * 60)) / 1000),
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [targetDate, onComplete]);

  if (!timeLeft) return null;

  return (
    <div className="flex flex-col items-center gap-2 glass-effect p-4 rounded-xl border border-blue-500/30">
      <span className="text-xs uppercase tracking-widest text-blue-400 font-bold">{label}</span>
      <div className="flex gap-4">
        {[
          { v: timeLeft.d, l: 'D' },
          { v: timeLeft.h, l: 'H' },
          { v: timeLeft.m, l: 'M' },
          { v: timeLeft.s, l: 'S' },
        ].map((item, i) => (
          <div key={i} className="flex flex-col items-center">
            <span className="text-2xl font-black text-white">{item.v.toString().padStart(2, '0')}</span>
            <span className="text-[10px] text-gray-400 font-bold">{item.l}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Countdown;
