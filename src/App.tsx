import React, { useState, useEffect } from 'react';
import Loader from './components/Loader';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import About from './components/About';
import Skills from './components/Skills';
import Certifications from './components/Certifications';
import Projects from './components/Projects';
import Contact from './components/Contact';
import Footer from './components/Footer';
import CertModal from './components/CertModal';
import CVModal from './components/CVModal';
import { LanguageProvider } from './hooks/useLanguage';
import { CursorParticles } from './hooks/useCursor';
import bgMusic from './assets/music/bg-music.mp3';
import './index.css';

const AppContent: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('home');
  const [isCVModalOpen, setIsCVModalOpen] = useState(false);
  const [certModalConfig, setCertModalConfig] = useState({ isOpen: false, src: '' });

  const audioRef = React.useRef<HTMLAudioElement>(null);

  useEffect(() => {
    // Handling section scrolling for navbar active state
    const sections = document.querySelectorAll('section[id]');
    
    const handleScroll = () => {
      let current = '';
      sections.forEach(section => {
        const sectionTop = (section as HTMLElement).offsetTop;
        if (window.scrollY >= sectionTop - 120) {
          current = section.getAttribute('id') || '';
        }
      });
      setActiveSection(current);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const handleStartApp = () => {
    setIsLoading(false);
    if (audioRef.current) {
      audioRef.current.volume = 0.3;
      audioRef.current.play()
        .catch((error: unknown) => console.log('Audio playback error:', error));
    }
  };

  return (
    <>
      <CursorParticles />
      <audio 
        ref={audioRef} 
        src={bgMusic}
      />
      
      {isLoading ? (
        <Loader onComplete={handleStartApp} />
      ) : (
        <div className="main-content show">
          <Navbar currentSection={activeSection} />
          <Hero onDownloadCV={() => setIsCVModalOpen(true)} />
          <About />
          <Skills />
          <Certifications onOpenCert={(src: string) => setCertModalConfig({ isOpen: true, src })} />
          <Projects />
          <Contact />
          <Footer />

          <CertModal 
            isOpen={certModalConfig.isOpen} 
            imageSrc={certModalConfig.src} 
            onClose={() => setCertModalConfig({ isOpen: false, src: '' })} 
          />
          <CVModal 
            isOpen={isCVModalOpen} 
            onClose={() => setIsCVModalOpen(false)} 
          />
        </div>
      )}
    </>
  );
};

const App: React.FC = () => {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
};

export default App;
