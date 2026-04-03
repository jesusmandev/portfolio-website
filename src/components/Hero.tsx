import React, { useEffect, useState, useRef } from 'react';
import { useLanguage, LocalizedText } from '../hooks/useLanguage';
import heroImg from '../assets/img/hero-dev.png';
import { motion } from 'framer-motion';
import type { Variants } from 'framer-motion';
import Hyperspeed from './Hyperspeed';

interface HeroProps {
  onDownloadCV: () => void;
}

interface HyperspeedHandle {
  speedUp: () => void;
  slowDown: () => void;
}

const Hero: React.FC<HeroProps> = ({ onDownloadCV }) => {
  const { currentLang } = useLanguage();
  const [typedText, setTypedText] = useState('');
  const hyperspeedRef = useRef<HyperspeedHandle>(null);

  const handleMouseEnter = () => hyperspeedRef.current?.speedUp();
  const handleMouseLeave = () => hyperspeedRef.current?.slowDown();

  useEffect(() => {
    const typewriterTexts: Record<string, string> = {
      en: "Bilingual Frontend Developer specializing in creating modern and dynamic web experiences. I transform ideas into interactive interfaces with a focus on clean design, efficient code, and impactful digital solutions.",
      es: "Desarrollador Frontend bilingüe especializado en crear experiencias web modernas y dinámicas. Transformo ideas en interfaces interactivas con un enfoque en diseño limpio, código eficiente y soluciones digitales impactantes.",
      fr: "Développeur Frontend bilingue spécialisé dans la création d'expériences web modernes et dinamyques. Je transforme des idées en interfaces interactives avec un accent sur un design épuré, du code eficaz et des solutions numériques percutantes.",
      de: "Zweisprachiger Frontend-Entwickler, spezialisiert auf die Erstellung moderner und dynamischer Web-Erlebnisse. Ich verwandle Ideen in interaktive Benutzeroberflächen mit Fokus auf sauberes Design, effizienten Code und wirkungsvolle digitale Lösungen.",
      pt: "Desenvolvedor Frontend bilíngue especializado na criação de experiências web modernas e dinâmicas. Transformo ideas em interfaces interativas com foco em design limpo, código eficiente e soluciones digitales impactantes."
    };

    const textToType = typewriterTexts[currentLang] || typewriterTexts.en;
    let currentIndex = 0;
    setTypedText('');

    const typingInterval = setInterval(() => {
      if (currentIndex < textToType.length) {
        setTypedText(textToType.substring(0, currentIndex + 1));
        currentIndex++;
      } else {
        clearInterval(typingInterval);
      }
    }, 25);

    return () => clearInterval(typingInterval);
  }, [currentLang]);

  const fluidEase: [number, number, number, number] = [0.21, 1.02, 0.49, 0.99];
  const imageEase: [number, number, number, number] = [0.16, 1, 0.3, 1];

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.12,
        delayChildren: 0.1,
      },
    },
  };

  const fadeInUp: Variants = {
    hidden: { opacity: 0, y: 20, filter: 'blur(5px)' },
    visible: { 
      opacity: 1, 
      y: 0, 
      filter: 'blur(0px)',
      transition: { 
        duration: 1.2, 
        ease: fluidEase
      } 
    },
  };

  const imageVariants: Variants = {
    hidden: { opacity: 0, scale: 0.9, rotate: -2 },
    visible: { 
      opacity: 1, 
      scale: 1, 
      rotate: 0,
      transition: { 
        duration: 1.5, 
        ease: imageEase, 
        delay: 0.2 
      } 
    },
  };

  return (
    <section id="home" className="hero-section relative overflow-hidden bg-transparent min-h-screen flex items-center">
      <div className="absolute inset-0 z-[-1] pointer-events-none">
        <Hyperspeed ref={hyperspeedRef} />
      </div>
      
      <motion.div 
        className="container mx-auto px-6 pt-32 pb-20 relative z-10 grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-8 lg:gap-20 items-center"
        initial="hidden"
        animate="visible"
        variants={containerVariants}
      >
        <div className="hero-content-left max-w-2xl px-4 lg:px-0 text-center lg:text-left order-2 lg:order-1">
          <motion.h1 
            className="hero-title relative" 
            id="hero-title"
            variants={fadeInUp}
          >
            <span className="title-line-1 text-3xl md:text-5xl lg:text-7xl block whitespace-nowrap overflow-hidden text-ellipsis">
              <LocalizedText
                en="Frontend"
                es="Desarrollador"
                fr="Développeur"
                de="Frontend"
                pt="Desenvolvedor"
              />
            </span>
            <span className="title-line-2 text-5xl md:text-7xl lg:text-9xl block font-bold mt-2 whitespace-nowrap overflow-hidden text-ellipsis italic">
              <LocalizedText
                en="Developer"
                es="Frontend"
                fr="Frontend"
                de="Entwickler"
                pt="Frontend"
              />
            </span>
          </motion.h1>

          <motion.p 
            className="hero-subtitle typewriter-effect min-h-[4.5em] mt-6 text-lg md:text-xl text-slate-300"
            variants={fadeInUp}
          >
            {typedText}
          </motion.p>

          <div className="hero-actions mt-10">
            <motion.div className="hero-cta flex flex-nowrap gap-4 justify-center lg:justify-start overflow-x-auto lg:overflow-visible no-scrollbar pb-2" variants={fadeInUp}>
              <a href="#projects" className="btn btn-primary px-6 py-3 text-base md:text-lg whitespace-nowrap">
                <LocalizedText en="View Projects" es="Ver Proyectos" fr="Voir Projets" de="Projekte" pt="Ver Projetos" />
              </a>
              <a href="#contact" className="btn btn-outline px-6 py-3 text-base md:text-lg whitespace-nowrap">
                <LocalizedText en="Contact Me" es="Contáctame" fr="Contactez-moi" de="Kontakt" pt="Contato" />
              </a>
              <button className="btn btn-download px-6 py-3 text-base md:text-lg whitespace-nowrap" onClick={onDownloadCV}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                </svg>
                <span className="ml-1">
                  <LocalizedText en="Download CV" es="Descargar CV" fr="Télécharger CV" de="CV Herunterladen" pt="Baixar CV" />
                </span>
              </button>
            </motion.div>
            
            <motion.div className="hero-socials mt-6 flex gap-4 items-center justify-center lg:justify-start" variants={fadeInUp}>
              <a href="https://github.com/jesusmandev" target="_blank" rel="noopener noreferrer" className="social-link p-3 rounded-lg" title="GitHub">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
              </a>
              <a href="https://www.linkedin.com/in/jesus-manuel-martinez-serpa-088ab33a0" target="_blank" rel="noopener noreferrer" className="social-link p-3 rounded-lg" title="LinkedIn">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              </a>
              <a href="https://app.netlify.com/teams/jesusmanuelserpa23/projects" target="_blank" rel="noopener noreferrer" className="social-link p-3 rounded-lg" title="Netlify">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 1.5c5.799 0 10.5 4.701 10.5 10.5S17.799 22.5 12 22.5 1.5 17.799 1.5 12 6.201 1.5 12 1.5zM8.25 6.75v10.5h1.5v-4.5h3v4.5h1.5V6.75h-1.5v4.5h-3v-4.5h-1.5z" />
                </svg>
              </a>
            </motion.div>
          </div>
        </div>

        <motion.div 
          className="hero-image-wrap floating relative z-10 order-1 lg:order-2" 
          id="hero-img-wrap"
          variants={imageVariants}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div className="hero-img-container border-4 border-amber-500/20 shadow-[0_0_80px_rgba(245,166,35,0.4)] rounded-full overflow-hidden w-[280px] h-[280px] md:w-[400px] md:h-[400px] lg:w-[480px] lg:h-[480px] mx-auto relative bg-slate-900/60 backdrop-blur-md">
            <img 
              src={heroImg} 
              alt="Developer" 
              className="w-full h-full object-cover object-top hover:scale-105 transition-transform duration-500" 
            />
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
};

export default Hero;
