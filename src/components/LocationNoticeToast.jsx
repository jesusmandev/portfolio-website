import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * LocationNoticeToast.jsx
 *
 * Minimalist and elegant UI toast notification component.
 * Displayed at the top of the screen when the player approaches
 * key map locations (Basketball court, soccer field, Colombia flag, World flags).
 */
const LocationNoticeToast = () => {
  const [notice, setNotice] = useState(null);
  const [typedText, setTypedText] = useState('');

  useEffect(() => {
    const handleNotice = (e) => {
      const detail = e.detail;
      setNotice(detail);
      setTypedText('');
    };

    window.addEventListener('location:notice', handleNotice);
    return () => window.removeEventListener('location:notice', handleNotice);
  }, []);

  // Subtle typewriter effect when changing message
  useEffect(() => {
    if (!notice || !notice.text) {
      setTypedText('');
      return;
    }

    const fullText = notice.text;
    let charIndex = 0;
    setTypedText('');

    const interval = setInterval(() => {
      if (charIndex < fullText.length) {
        setTypedText(fullText.slice(0, charIndex + 1));
        charIndex++;
      } else {
        clearInterval(interval);
      }
    }, 40);

    return () => clearInterval(interval);
  }, [notice]);

  return (
    <AnimatePresence>
      {notice && (
        <motion.div
          key={notice.id || notice.text}
          initial={{ opacity: 0, y: -28, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="fixed top-6 left-1/2 -translate-x-1/2 pointer-events-none select-none"
          style={{ zIndex: 9999 }}
        >
          {/* Main Glassmorphism style container */}
          <div
            className="relative flex items-center gap-3.5 px-5 py-3.5 rounded-full border shadow-2xl backdrop-blur-2xl transition-all duration-300"
            style={{
              background: 'rgba(7, 11, 20, 0.88)',
              borderColor: notice.accent ? `${notice.accent}44` : 'rgba(0, 160, 255, 0.3)',
              boxShadow: `0 20px 50px rgba(0, 0, 0, 0.6), 0 0 30px ${notice.accent ? `${notice.accent}22` : 'rgba(0, 160, 255, 0.15)'}, inset 0 1px 0 rgba(255, 255, 255, 0.12)`,
            }}
          >
            {/* Background ambient glow */}
            <div
              className="absolute inset-0 rounded-full opacity-20 blur-xl pointer-events-none"
              style={{
                background: notice.accent ? `radial-gradient(circle, ${notice.accent} 0%, transparent 70%)` : 'radial-gradient(circle, #00a0ff 0%, transparent 70%)',
              }}
            />

            {/* Icon with glowing pod */}
            <div
              className="relative flex items-center justify-center w-10 h-10 rounded-full border shrink-0 text-xl shadow-inner"
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                borderColor: notice.accent ? `${notice.accent}66` : 'rgba(255, 255, 255, 0.15)',
              }}
            >
              <span>{notice.icon || '📍'}</span>
            </div>

            {/* Text and badge content */}
            <div className="flex flexDirection-col gap-0.5 pr-1">
              {notice.tag && (
                <div
                  className="text-[9.5px] font-bold tracking-[0.22em] uppercase"
                  style={{
                    color: notice.accent || '#00a0ff',
                    textShadow: `0 0 12px ${notice.accent || '#00a0ff'}66`,
                  }}
                >
                  • {notice.tag}
                </div>
              )}
              <div className="flex items-center text-sm font-semibold text-white tracking-wide">
                <span>{typedText}</span>
                {typedText.length < (notice.text?.length || 0) && (
                  <span
                    className="inline-block w-1.5 h-4 ml-0.5 animate-pulse rounded-sm"
                    style={{ background: notice.accent || '#00a0ff' }}
                  />
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LocationNoticeToast;

