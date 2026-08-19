import React, { useState, useRef, useEffect } from 'react';
import GridScan from './GridScan';
import DepthText from './DepthText';
import Button from './Button';

const Hero = ({ onExplore }) => {
  const [phase, setPhase] = useState('hero');
  const timerRef = useRef(null);

  // 3D Physics tilt state for text container
  const textRef = useRef(null);
  const targetMouseRef = useRef({ x: 0, y: 0 });
  const currentMouseRef = useRef({ x: 0, y: 0 });
  const rafIdRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, []);

  // Mouse move handler for spring-physics 3D text reaction
  const handleMouseMove = (e) => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    // Normalized position from -1 to 1
    const x = (e.clientX - w / 2) / (w / 2);
    const y = (e.clientY - h / 2) / (h / 2);
    targetMouseRef.current = { x, y };
  };

  const handleMouseLeave = () => {
    targetMouseRef.current = { x: 0, y: 0 };
  };

  // Spring physics loop for smooth tilt, twist, lift, and shadow reaction
  useEffect(() => {
    const textEl = textRef.current;
    if (!textEl) return;

    const animatePhysics = () => {
      const ease = 0.07;
      const target = targetMouseRef.current;
      const current = currentMouseRef.current;

      current.x += (target.x - current.x) * ease;
      current.y += (target.y - current.y) * ease;

      const rotateX = -current.y * 20;
      const rotateY = current.x * 20;
      const rotateZ = -current.x * current.y * 5;
      const translateZ = (1 - Math.hypot(current.x, current.y)) * 30;

      textEl.style.transform = `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) rotateZ(${rotateZ.toFixed(2)}deg) translateZ(${translateZ.toFixed(1)}px)`;

      const shadowX = (-current.x * 25).toFixed(1);
      const shadowY = (-current.y * 25).toFixed(1);
      const shadowBlur = (40 + Math.hypot(current.x, current.y) * 20).toFixed(1);
      textEl.style.filter = `drop-shadow(${shadowX}px ${shadowY}px ${shadowBlur}px rgba(0, 0, 0, 0.65))`;

      rafIdRef.current = requestAnimationFrame(animatePhysics);
    };

    rafIdRef.current = requestAnimationFrame(animatePhysics);

    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, []);

  // Called by Button AFTER its shrink animation finishes (button handles the 2500ms delay internally)
  const handleExplore = () => {
    setPhase('fading');
    // Brief extra pause to let hero fade transition play (0.8s), then launch game
    timerRef.current = setTimeout(() => {
      if (onExplore) onExplore();
    }, 800);
  };

  return (
    <>
      <style>{`
        @keyframes textReveal {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* ═══════════════════════════════════════════════
          Hero Section
      ════════════════════════════════════════════════ */}
      <section
        id="home"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          position: 'relative',
          width: '100%',
          minHeight: '100vh',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          background: '#04060a',
        }}
      >
        {/* Animated WebGL GridScan Background */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 0,
            opacity: phase === 'hero' ? 1 : 0,
            transition: 'opacity 0.8s ease',
          }}
        >
          <GridScan
            sensitivity={0.55}
            lineThickness={1}
            linesColor="#2F293A"
            gridScale={0.1}
            scanColor="#3B82F6"
            scanOpacity={0.4}
            enablePost
            bloomIntensity={0.6}
            chromaticAberration={0.002}
            noiseIntensity={0.01}
            lineJitter={0.1}
            scanGlow={0.5}
            scanSoftness={2}
            enableWebcam={false}
            showPreview={false}
          />
        </div>

        {/* Subtle, soft overlay for crisp typography contrast */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 1,
            pointerEvents: 'none',
            background: `
              radial-gradient(circle at center, rgba(4,6,10,0.1) 0%, rgba(4,6,10,0.5) 100%),
              linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0) 50%, rgba(0,0,0,0.4) 100%)
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
            perspective: '1000px',
            transformStyle: 'preserve-3d',
          }}
        >
          {/* Text block — 3D cursor physics tilt, lift, and DepthText 3D layers */}
          <div
            ref={textRef}
            style={{
              textAlign: 'center',
              paddingTop: '10vh',
              animation: 'textReveal 1.2s ease 0.2s both',
              transformStyle: 'preserve-3d',
              willChange: 'transform, filter',
              cursor: 'default',
              userSelect: 'none',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
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
                color: 'rgba(219,234,254,0.9)',
                margin: '0 0 24px 0',
                textShadow: '0 2px 10px rgba(0,0,0,0.5)',
                transform: 'translateZ(20px)',
              }}
            >
              Portfolio · Jesús Martínez
            </p>

            {/* 3D Volumetric DepthText Titles */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                transform: 'translateZ(40px)',
                transformStyle: 'preserve-3d',
              }}
            >
              <DepthText
                text="Frontend"
                layers={30}
                depth={2.2}
                faceColor="#ffffff"
                depthColor="#3b82f6"
                tilt={8}
                pointerTracking
                smoothing={0.12}
                perspective={900}
                autoOrbit
                orbitSpeed={0.3}
                fontSize="clamp(54px, 10.5vw, 124px)"
                fontWeight={900}
                shadow
              />
              <DepthText
                text="Developer"
                layers={30}
                depth={2.2}
                faceColor="#93c5fd"
                depthColor="#1d4ed8"
                tilt={8}
                pointerTracking
                smoothing={0.12}
                perspective={900}
                autoOrbit
                orbitSpeed={0.3}
                fontSize="clamp(54px, 10.5vw, 124px)"
                fontWeight={900}
                shadow
              />
            </div>
          </div>

          {/* ───────────────────────────────────────────
              3D Explore Button — bottom center
          ─────────────────────────────────────────── */}
          <div
            style={{
              position: 'absolute',
              bottom: '64px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 10,
            }}
          >
            <Button onClick={handleExplore} durationMs={2500} />
          </div>
        </div>
      </section>
    </>
  );
};

export default Hero;
