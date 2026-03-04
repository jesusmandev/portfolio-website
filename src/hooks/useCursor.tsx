import React, { useEffect, useState } from 'react';

// eslint-disable-next-line react-refresh/only-export-components
export const useCursor = () => {
  const [particles, setParticles] = useState<{ id: string; x: number; y: number; color: string; size: number; dx: number; dy: number }[]>([]);

  useEffect(() => {
    const colors = ['#7c3aed', '#06b6d4', '#a855f7'];
    const animationFrame = 0;
    let lastTime = 0;

    const handleMouseMove = (e: MouseEvent) => {
      const now = performance.now();
      if (now - lastTime < 30) { 
        return; // throttle particles creation
      }
      lastTime = now;
      
      const size = Math.random() * 6 + 4;
      const color = colors[Math.floor(Math.random() * colors.length)];
      const dx = (Math.random() - 0.5) * 50;
      const dy = (Math.random() - 0.5) * 50;
      
      const newParticle = {
        id: Math.random().toString(36).substr(2, 9),
        x: e.clientX,
        y: e.clientY,
        color,
        size,
        dx,
        dy
      };

      setParticles(prev => [...prev, newParticle]);

      setTimeout(() => {
        setParticles(prev => prev.filter(p => p.id !== newParticle.id));
      }, 600);
    };

    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrame);
    };
  }, []);

  return particles;
};

export const CursorParticles: React.FC = () => {
  const particles = useCursor();

  return (
    <>
      {particles.map(p => (
        <div
          key={p.id}
          className="cursor-particle"
          style={{
            width: `${p.size}px`,
            height: `${p.size}px`,
            background: p.color,
            boxShadow: `0 0 10px ${p.color}`,
            left: `${p.x - p.size / 2}px`,
            top: `${p.y - p.size / 2}px`,
            '--dx': `${p.dx}px`,
            '--dy': `${p.dy}px`
          } as React.CSSProperties}
        />
      ))}
    </>
  );
};
