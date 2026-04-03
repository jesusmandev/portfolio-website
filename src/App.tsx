import React, { useState, useEffect } from 'react';
import Loader from './components/Loader';
import ScrollReveal from './components/ScrollReveal';
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
    if (isLoading) return;

    window.scrollTo(0, 0);

    const handleScroll = () => {
      const sections = Array.from(document.querySelectorAll('section[id]'));
      if (sections.length === 0) return;

      // Check if user scrolled to the absolute bottom (and page has actually rendered)
      const isAtBottom = 
        Math.ceil(window.innerHeight + window.scrollY) >= document.body.offsetHeight - 20 &&
        document.body.offsetHeight > window.innerHeight;
        
      if (isAtBottom) {
        setActiveSection(sections[sections.length - 1].id);
        return;
      }

      const trigger = window.innerHeight * 0.3; // 30% from top
      let currentId = sections[0].id; // Fallback to first section

      for (const section of sections) {
        const rect = section.getBoundingClientRect();
        if (rect.height > 0 && rect.bottom >= trigger) {
          currentId = section.id;
          break;
        }
      }
      
      setActiveSection(currentId);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    
    // Initial check (delay slightly so DOM expands)
    const timer = setTimeout(handleScroll, 100);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [isLoading]);

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
        <div className="main-content show overflow-x-hidden">
          <Navbar currentSection={activeSection} />
          <Hero onDownloadCV={() => setIsCVModalOpen(true)} />
          
          <ScrollReveal direction="left">
            <About />
          </ScrollReveal>
          
          <ScrollReveal direction="right">
            <Skills />
          </ScrollReveal>
          
          <ScrollReveal direction="left">
            <Certifications onOpenCert={(src: string) => setCertModalConfig({ isOpen: true, src })} />
          </ScrollReveal>
          
          <ScrollReveal direction="right">
            <Projects />
          </ScrollReveal>
          
          <ScrollReveal direction="left">
            <Contact />
          </ScrollReveal>
          
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
