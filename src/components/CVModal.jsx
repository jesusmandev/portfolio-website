import React, { useState, useEffect, useCallback } from 'react';

const cvEs = '/cv/CV_JESUS MARTINEZ_ES.pdf';
const cvEn = '/cv/CV_JESUS_MARTINEZ_EN.pdf';

const CVModal = ({ isOpen: propIsOpen, onClose: propOnClose }) => {
  const [isNear, setIsNear] = useState(false);
  const [internalIsOpen, setInternalIsOpen] = useState(false);

  const isOpen = propIsOpen !== undefined ? propIsOpen : internalIsOpen;

  const handleClose = useCallback(() => {
    if (propOnClose) propOnClose();
    setInternalIsOpen(false);
  }, [propOnClose]);

  useEffect(() => {
    const onNear = () => setIsNear(true);
    const onFar  = () => setIsNear(false);
    const onOpen = () => setInternalIsOpen(true);

    window.addEventListener('cv:near', onNear);
    window.addEventListener('cv:far',  onFar);
    window.addEventListener('cv:open', onOpen);

    return () => {
      window.removeEventListener('cv:near', onNear);
      window.removeEventListener('cv:far',  onFar);
      window.removeEventListener('cv:open', onOpen);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') handleClose();
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleClose]);

  return (
    <>
      {/* "Press ENTER" prompt shown when the user is near the 3D CV logo */}
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
        <div style={{
          background: 'linear-gradient(135deg, rgba(15,23,42,0.92), rgba(30,41,59,0.88), rgba(14,116,144,0.8))',
          color: '#f8fbff',
          fontFamily: '"Segoe UI", sans-serif',
          fontSize: '17px',
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          padding: '12px 30px',
          borderRadius: '999px',
          border: '1px solid rgba(125,211,252,0.8)',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 0 0 1px rgba(255,255,255,0.1), 0 0 22px rgba(56,189,248,0.45), 0 0 40px rgba(167,139,250,0.26)',
          textShadow: '0 0 12px rgba(125,211,252,0.75)',
        }}>
          <span style={{ display: 'inline-block', padding: '2px 6px', borderRadius: '999px', background: 'linear-gradient(135deg, rgba(251,191,36,0.18), rgba(125,211,252,0.2))' }}>Press</span>{' '}
          <strong style={{ color: '#fef3c7', textShadow: '0 0 18px rgba(250,204,21,0.8)' }}>ENTER</strong>{' '}
          <span style={{ opacity: 0.9 }}>to view Resume</span>
        </div>
      </div>

      {/* CV Modal */}
      {isOpen && (
        <div
          className="fixed inset-0 flex items-center justify-center animate-fade-up"
          style={{ zIndex: 9999 }}
        >
          {/* Overlay */}
          <div
            className="absolute inset-0 cursor-pointer"
            style={{
              backgroundColor: 'rgba(5, 5, 5, 0.8)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)'
            }}
            onClick={handleClose}
          ></div>

          {/* Content */}
          <div
            className="relative z-10 glass-card flex flex-col items-center justify-center border border-white/10"
            style={{
              minHeight: '250px',
              maxWidth: '750px',
              width: '92%',
              padding: '60px 30px',
              borderRadius: '48px',
              boxShadow: '0 0 80px rgba(0, 0, 0, 0.9)'
            }}
          >
            {/* Close button (X) */}
            <button
              className="absolute w-12 h-12 rounded-full flex items-center justify-center text-gray-400 hover:text-white transition-all duration-300"
              style={{
                top: '24px',
                right: '24px',
                background: 'rgba(255, 255, 255, 0.05)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 45, 85, 0.2)';
                e.currentTarget.style.boxShadow = '0 0 20px rgba(255, 45, 85, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                e.currentTarget.style.boxShadow = 'none';
              }}
              onClick={handleClose}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>

            {/* Title */}
            <h3
              className="text-2xl md:text-4xl font-bold text-white text-center tracking-wide mb-14 md:mb-18"
              style={{ transform: 'translateY(-20px)' }}
            >
              Download Resume
            </h3>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 md:gap-8 w-full">
              <a
                href={cvEs}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center transition-all duration-300 w-auto"
                style={{
                  height: '58px',
                  padding: '0 34px',
                  borderRadius: '18px',
                  fontSize: '18px',
                  fontWeight: 700,
                  border: '1px solid rgba(255,255,255,.12)',
                  background: 'rgba(255,255,255,.02)',
                  color: 'white',
                  backdropFilter: 'blur(10px)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,.05)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,.35)';
                  e.currentTarget.style.boxShadow = '0 0 30px rgba(255,255,255,0.15)';
                  e.currentTarget.style.transform = 'translateY(-3px) scale(1.02)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,.02)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,.12)';
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.transform = 'translateY(0) scale(1)';
                }}
                onClick={handleClose}
              >
                CV in Spanish
              </a>

              <a
                href={cvEn}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center transition-all duration-300 w-auto"
                style={{
                  height: '58px',
                  padding: '0 34px',
                  borderRadius: '18px',
                  fontSize: '18px',
                  fontWeight: 700,
                  border: '1px solid rgba(255,255,255,.12)',
                  background: 'rgba(255,255,255,.02)',
                  color: 'white',
                  backdropFilter: 'blur(10px)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,.05)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,.35)';
                  e.currentTarget.style.boxShadow = '0 0 30px rgba(255,255,255,0.15)';
                  e.currentTarget.style.transform = 'translateY(-3px) scale(1.02)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,.02)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,.12)';
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.transform = 'translateY(0) scale(1)';
                }}
                onClick={handleClose}
              >
                CV in English
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CVModal;
