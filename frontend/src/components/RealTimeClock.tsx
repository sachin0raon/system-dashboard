import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock } from 'lucide-react';

export function RealTimeClock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatHours = (date: Date) => {
    let hours = date.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    return { 
      hh: hours.toString().padStart(2, '0'), 
      mm: date.getMinutes().toString().padStart(2, '0'),
      ss: date.getSeconds().toString().padStart(2, '0'),
      period: ampm 
    };
  };

  const formatDate = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = { weekday: 'short', day: '2-digit', month: 'short' };
    return date.toLocaleDateString('en-US', options);
  };

  const { hh, mm, ss, period } = formatHours(time);

  return (
    <div className="flex flex-col items-end justify-center select-none">
      {/* Top Line: Time + Icon */}
      <div className="flex items-center gap-2">
        <motion.div
           animate={{ opacity: [0.4, 1, 0.4] }}
           transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
           className="flex items-center justify-center"
        >
          <Clock className="w-3.5 h-3.5 text-primary" style={{ filter: 'drop-shadow(0 0 4px var(--color-primary-glow))' }} />
        </motion.div>
        
        <div className="flex items-baseline font-mono font-bold text-lg tracking-tighter text-white">
          <span>{hh}</span>
          <span className="text-primary mx-0.5">:</span>
          <span>{mm}</span>
          
          {/* Animated Rolling Seconds */}
          <div className="flex flex-col h-[1.2em] overflow-hidden ml-1.5 w-[2ch] relative">
            <AnimatePresence mode="popLayout">
              <motion.span
                key={ss}
                initial={{ y: "100%", opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: "-100%", opacity: 0 }}
                transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                className="text-primary absolute inset-0 text-center"
              >
                {ss}
              </motion.span>
            </AnimatePresence>
          </div>

          <span className="ml-2 text-[10px] leading-none px-1.5 py-0.5 rounded-md bg-primary-dim border border-primary-border text-primary uppercase translate-y-[-2px]">
            {period}
          </span>
        </div>
      </div>

      {/* Bottom Line: Date */}
      <div 
        className="text-[10px] font-medium text-secondary uppercase mt-0.5" 
        style={{ letterSpacing: '0.25em' }}
      >
        {formatDate(time)}
      </div>
    </div>
  );
}
