import React, { useState } from 'react';
import { motion } from 'framer-motion';

/**
 * WelcomeBanner Component
 * Replicates a color bar visual effect with centered characters.
 * 
 * NOTE: For the 'Montserrat' font, add this to your index.html:
 * <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@700&display=swap" rel="stylesheet">
 */

const WelcomeBanner: React.FC = () => {
  const characters = ['W', 'e', 'l', 'c', 'o', 'm', 'e'];
  
  // High-impact colors that align with the Premium Dark portfolio theme
  const barColors = [
    'bg-indigo-600',
    'bg-cyan-500',
    'bg-amber-500',
    'bg-emerald-500',
    'bg-rose-500',
    'bg-violet-600',
    'bg-sky-500',
    'bg-transparent',
    'bg-orange-500',
    'bg-indigo-500',
  ];

  const textColors = [
    'text-indigo-100',
    'text-cyan-100',
    'text-amber-100',
    'text-emerald-100',
    'text-rose-100',
    'text-violet-100',
    'text-sky-100',
    'text-white',
    'text-orange-100',
    'text-cyan-200',
  ];

  // Particle type
  interface Particle {
    id: number;
    width: string;
    height: string;
    left: string;
    xShift: string;
    duration: number;
    delay: number;
    color: string;
  }

  // Stable random particles using lazy state initialization to avoid impurity errors
  const [particles] = useState<Particle[]>(() => 
    [...Array(30)].map((_, i) => ({
      id: i,
      width: (Math.random() * 3 + 2) + 'px',
      height: (Math.random() * 3 + 2) + 'px',
      left: (Math.random() * 100) + '%',
      xShift: (Math.random() * 80 - 40) + 'px',
      duration: Math.random() * 4 + 6,
      delay: Math.random() * 4,
      color: i % 2 === 0 ? 'bg-cyan-400/20' : 'bg-amber-400/20'
    }))
  );

  return (
    <div className="fixed inset-0 w-full h-full overflow-hidden flex bg-slate-950 z-100">
      {/* Antigravity Particles (Visible after bars start leaving) */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        {particles.map((p) => (
          <motion.div
            key={p.id}
            className={`absolute rounded-full ${p.color} blur-[1px]`}
            style={{
              width: p.width,
              height: p.height,
              left: p.left,
              top: '105%',
            }}
            initial={{ opacity: 0 }}
            animate={{ 
              y: '-110vh', 
              opacity: [0, 1, 1, 0],
              x: p.xShift
            }}
            transition={{
              duration: p.duration,
              repeat: Infinity,
              delay: p.delay,
              ease: "linear"
            }}
          />
        ))}
      </div>

      {/* The Color Bars Animation */}
      {characters.map((_, index) => (
        <motion.div
          key={`bar-${index}`}
          className={`absolute inset-y-0 ${barColors[index % barColors.length]} opacity-100 z-10`}
          style={{ 
            left: `${(index / characters.length) * 100}%`, 
            width: `${100 / characters.length}%` 
          }}
          initial={{ y: "100%" }}
          animate={{ y: ["100%", "0%", "-100%"] }}
          transition={{ 
            delay: index * 0.08, 
            duration: 2.2, 
            times: [0, 0.4, 1],
            ease: "easeInOut" 
          }}
        />
      ))}

      {/* The "Welcome :)" Characters */}
      <div className="relative flex-1 flex flex-col items-center justify-center pointer-events-none z-20 w-full px-4">
        <div className="flex flex-wrap justify-center gap-2 md:gap-4 lg:gap-8 max-w-full">
          {characters.map((char, index) => (
            <motion.span
              key={`char-${index}`}
              className={`text-6xl md:text-8xl lg:text-[14rem] font-black drop-shadow-[0_0_50px_rgba(255,255,255,0.1)] ${textColors[index % textColors.length] || 'text-white'}`}
              initial={{ opacity: 0, scale: 0.7, filter: 'blur(15px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              transition={{ delay: 1.2 + (index * 0.03), duration: 0.8, ease: "easeOut" }}
              style={{ 
                fontFamily: "'Montserrat', sans-serif", 
                fontWeight: 900,
                letterSpacing: '-0.05em' 
              }}
            >
              {char}
            </motion.span>
          ))}
        </div>
      </div>

      {/* Background Glow Overlay when bars are gone */}
      <motion.div 
        className="absolute inset-0 bg-radial-[circle_at_center,rgba(59,130,246,0.1)_0%,transparent_80%] pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.5, duration: 1 }}
      />
    </div>
  );
};

export default WelcomeBanner;
