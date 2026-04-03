import React, { useEffect, useState } from 'react';
import BlurText from './BlurText';
import WelcomeBanner from './WelcomeBanner';

interface LoaderProps {
  onComplete: () => void;
}

const Loader: React.FC<LoaderProps> = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    // Delay progress until WelcomeBanner animation is well underway (after ~2.5s)
    const delayTimer = setTimeout(() => {
      const duration = 2500;
      const startTime = performance.now();

      const progressInterval = setInterval(() => {
        const elapsedTime = performance.now() - startTime;
        let newProgress = (elapsedTime / duration) * 100;

        if (newProgress >= 100) {
          newProgress = 100;
          setProgress(100);
          clearInterval(progressInterval);
          setTimeout(() => setIsCompleted(true), 400);
        } else {
          setProgress(newProgress);
        }
      }, 16);

      return () => {
        clearInterval(progressInterval);
      };
    }, 2500);

    return () => clearTimeout(delayTimer);
  }, []);

  useEffect(() => {
    if (isCompleted) {
      const handleStart = (e?: Event | KeyboardEvent | MouseEvent) => {
        if (e && e.type === 'keydown' && (e as KeyboardEvent).key !== 'Enter') {
          return;
        }
        onComplete();
        document.body.removeEventListener('click', handleStart as EventListener);
        document.removeEventListener('keydown', handleStart as EventListener);
      };

      document.body.addEventListener('click', handleStart as EventListener, { once: true });
      document.addEventListener('keydown', handleStart as EventListener);

      return () => {
        document.body.removeEventListener('click', handleStart as EventListener);
        document.removeEventListener('keydown', handleStart as EventListener);
      };
    }
  }, [isCompleted, onComplete]);

  const roundedProgress = Math.round(progress);

  return (
    <div className={`loader-container show fixed inset-0 z-100 bg-slate-950 flex flex-col items-center justify-center`}>
      <WelcomeBanner />
      
      {/* Floating "Haga clic" prompt at the bottom */}
      <div className="absolute bottom-12 left-0 right-0 z-110 flex justify-center pointer-events-none">
        {isCompleted ? (
          <div className="animate-bounce">
            <BlurText
              text="Haga clic para iniciar"
              delay={100}
              animateBy="words"
              direction="bottom"
              color="var(--accent-2)"
              className="text-2xl md:text-3xl font-bold opacity-90 drop-shadow-lg"
            />
          </div>
        ) : roundedProgress >= 100 ? '' : (
          <span className="text-white/30 font-mono text-sm tracking-widest uppercase animate-pulse">
            Cargando {roundedProgress}%
          </span>
        )}
      </div>
    </div>
  );
};

export default Loader;
