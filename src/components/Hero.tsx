import React, { useEffect, useState } from 'react';
import { useLanguage, LocalizedText } from '../hooks/useLanguage';
import heroImg from '../assets/img/hero-dev.png';

interface HeroProps {
  onDownloadCV: () => void;
}

const Hero: React.FC<HeroProps> = ({ onDownloadCV }) => {
  const { currentLang } = useLanguage();
  const [typedText, setTypedText] = useState('');

  useEffect(() => {
    const typewriterTexts: Record<string, string> = {
      en: "Bilingual Frontend Developer specializing in creating modern and dynamic web experiences. I transform ideas into interactive interfaces with a focus on clean design, efficient code, and impactful digital solutions.",
      es: "Desarrollador Frontend bilingüe especializado en crear experiencias web modernas y dinámicas. Transformo ideas en interfaces interactivas con un enfoque en diseño limpio, código eficiente y soluciones digitales impactantes.",
      fr: "Développeur Frontend bilingue spécialisé dans la création d'expériences web modernes et dynamiques. Je transforme des idées en interfaces interactives avec un accent sur un design épuré, du code efficace et des solutions numériques percutantes.",
      de: "Zweisprachiger Frontend-Entwickler, spezialisiert auf die Erstellung moderner und dynamischer Web-Erlebnisse. Ich verwandle Ideen in interaktive Benutzeroberflächen mit Fokus auf sauberes Design, effizienten Code und wirkungsvolle digitale Lösungen.",
      pt: "Desenvolvedor Frontend bilíngue especializado na criação de experiências web modernas e dinâmicas. Transformo ideias em interfaces interativas com foco em design limpo, código eficiente e soluções digitais impactantes."
    };

    const textToType = typewriterTexts[currentLang];
    let currentIndex = 0;
    setTypedText('');

    const typingInterval = setInterval(() => {
      if (currentIndex < textToType.length) {
        setTypedText(textToType.substring(0, currentIndex + 1));
        currentIndex++;
      } else {
        clearInterval(typingInterval);
      }
    }, 30);

    return () => clearInterval(typingInterval);
  }, [currentLang]);

  return (
    <section id="home" className="hero-section">
      <div className="gradient-orb orb-1"></div>
      <div className="gradient-orb orb-2"></div>
      <div className="gradient-orb orb-3"></div>

      <div className="hero-content">
        <h1 className="hero-title" id="hero-title" style={{ transition: 'opacity 1s ease, transform 1s ease' }}>
          <span className="title-line-1">
            <LocalizedText
              en="Frontend"
              es="Desarrollador"
              fr="Développeur"
              de="Frontend"
              pt="Desenvolvedor"
            />
          </span>
          <span className="title-line-2">
            <LocalizedText
              en="Developer"
              es="Frontend"
              fr="Frontend"
              de="Entwickler"
              pt="Frontend"
            />
          </span>
        </h1>

        <p className="hero-subtitle typewriter-effect">
          {typedText}
        </p>

        <div className="hero-cta">
          <a href="#projects" className="btn btn-primary">
            <LocalizedText en="View Projects" es="Ver Proyectos" fr="Voir Projets" de="Projekte" pt="Ver Projetos" />
          </a>
          <a href="#contact" className="btn btn-outline">
            <LocalizedText en="Contact Me" es="Contáctame" fr="Contactez-moi" de="Kontakt" pt="Contato" />
          </a>
          <button className="btn btn-download" onClick={onDownloadCV}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
            <span>
              <LocalizedText en="Download CV" es="Descargar CV" fr="Télécharger CV" de="CV Herunterladen" pt="Baixar CV" />
            </span>
          </button>
        </div>

        <div className="hero-socials">
          <a href="https://github.com/jesusmandev" target="_blank" rel="noopener noreferrer" className="social-link" title="GitHub">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
          </a>
          <a href="https://www.linkedin.com/in/jesus-manuel-martinez-serpa-088ab33a0" target="_blank" rel="noopener noreferrer" className="social-link" title="LinkedIn">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
            </svg>
          </a>
          <a href="https://app.netlify.com/teams/jesusmanuelserpa23/projects" target="_blank" rel="noopener noreferrer" className="social-link" title="Netlify">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 1.5c5.799 0 10.5 4.701 10.5 10.5S17.799 22.5 12 22.5 1.5 17.799 1.5 12 6.201 1.5 12 1.5zM8.25 6.75v10.5h1.5v-4.5h3v4.5h1.5V6.75h-1.5v4.5h-3v-4.5h-1.5z" />
            </svg>
          </a>
        </div>
      </div>

      <div className="hero-image-wrap floating" id="hero-img-wrap">
        <div className="hero-img-glow"></div>
        <img src={heroImg} alt="Developer" className="hero-img" />
      </div>
    </section>
  );
};

export default Hero;
