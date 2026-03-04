import React, { useEffect, useState } from 'react';

interface LoaderProps {
  onComplete: () => void;
}

const Loader: React.FC<LoaderProps> = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [isRunner, setIsRunner] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isIdle, setIsIdle] = useState(false);

  useEffect(() => {
    const runnerInterval = setInterval(() => {
      setIsRunner((prev) => !prev);
    }, 250);

    const duration = 2500;
    const startTime = performance.now();

    const progressInterval = setInterval(() => {
      const elapsedTime = performance.now() - startTime;
      let newProgress = (elapsedTime / duration) * 100;

      if (newProgress >= 100) {
        newProgress = 100;
        setProgress(100);
        clearInterval(progressInterval);
        clearInterval(runnerInterval);
        setTimeout(() => setIsCompleted(true), 400);
      } else {
        setProgress(newProgress);
      }
    }, 16);

    return () => {
      clearInterval(runnerInterval);
      clearInterval(progressInterval);
    };
  }, []);

  useEffect(() => {
    if (isCompleted) {
      const idleTimeout = setTimeout(() => {
        setIsIdle(true);
      }, 2000);

      const handleStart = (e?: KeyboardEvent | MouseEvent) => {
        if (e && e.type === 'keydown' && (e as KeyboardEvent).key !== 'Enter') {
          return;
        }
        clearTimeout(idleTimeout);
        onComplete();
        document.body.removeEventListener('click', handleStart);
        document.removeEventListener('keydown', handleStart);
      };

      document.body.addEventListener('click', handleStart, { once: true });
      document.addEventListener('keydown', handleStart);

      return () => {
        clearTimeout(idleTimeout);
        document.body.removeEventListener('click', handleStart);
        document.removeEventListener('keydown', handleStart);
      };
    }
  }, [isCompleted, onComplete]);

  const roundedProgress = Math.round(progress);

  return (
    <div className={`loader-container show`}>
      <div className="loader-inner">
        <div className="loader-logo">BIENVENIDO</div>
        <div className="loader-bar-wrap">
          <div
            className={`loader-runner ${isCompleted ? 'stopped' : ''}`}
            id="loaderRunner"
            style={{ left: `calc(${roundedProgress}% - 10px)` }}
          >
            {isIdle ? (
              <img src="https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f937-200d-2642-fe0f.png" alt="shrug" />
            ) : isCompleted ? (
              <img src="https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f575-fe0f-200d-2642-fe0f.png" alt="detective" />
            ) : isRunner ? (
              '🏃'
            ) : (
              '🚶'
            )}
          </div>
          <div className="loader-bar" style={{ width: `${roundedProgress}%` }}></div>
          {/* Idle Bubble */}
          <div
            className="thought-bubble"
            id="loaderBubble"
            style={{ opacity: isIdle ? 1 : 0, transform: isIdle ? 'translateY(0)' : 'translateY(10px)' }}
          >
            Por favor, haga clic para continuar
          </div>
        </div>
        <div 
          className="loader-percentage"
          style={isCompleted ? { letterSpacing: '2px', fontSize: '0.9rem', opacity: 0.8, cursor: 'pointer' } : {}}
        >
          {isCompleted ? 'Haga clic para iniciar' : roundedProgress >= 100 ? '' : `${roundedProgress}%`}
        </div>
      </div>
    </div>
  );
};

export default Loader;
