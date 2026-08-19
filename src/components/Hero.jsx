import React, { useState, useRef, useEffect } from 'react';

// ⚠️ Adjust this value to the actual duration of your fondo.webp (in milliseconds)
const CINEMATIC_DURATION_MS = 5500;

const Hero = ({ onExplore }) => {
  const [phase, setPhase] = useState('hero');
  const [btnHovered, setBtnHovered] = useState(false);
  const canvasRef = useRef(null);
  const [canvasReady, setCanvasReady] = useState(false);
  const timer1Ref = useRef(null);
  const timer2Ref = useRef(null);

  // Clean up timers if the component unmounts before they fire
  useEffect(() => {
    return () => {
      if (timer1Ref.current) clearTimeout(timer1Ref.current);
      if (timer2Ref.current) clearTimeout(timer2Ref.current);
    };
  }, []);

  // Draw the first frame of fondo.webp to canvas using a hidden <video> element.
  // This allows the browser to stream the file instead of downloading the full 51 MB
  // before it can decode even a single frame (which is what <img> does with animated webp).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w;
    canvas.height = h;

    // Helper: cover-fit and draw a video/image element to the canvas
    const drawCover = (source) => {
      const srcW = source.videoWidth || source.naturalWidth;
      const srcH = source.videoHeight || source.naturalHeight;
      if (!srcW || !srcH) return;
      const canvasRatio = w / h;
      const srcRatio = srcW / srcH;
      let sx = 0, sy = 0, sw = srcW, sh = srcH;
      if (canvasRatio > srcRatio) {
        sh = srcW / canvasRatio;
        sy = (srcH - sh) / 2;
      } else {
        sw = srcH * canvasRatio;
        sx = (srcW - sw) / 2;
      }
      ctx.drawImage(source, sx, sy, sw, sh, 0, 0, w, h);
      setCanvasReady(true);
    };

    // Try video first (streams, first frame available almost immediately)
    const vid = document.createElement('video');
    vid.muted = true;
    vid.playsInline = true;
    vid.preload = 'metadata'; // only fetch headers + first few KB
    vid.src = `${import.meta.env.BASE_URL}picture/fondo.webp`;

    // Draw as soon as the first frame is decoded
    vid.addEventListener('loadeddata', () => {
      drawCover(vid);
      vid.src = ''; // release network connection — we only needed the first frame
    }, { once: true });

    // Fallback: if video element can't handle the webp (some mobile browsers),
    // fall back to <img> after a short timeout.
    const fallbackTimer = setTimeout(() => {
      if (canvasRef.current && !canvas.dataset.ready) {
        const img = new Image();
        img.onload = () => { drawCover(img); };
        img.src = `${import.meta.env.BASE_URL}picture/fondo.webp`;
      }
    }, 3000);

    vid.addEventListener('loadeddata', () => clearTimeout(fallbackTimer), { once: true });
    vid.load();

    return () => {
      clearTimeout(fallbackTimer);
      vid.src = '';
    };
  }, []);

  const handleExplore = () => {
    setPhase('fading');

    // Wait for text to fade out, then show cinematic
    timer1Ref.current = setTimeout(() => setPhase('cinematic'), 800);

    // When cinematic finishes, load the game
    timer2Ref.current = setTimeout(() => {
      if (onExplore) onExplore();
    }, 800 + CINEMATIC_DURATION_MS);
  };

  return (
    <>
      <style>{`
        @keyframes heroFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes explorePulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(59,130,246,0.35); }
          50%      { box-shadow: 0 0 0 16px rgba(59,130,246,0); }
        }
        @keyframes arrowSlide {
          0%,100% { transform: translateX(0); }
          50%      { transform: translateX(6px); }
        }
        @keyframes textReveal {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* ═══════════════════════════════════════════════
          Cinematic overlay — fullscreen, plays the webp
      ════════════════════════════════════════════════ */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9000,
          background: '#000',
          pointerEvents: phase === 'cinematic' ? 'auto' : 'none',
          opacity: phase === 'cinematic' ? 1 : 0,
          transition: 'opacity 0.9s ease',
        }}
      >
        {phase === 'cinematic' && (
          // Use <video> instead of <img> for the animated webp:
          // browsers stream video progressively so it starts playing within ~1s
          // instead of waiting for the full 51 MB download before showing anything.
          <video
            key="webp-cinematic"
            src={`${import.meta.env.BASE_URL}picture/fondo.webp`}
            autoPlay
            muted
            playsInline
            loop={false}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
              animation: 'heroFadeIn 0.9s ease forwards',
            }}
          />
        )}
      </div>

      {/* ═══════════════════════════════════════════════
          Hero Section
      ════════════════════════════════════════════════ */}
      <section
        id="home"
        style={{
          position: 'relative',
          width: '100%',
          minHeight: '100vh',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
        }}
      >
        {/* Solid background — visible while canvas loads */}
        <div style={{ position: 'absolute', inset: 0, background: '#080808' }} />

        {/* Canvas with first frame of webp (static, not animated) */}
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            opacity: canvasReady ? 1 : 0,
            transition: 'opacity 1.2s ease',
          }}
        />

        {/* Dark gradient over background */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 1,
            background: `
              linear-gradient(
                to bottom,
                rgba(0,0,0,0.52) 0%,
                rgba(0,0,0,0.28) 40%,
                rgba(0,0,0,0.65) 100%
              )
            `,
          }}
        />

        {/* ═══════════════════════════════════════════════
            Main Content
        ════════════════════════════════════════════════ */}
        <div
          style={{
            position: 'relative',
            zIndex: 2,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100vh',
            transition: 'opacity 0.8s cubic-bezier(0.4,0,0.2,1), transform 0.8s cubic-bezier(0.4,0,0.2,1)',
            opacity: phase === 'hero' ? 1 : 0,
            transform: phase === 'hero'
              ? 'translateY(0) scale(1)'
              : 'translateY(-28px) scale(0.97)',
          }}
        >
          {/* Text block — centered, slightly below middle */}
          <div
            style={{
              textAlign: 'center',
              paddingTop: '14vh',
              animation: 'textReveal 1.2s ease 0.2s both',
            }}
          >
            {/* Eyebrow */}
            <p
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: 'clamp(10px, 1.2vw, 13px)',
                fontWeight: 700,
                letterSpacing: '6px',
                textTransform: 'uppercase',
                color: 'rgba(147,197,253,0.65)',
                margin: '0 0 32px 0',
              }}
            >
              Portfolio · Jesús Martínez
            </p>

            {/* Main Title */}
            <h1
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: 'clamp(54px, 10.5vw, 124px)',
                fontWeight: 900,
                color: '#fff',
                lineHeight: 0.91,
                letterSpacing: '-4px',
                margin: 0,
                textShadow: '0 8px 60px rgba(0,0,0,0.6)',
              }}
            >
              Frontend
              <br />
              <span
                style={{
                  background: 'linear-gradient(145deg, #93c5fd 0%, #3b82f6 45%, #1e3a8a 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  filter: 'drop-shadow(0 0 50px rgba(59,130,246,0.55))',
                }}
              >
                Developer
              </span>
            </h1>
          </div>

          {/* ───────────────────────────────────────────
              Explore Button — bottom center
          ─────────────────────────────────────────── */}
          <button
            onClick={handleExplore}
            onMouseEnter={() => setBtnHovered(true)}
            onMouseLeave={() => setBtnHovered(false)}
            style={{
              position: 'absolute',
              bottom: '72px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: btnHovered
                ? 'rgba(59,130,246,0.18)'
                : 'rgba(59,130,246,0.07)',
              border: `1.5px solid ${btnHovered
                ? 'rgba(147,197,253,0.9)'
                : 'rgba(147,197,253,0.35)'}`,
              color: btnHovered ? '#93c5fd' : '#fff',
              borderRadius: '60px',
              padding: '19px 56px',
              fontFamily: 'Inter, sans-serif',
              fontSize: '14px',
              fontWeight: 600,
              letterSpacing: '5px',
              textTransform: 'uppercase',
              cursor: 'pointer',
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              transition: 'background 0.3s ease, border-color 0.3s ease, transform 0.2s ease',
              whiteSpace: 'nowrap',
              animation: 'explorePulse 3.5s ease infinite',
              outline: 'none',
            }}
          >
            Explore
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                animation: btnHovered ? 'arrowSlide 0.65s ease infinite' : 'none',
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </span>
          </button>
        </div>
      </section>
    </>
  );
};

export default Hero;

