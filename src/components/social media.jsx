import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * social media.jsx — High-Fidelity 3D Contact Modal
 *
 * Fixed field containers:
 * - Centered icons with absolute inset-y-0 (no longer depend on parent flex).
 * - w-13/h-13 (invalid class in Tailwind) replaced by w-14/h-14.
 * - Name/Email row with grid instead of flex-col/sm:flex-row for identical widths.
 * - Unified borders, background, and radii in a single reusable class.
 */
export const SocialMediaModal = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'success' | 'error'
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener('open-mail-modal', handleOpen);
    return () => window.removeEventListener('open-mail-modal', handleOpen);
  }, []);

  const closeModal = () => {
    setIsOpen(false);
    if (status === 'success') {
      setStatus('idle');
      setFormData({ name: '', email: '', subject: '', message: '' });
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (status === 'error') {
      setStatus('idle');
      setErrorMessage('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.email.trim() || !formData.subject.trim() || !formData.message.trim()) {
      setStatus('error');
      setErrorMessage('Please fill in all fields.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setStatus('error');
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setStatus('loading');
    setErrorMessage('');

    try {
      const submitData = new FormData();
      submitData.append("access_key", import.meta.env.VITE_WEB3FORMS_ACCESS_KEY || "");
      submitData.append("name", formData.name);
      submitData.append("email", formData.email);
      submitData.append("subject", formData.subject);
      submitData.append("message", formData.message);

      const response = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        body: submitData
      });

      const result = await response.json();
      if (result.success) {
        setStatus('success');
        setFormData({ name: '', email: '', subject: '', message: '' });
      } else {
        setStatus('error');
        setErrorMessage(result.message || 'There was an error sending the message.');
      }
    } catch (error) {
      setStatus('error');
      setErrorMessage('Connection error. Please try again.');
    }
  };

  // Base class shared by ALL field containers (input/textarea)
  const fieldClasses = "w-full h-14 bg-[#0a1326]/90 border border-blue-900/40 rounded-2xl text-white text-sm sm:text-base pr-5 placeholder-gray-500 focus:outline-none focus:border-blue-500/80 focus:bg-[#0e1c3a] focus:ring-1 focus:ring-blue-500/50 transition-all duration-300 disabled:opacity-50";
  const fieldPaddingStyle = { paddingLeft: '52px' };

  // Icon: fixed position in px via inline style, and vertical centering with top/translate
  const iconWrapperClasses = "absolute text-gray-400 pointer-events-none";
  const iconWrapperStyle = { left: '18px', top: '50%', transform: 'translateY(-50%)' };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeModal}
            className="fixed inset-0 bg-black/80 backdrop-blur-xl"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-full overflow-hidden rounded-3xl p-7 sm:p-10 md:p-12 text-white shadow-2xl bg-[#060a13] border border-blue-500/25 shadow-blue-600/15"
            style={{ maxWidth: '680px' }}
          >
            <div className="absolute -top-24 -left-24 w-72 h-72 bg-blue-600 rounded-full blur-[100px] opacity-15 pointer-events-none" />
            <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-indigo-600 rounded-full blur-[100px] opacity-15 pointer-events-none" />

            <button
              type="button"
              onClick={closeModal}
              className="absolute top-6 right-6 flex items-center justify-center w-10 h-10 rounded-full bg-white/10 text-gray-300 hover:text-white hover:bg-white/20 transition-all duration-200"
              aria-label="Close modal"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            <div className="flex flex-col items-center text-center mb-8">
              <div className="relative mb-3.5 flex items-center justify-center">
                <div className="w-14 h-14 rounded-full border border-blue-400/50 bg-blue-950/60 text-blue-400 flex items-center justify-center shadow-[0_0_22px_rgba(59,130,246,0.5)]">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="20" height="16" x="2" y="4" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                </div>
                <span className="absolute -left-7 w-1.5 h-1.5 rounded-full bg-blue-400 opacity-60 blur-[0.5px]" />
                <span className="absolute -right-7 w-1.5 h-1.5 rounded-full bg-blue-400 opacity-60 blur-[0.5px]" />
              </div>

              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="w-6 h-[1.5px] bg-blue-500/60" />
                <span className="text-blue-400 font-bold text-xs tracking-[0.2em] uppercase">
                  Send email
                </span>
                <span className="w-6 h-[1.5px] bg-blue-500/60" />
              </div>

              <h3 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-2">
                Have a project? <span className="text-blue-500 drop-shadow-md">Let's talk.</span>
              </h3>

              <p className="text-gray-400 text-xs sm:text-sm max-w-md leading-relaxed">
                Tell me about your idea and let's work together to bring it to life.
              </p>
            </div>

            <form className="flex flex-col gap-4 sm:gap-5" onSubmit={handleSubmit} noValidate>
              {/* Row 1: Name + Email — grid with identical columns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                <div className="relative mx-1">
                  <span className={iconWrapperClasses} style={iconWrapperStyle}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Name"
                    disabled={status === 'loading'}
                    className={fieldClasses}
                    style={fieldPaddingStyle}
                  />
                </div>

                <div className="relative mx-1">
                  <span className={iconWrapperClasses} style={iconWrapperStyle}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="20" height="16" x="2" y="4" rx="2" />
                      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                    </svg>
                  </span>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="Email address"
                    disabled={status === 'loading'}
                    className={fieldClasses}
                    style={fieldPaddingStyle}
                  />
                </div>
              </div>

              {/* Row 2: Project Subject */}
              <div className="relative mx-1">
                <span className={iconWrapperClasses} style={iconWrapperStyle}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                    <rect width="20" height="14" x="2" y="6" rx="2" />
                  </svg>
                </span>
                <input
                  type="text"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  placeholder="Project subject"
                  disabled={status === 'loading'}
                  className={fieldClasses}
                  style={fieldPaddingStyle}
                />
              </div>

              {/* Row 3: Message */}
              <div className="relative mx-1">
                <span className="absolute text-gray-400 pointer-events-none" style={{ left: '18px', top: '16px' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                </span>
                <textarea
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  placeholder="Tell me about your project..."
                  disabled={status === 'loading'}
                  className="w-full h-36 bg-[#0a1326]/90 border border-blue-900/40 rounded-2xl text-white text-sm sm:text-base pr-5 pt-4 placeholder-gray-500 focus:outline-none focus:border-blue-500/80 focus:bg-[#0e1c3a] focus:ring-1 focus:ring-blue-500/50 transition-all duration-300 disabled:opacity-50 resize-none"
                  style={{ paddingLeft: '52px' }}
                />
              </div>

              <AnimatePresence mode="wait">
                {status === 'error' && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="text-blue-700 text-xs font-semibold px-1 text-center"
                  >
                    {errorMessage}
                  </motion.div>
                )}
                {status === 'success' && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="text-emerald-400 text-xs font-semibold px-1 text-center"
                  >
                    Proposal sent successfully! I will get in touch with you very soon.
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                type="submit"
                disabled={status === 'loading' || status === 'success'}
                className="w-full mt-2 sm:mt-3 flex items-center justify-center gap-3 h-14 rounded-2xl text-white font-bold text-base bg-linear-to-r from-blue-600 via-blue-500 to-indigo-600 shadow-lg shadow-blue-600/30 hover:shadow-blue-500/50 hover:opacity-95 transition-all duration-300 hover:-translate-y-0.5 disabled:opacity-70 disabled:hover:translate-y-0"
                style={{ background: 'linear-gradient(90deg, #2563eb, #3b82f6, #4f46e5)' }}
              >
                {status === 'loading' ? (
                  <span>Sending proposal...</span>
                ) : status === 'success' ? (
                  <span>Proposal Sent!</span>
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m22 2-7 20-4-9-9-4Z" />
                      <path d="M22 2 11 13" />
                    </svg>
                    <span>Send proposal</span>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14" />
                      <path d="m12 5 7 7-7 7" />
                    </svg>
                  </>
                )}
              </button>
            </form>

            <div className="flex items-center justify-center gap-2 mt-5 text-gray-400 text-xs">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
              <span>Your information is secure and will not be shared.</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default SocialMediaModal;