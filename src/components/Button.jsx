import React, { useState, useLayoutEffect, useRef } from 'react';

const Button = ({ onClick, durationMs = 2500 }) => {
  const [phase, setPhase] = useState('idle'); // idle | pressing | shrinking
  const btnRef = useRef(null);
  const timerRef = useRef(null);

  // Cleanup on unmount
  useLayoutEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleClick = () => {
    if (phase !== 'idle') return;

    // Phase 1: slight press-down (instant visual feedback)
    setPhase('pressing');

    // Phase 2: one animation frame later → trigger the shrink transition
    // Using rAF ensures the browser has painted "pressing" state before we
    // change to "shrinking", so the CSS transition actually fires.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setPhase('shrinking');
      });
    });

    // Phase 3: after shrink animation completes → notify parent
    timerRef.current = setTimeout(() => {
      if (onClick) onClick();
    }, durationMs);
  };

  // Compute inline styles based on phase — no class toggling, no style tag issues
  const getButtonStyle = () => {
    const base = {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.75rem',
      padding: '1.1rem 3.5rem',
      borderRadius: '9999px',
      backgroundColor: phase === 'pressing' ? '#141826' : '#1E2336',
      color: 'white',
      fontFamily: "'Chewy', cursive, sans-serif",
      fontSize: '1.6rem',
      letterSpacing: '0.05em',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      cursor: phase === 'idle' ? 'pointer' : 'default',
      position: 'relative',
      userSelect: 'none',
      outline: 'none',
      // The transition is ALWAYS present — this is key for the animation to work
      transition: `
        transform ${durationMs / 1000}s cubic-bezier(0.4, 0, 1, 1),
        opacity   ${(durationMs * 0.7) / 1000}s cubic-bezier(0.4, 0, 1, 1) ${(durationMs * 0.3) / 1000}s,
        box-shadow 0.2s ease,
        background-color 0.2s ease
      `,
      willChange: 'transform, opacity',
    };

    if (phase === 'idle') {
      return {
        ...base,
        transform: 'scale(1) translateY(0)',
        opacity: 1,
        boxShadow: '0 6px 0 #0F131D, 0 10px 20px rgba(0,0,0,0.4), inset 0 1px 1px rgba(255,255,255,0.1)',
      };
    }

    if (phase === 'pressing') {
      return {
        ...base,
        transform: 'scale(1) translateY(2px)',
        opacity: 1,
        boxShadow: '0 3px 0 #0F131D, 0 5px 10px rgba(0,0,0,0.3)',
      };
    }

    // phase === 'shrinking': animate to scale(0) opacity(0)
    return {
      ...base,
      transform: 'scale(0)',
      opacity: 0,
      boxShadow: 'none',
      pointerEvents: 'none',
    };
  };

  const getArrowStyle = () => ({
    transition: 'transform 0.2s ease-in-out',
    width: '26px',
    height: '26px',
  });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Chewy&display=swap');

        .explore-btn-3d:hover {
          transform: scale(1.03) translateY(-3px) !important;
          background-color: #262D45 !important;
          box-shadow: 0 9px 0 #0F131D, 0 15px 25px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.15) !important;
        }

        .explore-btn-3d:hover .explore-btn-arrow {
          transform: translateX(6px);
        }

        .explore-btn-arrow {
          transition: transform 0.2s ease-in-out;
        }
      `}</style>

      <button
        ref={btnRef}
        type="button"
        className={phase === 'idle' ? 'explore-btn-3d' : ''}
        style={getButtonStyle()}
        onClick={handleClick}
        aria-label="Explorar contenido"
      >
        <span>Explore</span>
        <svg
          className="explore-btn-arrow"
          style={getArrowStyle()}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7m0 0l-7 7m7-7H3" />
        </svg>
      </button>
    </>
  );
};

export default Button;
