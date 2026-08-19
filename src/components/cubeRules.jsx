import React, { useState, useEffect, useCallback } from 'react';

export const CubeRulesModal = ({ isOpen: propIsOpen, onClose: propOnClose }) => {
  const [isNear, setIsNear] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showShuffleBtn, setShowShuffleBtn] = useState(true);
  const [showRulesPanel, setShowRulesPanel] = useState(false);

  // Listen for global events from the 3D engine (rubikCube.js)
  useEffect(() => {
    const onNear = () => setIsNear(true);
    const onFar = () => setIsNear(false);
    const onPlayStart = () => {
      setIsPlaying(true);
      setShowShuffleBtn(true);
      setShowRulesPanel(false);
    };
    const onPlayEnd = () => {
      setIsPlaying(false);
      setShowRulesPanel(false);
    };

    window.addEventListener('rubik:near', onNear);
    window.addEventListener('rubik:far', onFar);
    window.addEventListener('rubik:play-start', onPlayStart);
    window.addEventListener('rubik:play-end', onPlayEnd);

    return () => {
      window.removeEventListener('rubik:near', onNear);
      window.removeEventListener('rubik:far', onFar);
      window.removeEventListener('rubik:play-start', onPlayStart);
      window.removeEventListener('rubik:play-end', onPlayEnd);
    };
  }, []);

  const handleShuffleClick = useCallback(() => {
    window.dispatchEvent(new CustomEvent('rubik:shuffle'));
    setShowShuffleBtn(false); // Disappears once clicked
  }, []);

  const handleExitClick = useCallback(() => {
    window.dispatchEvent(new CustomEvent('rubik:exit'));
  }, []);

  return (
    <>
      {/* HUD 1: "Press ENTER to Play" prompt when near the cube */}
      <div
        style={{
          position: 'fixed',
          bottom: '82px',
          left: '50%',
          transform: `translateX(-50%) translateY(${isNear && !isPlaying ? '0px' : '20px'})`,
          background: 'linear-gradient(135deg, rgba(15,23,42,0.95), rgba(30,41,59,0.92), rgba(0,180,219,0.85))',
          color: '#f8fbff',
          fontFamily: '"Segoe UI", system-ui, sans-serif',
          fontSize: '16px',
          fontWeight: 700,
          letterSpacing: '0.06em',
          padding: '12px 28px',
          borderRadius: '999px',
          border: '1px solid rgba(0,180,219,0.7)',
          pointerEvents: isNear && !isPlaying ? 'auto' : 'none',
          zIndex: 9999,
          opacity: isNear && !isPlaying ? 1 : 0,
          userSelect: 'none',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 0 0 1px rgba(255,255,255,0.1), 0 0 24px rgba(0,180,219,0.5), 0 0 45px rgba(0,131,176,0.3)',
          textShadow: '0 0 12px rgba(0,212,255,0.75)',
          transition: 'opacity 0.25s ease, transform 0.25s ease',
          cursor: 'pointer'
        }}
        onClick={() => window.dispatchEvent(new CustomEvent('rubik:enter-play'))}
      >
        🧨 <span style={{ display: 'inline-block', padding: '2px 6px', borderRadius: '999px', background: 'rgba(255,255,255,0.12)' }}>Press</span>{' '}
        <strong style={{ color: '#fef3c7', background: 'linear-gradient(135deg,#00b4db,#0083b0)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', textShadow: 'none', fontSize: '18px' }}>
          ENTER
        </strong>{' '}
        <span>to Play the Rubik's Cube</span>
      </div>

      {/* GAME MODE: Floating control bar while playing */}
      {isPlaying && (
        <>
          {/* Shuffle button (Top Center) - disappears once clicked */}
          {showShuffleBtn && (
            <div
              style={{
                position: 'fixed',
                top: '24px',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 10000,
                animation: 'fadeInDown 0.3s ease'
              }}
            >
              <button
                onClick={handleShuffleClick}
                style={{
                  padding: '12px 28px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  background: 'linear-gradient(135deg, #00b4db, #0083b0)',
                  color: 'white',
                  border: '1px solid rgba(255,255,255,0.3)',
                  borderRadius: '30px',
                  cursor: 'pointer',
                  boxShadow: '0 6px 20px rgba(0, 180, 219, 0.6), 0 0 30px rgba(0, 131, 176, 0.4)',
                  transition: 'all 0.2s ease',
                  backdropFilter: 'blur(8px)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                🔀 Shuffle Cube
              </button>
            </div>
          )}

          {/* Rules & Controls button (Top Right) */}
          <div
            style={{
              position: 'fixed',
              top: '24px',
              right: '24px',
              zIndex: 10000,
              display: 'flex',
              gap: '10px'
            }}
          >
            <button
              onClick={() => setShowRulesPanel(prev => !prev)}
              style={{
                padding: '10px 20px',
                fontSize: '14px',
                fontWeight: '700',
                background: showRulesPanel ? 'rgba(0, 180, 219, 0.9)' : 'rgba(15, 23, 42, 0.85)',
                color: '#f8fafc',
                border: '1px solid rgba(0, 180, 219, 0.5)',
                borderRadius: '20px',
                cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(0,0,0,0.4)',
                backdropFilter: 'blur(10px)',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              ⌨️ {showRulesPanel ? 'Hide Rules' : 'Rules & Controls'}
            </button>

            {/* Exit / ESC button */}
            <button
              onClick={handleExitClick}
              style={{
                padding: '10px 18px',
                fontSize: '14px',
                fontWeight: '700',
                background: 'rgba(239, 68, 68, 0.85)',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '20px',
                cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(239, 68, 68, 0.4)',
                backdropFilter: 'blur(10px)',
                transition: 'all 0.2s ease'
              }}
            >
              🚶 Exit (ESC)
            </button>
          </div>

          {/* Collapsible side panel: Rules & Key bindings */}
          {showRulesPanel && (
            <div
              style={{
                position: 'fixed',
                top: '76px',
                right: '24px',
                width: '380px',
                maxHeight: '75vh',
                background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.96), rgba(30, 41, 59, 0.94))',
                border: '1px solid rgba(0, 180, 219, 0.4)',
                boxShadow: '0 10px 40px rgba(0,0,0,0.7), 0 0 30px rgba(0, 180, 219, 0.25)',
                borderRadius: '20px',
                zIndex: 10000,
                padding: '20px 22px',
                overflowY: 'auto',
                color: '#f8fafc',
                backdropFilter: 'blur(14px)',
                fontFamily: '"Segoe UI", system-ui, sans-serif'
              }}
            >
              <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 700, color: '#00b4db', display: 'flex', alignItems: 'center', gap: '8px' }}>
                ⌨️ KEY GUIDE (ONE AT A TIME)
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px', fontSize: '13px', lineHeight: '1.4' }}>
                <div style={{ background: 'rgba(255,255,255,0.04)', padding: '7px 10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <strong style={{ color: '#fef3c7' }}>U</strong> → rotates the top layer (clockwise when viewed from above)<br />
                  <span style={{ color: '#94a3b8' }}>Uppercase U (Shift+U) → rotates the top layer in reverse (counter-clockwise)</span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.04)', padding: '7px 10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <strong style={{ color: '#fef3c7' }}>D</strong> → rotates the bottom layer (clockwise when viewed from below)<br />
                  <span style={{ color: '#94a3b8' }}>Uppercase D (Shift+D) → rotates the bottom layer in reverse (counter-clockwise)</span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.04)', padding: '7px 10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <strong style={{ color: '#fef3c7' }}>L</strong> → rotates the left layer (clockwise when viewed from the left)<br />
                  <span style={{ color: '#94a3b8' }}>Uppercase L (Shift+L) → rotates the left layer in reverse (counter-clockwise)</span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.04)', padding: '7px 10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <strong style={{ color: '#fef3c7' }}>R</strong> → rotates the right layer (clockwise when viewed from the right)<br />
                  <span style={{ color: '#94a3b8' }}>Uppercase R (Shift+R) → rotates the right layer in reverse (counter-clockwise)</span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.04)', padding: '7px 10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <strong style={{ color: '#fef3c7' }}>F</strong> → rotates the front layer (clockwise when viewed from the front)<br />
                  <span style={{ color: '#94a3b8' }}>Uppercase F (Shift+F) → rotates the front layer in reverse (counter-clockwise)</span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.04)', padding: '7px 10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <strong style={{ color: '#fef3c7' }}>B</strong> → rotates the back layer (clockwise when viewed from behind)<br />
                  <span style={{ color: '#94a3b8' }}>Uppercase B (Shift+B) → rotates the back layer in reverse (counter-clockwise)</span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.04)', padding: '7px 10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <strong style={{ color: '#fef3c7' }}>M</strong> → rotates the middle slice between L and R (same direction as L)<br />
                  <span style={{ color: '#94a3b8' }}>Uppercase M (Shift+M) → rotates that middle slice in reverse</span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.04)', padding: '7px 10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <strong style={{ color: '#fef3c7' }}>E</strong> → rotates the middle slice between U and D (same direction as D)<br />
                  <span style={{ color: '#94a3b8' }}>Uppercase E (Shift+E) → rotates that middle slice in reverse</span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.04)', padding: '7px 10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <strong style={{ color: '#fef3c7' }}>S</strong> → rotates the middle slice between F and B (same direction as F)<br />
                  <span style={{ color: '#94a3b8' }}>Uppercase S (Shift+S) → rotates that middle slice in reverse</span>
                </div>
              </div>

              <div
                style={{
                  marginTop: '10px',
                  padding: '10px 12px',
                  background: 'rgba(0, 180, 219, 0.1)',
                  border: '1px solid rgba(0, 180, 219, 0.3)',
                  borderRadius: '10px',
                  fontSize: '12px',
                  color: '#e2e8f0',
                  lineHeight: '1.4'
                }}
              >
                <strong style={{ color: '#00b4db' }}>📌 General rule:</strong> each letter always moves the same layer; uppercase (or Shift) simply reverses the rotation direction, and applying both in sequence leaves the cube exactly as it was.
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
};

export default CubeRulesModal;
