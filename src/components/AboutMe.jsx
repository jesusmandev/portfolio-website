import React, { useState, useEffect, useCallback, useRef } from 'react';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

/**
 * AboutMe
 *
 * Listens for CustomEvents from the game's flame system:
 *  - 'flame:near'  → shows the "Press Enter" prompt
 *  - 'flame:far'   → hides the prompt
 *  - 'flame:open'  → opens the modal (dispatched by StatueLights on Enter press)
 */
const AboutMe = () => {
  const [isNear, setIsNear] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const modalContainerRef = useRef(null);
  const modalContentRef = useRef(null);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  useEffect(() => {
    const onNear  = () => setIsNear(true);
    const onFar   = () => setIsNear(false);
    const onOpen  = () => { setIsOpen(true); };

    window.addEventListener('flame:near', onNear);
    window.addEventListener('flame:far',  onFar);
    window.addEventListener('flame:open', onOpen);

    return () => {
      window.removeEventListener('flame:near', onNear);
      window.removeEventListener('flame:far',  onFar);
      window.removeEventListener('flame:open', onOpen);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.code === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Lenis configuration for ultra-smooth, lag-free scrolling inside the modal
  useEffect(() => {
    if (!isOpen || !modalContainerRef.current) return;

    const container = modalContainerRef.current;
    const content = modalContentRef.current || container;

    const lenis = new Lenis({
      wrapper: container,
      content: content,
      duration: 1.0,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 0.9,
      touchMultiplier: 1.5,
      infinite: false,
    });

    let animationFrameId;
    function raf(time) {
      lenis.raf(time);
      animationFrameId = requestAnimationFrame(raf);
    }
    animationFrameId = requestAnimationFrame(raf);

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      lenis.destroy();
    };
  }, [isOpen]);

  const baseUrl = import.meta.env.BASE_URL || '/';

  const skills = [
    { icon: '🎨', title: 'Design to Code',              desc: 'Pixel-perfect fidelity, no surprises' },
    { icon: '🚀', title: 'Converting Landing Pages',     desc: 'Results-focused, not just aesthetics' },
    { icon: '◎',  title: 'Responsive Design',            desc: 'Perfect on any device' },
    { icon: '⚡', title: 'High Performance',             desc: 'Fast loading, optimized code' },
    { icon: '🧊', title: '3D Experiences',               desc: 'Immersive interfaces with Three.js' },
  ];

  return (
    <>
      {/* ── "PRESS ENTER" PROMPT ── */}
      <div
        style={{
          position: 'fixed',
          bottom: '10%',
          left: '50%',
          transform: `translateX(-50%) translateY(${isNear ? '0px' : '30px'})`,
          opacity: isNear && !isOpen ? 1 : 0,
          pointerEvents: 'none',
          zIndex: 9999,
          transition: 'opacity 0.5s cubic-bezier(0.25,1,0.5,1), transform 0.5s cubic-bezier(0.25,1,0.5,1)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        {/* Floating flame particles (Blue) */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '4px' }}>
          {[0, 1, 2].map(i => (
            <div
              key={i}
              style={{
                width: '5px',
                height: '5px',
                borderRadius: '50%',
                background: `rgba(0,${150 + i * 40},255,0.9)`,
                animation: `flameParticle 1.4s ease-in-out infinite`,
                animationDelay: `${i * 0.25}s`,
                boxShadow: `0 0 8px rgba(0,180,255,0.9)`,
              }}
            />
          ))}
        </div>

        {/* Label text */}
        <p style={{
          color: 'rgba(150,220,255,0.85)',
          fontSize: '11px',
          fontFamily: 'Inter, -apple-system, sans-serif',
          fontWeight: 600,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          textShadow: '0 0 20px rgba(0,140,255,0.6)',
          margin: 0,
        }}>
          Interact
        </p>

        {/* Enter key box (Blue style) */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '56px',
            height: '38px',
            borderRadius: '9px',
            background: 'rgba(5,15,30,0.7)',
            border: '1.5px solid rgba(0,160,255,0.55)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            boxShadow: '0 0 24px rgba(0,120,255,0.35), inset 0 1px 0 rgba(100,220,255,0.15)',
            animation: 'enterPulse 2.2s ease-in-out infinite',
          }}>
            {/* SVG Enter key arrow */}
            <svg width="24" height="18" viewBox="0 0 24 18" fill="none">
              <path d="M18 2V9H4" stroke="rgba(100,200,255,0.95)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M7.5 5.5L4 9L7.5 12.5" stroke="rgba(100,200,255,0.95)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span style={{
            color: 'rgba(100,210,255,0.85)',
            fontSize: '14px',
            fontFamily: 'Inter, sans-serif',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textShadow: '0 0 18px rgba(0,140,255,0.5)',
          }}>
            ENTER
          </span>
        </div>

        {/* Glow halo */}
        <div style={{
          position: 'absolute',
          bottom: '-25px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '140px',
          height: '45px',
          background: 'radial-gradient(ellipse, rgba(0,120,255,0.22) 0%, transparent 70%)',
          filter: 'blur(10px)',
          pointerEvents: 'none',
        }} />
      </div>

      {/* ── ABOUT ME MODAL ── */}
      {isOpen && (
        <div
          onClick={handleClose}
          onWheel={e => e.stopPropagation()}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.82)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            animation: 'backdropIn 0.35s ease',
            transform: 'translateZ(0)',
          }}
        >
          {/* Scroll container with Lenis & hardware acceleration */}
          <div
            ref={modalContainerRef}
            onClick={e => e.stopPropagation()}
            onWheel={e => e.stopPropagation()}
            className="aboutme-modal-scroll"
            style={{
              position: 'relative',
              width: 'min(92vw, 960px)',
              maxHeight: '88vh',
              overflowY: 'auto',
              background: 'rgba(7,9,14,0.96)',
              border: '1px solid rgba(0,150,255,0.2)',
              borderRadius: '24px',
              boxShadow: '0 0 100px rgba(0,120,255,0.1), 0 40px 100px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.06)',
              animation: 'modalSlideUp 0.45s cubic-bezier(0.25,1,0.5,1)',
              willChange: 'transform',
              transform: 'translateZ(0)',
              overscrollBehavior: 'contain',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {/* Inner content for Lenis */}
            <div ref={modalContentRef}>
              {/* Top flame glow (Blue) */}
              <div style={{
                position: 'absolute',
                top: 0, left: '50%',
                transform: 'translateX(-50%) translateY(-50%)',
                width: '350px',
                height: '180px',
                background: 'radial-gradient(ellipse, rgba(0,140,255,0.15) 0%, transparent 70%)',
                pointerEvents: 'none',
                zIndex: 0,
              }} />

              {/* HEADER */}
              <div style={{
                position: 'relative',
                zIndex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '24px 32px 18px',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <img
                    src={`${baseUrl}picture 4/About_me.png`}
                    alt="About Me Icon"
                    style={{ width: '26px', height: '26px', objectFit: 'contain' }}
                  />
                  <span style={{
                    color: 'rgba(100,190,255,0.75)',
                    fontSize: '11px',
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 700,
                    letterSpacing: '0.28em',
                    textTransform: 'uppercase',
                  }}>
                    ABOUT ME
                  </span>
                </div>
                <button
                  onClick={handleClose}
                  style={{
                    width: '34px', height: '34px',
                    borderRadius: '9px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: 'rgba(255,255,255,0.45)',
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '20px',
                    lineHeight: 1,
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'rgba(0,150,255,0.15)';
                    e.currentTarget.style.borderColor = 'rgba(0,150,255,0.4)';
                    e.currentTarget.style.color = '#00a0ff';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                    e.currentTarget.style.color = 'rgba(255,255,255,0.45)';
                  }}
                >
                  ×
                </button>
              </div>

              {/* BODY: 2 columns */}
              <div style={{
                position: 'relative', zIndex: 1,
                display: 'grid',
                gridTemplateColumns: '220px 1fr',
                minHeight: '400px',
              }}>
                {/* Left column — photo + chips */}
                <div style={{
                  padding: '32px 24px 32px 32px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '18px',
                  borderRight: '1px solid rgba(255,255,255,0.05)',
                }}>
                  {/* Foto */}
                  <div style={{ position: 'relative' }}>
                    <div style={{
                      position: 'absolute',
                      inset: '-14px',
                      borderRadius: '50%',
                      background: 'radial-gradient(circle, rgba(0,120,255,0.22) 0%, transparent 70%)',
                      animation: 'fireGlow 2.5s ease-in-out infinite alternate',
                    }} />
                    <div style={{
                      width: '148px', height: '148px',
                      borderRadius: '50%',
                      overflow: 'hidden',
                      border: '2px solid rgba(0,160,255,0.45)',
                      boxShadow: '0 0 35px rgba(0,120,255,0.18)',
                      background: 'rgba(0,120,255,0.04)',
                      position: 'relative',
                    }}>
                      <img
                        src={`${baseUrl}picture 2/JESUS'S_PICTURE.png`}
                        alt="Jesús Martínez"
                        style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 15%' }}
                      />
                    </div>
                  </div>

                  <div style={{ textAlign: 'center' }}>
                    <h3 style={{
                      color: '#fff', fontSize: '17px',
                      fontFamily: 'Inter, sans-serif', fontWeight: 800,
                      margin: '0 0 5px', letterSpacing: '-0.02em',
                    }}>
                      Jesús Martínez
                    </h3>
                    <p style={{
                      color: '#00a0ff', fontSize: '11px',
                      fontFamily: 'Inter, sans-serif', fontWeight: 600,
                      letterSpacing: '0.12em', textTransform: 'uppercase',
                      margin: 0, textShadow: '0 0 20px rgba(0,160,255,0.4)',
                    }}>
                      Frontend Developer
                    </p>
                  </div>

                  {[
                    { icon: '📍', text: 'Montería, Colombia' },
                    { icon: '💻', text: 'Frontend Developer' },
                    { icon: '🎨', text: 'UI Design' },
                    { icon: '🚀', text: 'Continuous Learner' },
                  ].map((chip, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      width: '100%', padding: '7px 11px', borderRadius: '8px',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.07)',
                      color: 'rgba(190,190,200,0.8)',
                      fontSize: '12px', fontFamily: 'Inter, sans-serif',
                    }}>
                      <span>{chip.icon}</span>
                      <span>{chip.text}</span>
                    </div>
                  ))}
                </div>

                {/* Right column — content */}
                <div style={{
                  padding: '32px 32px 32px 28px',
                  display: 'flex', flexDirection: 'column', gap: '22px',
                }}>
                  <div>
                    <h2 style={{
                      color: '#fff', fontSize: '28px',
                      fontFamily: 'Inter, sans-serif', fontWeight: 900,
                      letterSpacing: '-0.03em', margin: '0 0 10px', lineHeight: 1.2,
                    }}>
                      Hi, I'm Jesús Martínez.
                    </h2>
                    <p style={{
                      color: '#00a0ff', fontSize: '15px',
                      fontFamily: 'Inter, sans-serif', fontWeight: 600,
                      margin: 0, lineHeight: 1.55,
                      textShadow: '0 0 25px rgba(0,150,255,0.2)',
                    }}>
                      Frontend Developer — I turn ideas and designs into real websites that work and deliver results.
                    </p>
                  </div>

                  <p style={{
                    color: 'rgba(175,180,195,0.85)', fontSize: '14px',
                    fontFamily: 'Inter, sans-serif', fontWeight: 400,
                    lineHeight: 1.8, margin: 0,
                  }}>
                    Many businesses and projects get stuck between a great idea and a website that actually works. I bridge that gap: I take your Figma design or landing page concept and turn it into a real, fast, pixel-perfect site. I combine clean code with sharp attention to visual detail, so your digital presence not only looks great but loads fast, works on any device, and helps your business attract more clients. When the project calls for it, I also bring interactive 3D experiences with Three.js — that extra touch that makes a site memorable, not just visitable.
                  </p>

                  {/* Skills grid — 5 cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px' }}>
                    {skills.map((s, i) => (
                      <div key={i} style={{
                        padding: '14px 16px',
                        borderRadius: '11px',
                        background: 'rgba(255,255,255,0.025)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        transition: 'all 0.2s ease',
                        cursor: 'default',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = 'rgba(0,140,255,0.07)';
                        e.currentTarget.style.borderColor = 'rgba(0,140,255,0.28)';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.025)';
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                      >
                        <div style={{ fontSize: '20px', marginBottom: '7px' }}>{s.icon}</div>
                        <div style={{ color: '#fff', fontSize: '13px', fontFamily: 'Inter, sans-serif', fontWeight: 700, marginBottom: '3px' }}>{s.title}</div>
                        <div style={{ color: 'rgba(145,145,155,0.8)', fontSize: '11px', fontFamily: 'Inter, sans-serif' }}>{s.desc}</div>
                      </div>
                    ))}
                  </div>

                  {/* Quote */}
                  <div style={{
                    position: 'relative',
                    padding: '18px 18px 18px 26px',
                    borderRadius: '11px',
                    background: 'linear-gradient(90deg, rgba(255,255,255,0.035), transparent)',
                    border: '1px solid rgba(255,255,255,0.055)',
                    borderLeft: 'none',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      position: 'absolute', left: 0, top: 0, bottom: 0, width: '3px',
                      background: '#00a0ff',
                      boxShadow: '0 0 12px rgba(0,160,255,0.55)',
                    }} />
                    <p style={{
                      color: 'rgba(225,225,230,0.9)', fontSize: '13px',
                      fontFamily: 'Inter, sans-serif', fontStyle: 'italic',
                      fontWeight: 500, lineHeight: 1.7, margin: 0,
                    }}>
                      "I don't just deliver a website; I deliver the solution that connects your idea with your clients."
                    </p>
                  </div>

                  {/* Close hint */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.38, marginTop: '-4px' }}>
                    <div style={{
                      padding: '3px 8px', borderRadius: '5px',
                      border: '1px solid rgba(255,255,255,0.28)',
                      color: 'rgba(255,255,255,0.7)', fontSize: '10px',
                      fontFamily: 'monospace', letterSpacing: '0.05em',
                    }}>ESC</div>
                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', fontFamily: 'Inter, sans-serif' }}>
                      or click outside to close
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CSS Animations and Scrollbar Styles */}
      <style>{`
        .aboutme-modal-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .aboutme-modal-scroll::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.2);
          border-radius: 10px;
        }
        .aboutme-modal-scroll::-webkit-scrollbar-thumb {
          background: rgba(0, 150, 255, 0.35);
          border-radius: 10px;
        }
        .aboutme-modal-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 160, 255, 0.7);
        }

        @keyframes flameParticle {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0.85; }
          50% { transform: translateY(-10px) scale(0.55); opacity: 0.25; }
        }
        @keyframes enterPulse {
          0%, 100% { box-shadow: 0 0 20px rgba(0,120,255,0.32), inset 0 1px 0 rgba(100,220,255,0.14); }
          50% { box-shadow: 0 0 40px rgba(0,120,255,0.6), inset 0 1px 0 rgba(100,240,255,0.22); }
        }
        @keyframes fireGlow {
          0% { opacity: 0.55; transform: scale(1); }
          100% { opacity: 1; transform: scale(1.1); }
        }
        @keyframes backdropIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes modalSlideUp {
          from { opacity: 0; transform: translateY(28px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </>
  );
};

export default AboutMe;
