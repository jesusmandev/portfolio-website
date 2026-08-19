import React, { useState, useEffect } from 'react';
import Hero from './components/Hero.jsx';
import CVModal from './components/CVModal.jsx';
import Magnet from './components/Magnet.jsx';
import { LanguageProvider } from './hooks/useLanguage.jsx';
import './index.css';
import './game/src/style.css';

// Limpiamos cualquier estado residual de sesiones anteriores
sessionStorage.removeItem('gameActive');

// Guardia de módulo: sobrevive a React StrictMode y al HMR de Vite.
// A diferencia de un useRef, esta variable NO se resetea cuando React
// desmonta/remonta el componente en desarrollo.
let _orchestratorStarted = false;

import AboutMe from './components/AboutMe.jsx';
import SocialMediaModal from './components/social media.jsx';
import CubeRulesModal from './components/cubeRules.jsx';
import LocationNoticeToast from './components/LocationNoticeToast.jsx';

// ── GameContainer ─────────────────────────────────────────────────────────
const GameContainer = () => {

  useEffect(() => {
    // La guardia es una variable de módulo, NO un ref.
    // Así React StrictMode (que desmonta y remonta) no puede resetearla.
    if (_orchestratorStarted) return;
    _orchestratorStarted = true;

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';

    console.log('[GameContainer] Iniciando carga del orquestador...');

    import('./game/src/Intro/IntroOrchestrator.js')
      .then(({ IntroOrchestrator }) => {
        console.log('[GameContainer] IntroOrchestrator cargado, iniciando start()...');
        const orchestrator = new IntroOrchestrator();
        window.__orchestrator = orchestrator;
        orchestrator.start().catch(err => {
          console.error('[Orchestrator] Error durante start():', err);
          console.error(err?.stack ?? err);
        });
      })
      .catch((err) => {
        console.error('[GameContainer] Error al cargar IntroOrchestrator:', err);
        console.error(err?.stack ?? err);
      });

    // Sin cleanup que resetee la guardia — el orquestador debe vivir
    // mientras la sesión esté activa.
  }, []);

  return (
    <>
      <LocationNoticeToast />
      <AboutMe />
      <SocialMediaModal />
      <CVModal />
      <CubeRulesModal />
    </>
  );
};

// ── AppContent ────────────────────────────────────────────────────────────
const AppContent = () => {
  const [isCVModalOpen, setIsCVModalOpen] = useState(false);
  // gameActive SIEMPRE empieza en false — el usuario debe pasar por el Hero
  const [gameActive, setGameActive] = useState(false);

  const handleExplore = () => {
    setGameActive(true);
  };

  return (
    <div style={{
      position: 'relative',
      minHeight: '100vh',
      background: gameActive ? 'transparent' : '#050505',
      overflow: 'hidden'
    }}>
      {/* Download CV Button — only visible on the Hero screen */}
      {!gameActive && (
        <Magnet
          padding={50}
          disabled={false}
          magnetStrength={4}
          style={{ position: 'fixed', top: '24px', right: '28px', zIndex: 100 }}
        >
          <button
            onClick={() => setIsCVModalOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'transparent',
              border: '1.5px solid rgba(255,255,255,0.3)',
              borderRadius: '50px',
              padding: '11px 22px',
              color: '#fff',
              fontFamily: 'Inter, sans-serif',
              fontSize: '13px',
              fontWeight: 600,
              letterSpacing: '0.5px',
              cursor: 'pointer',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              transition: 'all 0.25s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.7)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)';
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download CV
          </button>
        </Magnet>
      )}

      <main>
        {gameActive ? (
          <GameContainer />
        ) : (
          <Hero onExplore={handleExplore} />
        )}
      </main>

      <CVModal isOpen={isCVModalOpen} onClose={() => setIsCVModalOpen(false)} />
    </div>
  );
};

// ── App ───────────────────────────────────────────────────────────────────
const App = () => {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
};

export default App;
