import React, { useState, useEffect } from 'react';
import { useLanguage } from '../hooks/useLanguage';

interface NavbarProps {
  currentSection: string;
}

const Navbar: React.FC<NavbarProps> = ({ currentSection }) => {
  const { currentLang, setLanguage } = useLanguage();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 80);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { id: 'home', es: 'Inicio', en: 'Home', fr: 'Accueil', de: 'Startseite', pt: 'Início' },
    { id: 'about', es: 'Acerca', en: 'About', fr: 'À propos', de: 'Über', pt: 'Sobre' },
    { id: 'skills', es: 'Habilidades', en: 'Skills', fr: 'Compétences', de: 'Fähigkeiten', pt: 'Habilidades' },
    { id: 'certifications', es: 'Certificaciones', en: 'Certifications', fr: 'Certifications', de: 'Zertifikate', pt: 'Certificações' },
    { id: 'projects', es: 'Proyectos', en: 'Projects', fr: 'Projets', de: 'Projekte', pt: 'Projetos' },
    { id: 'contact', es: 'Contacto', en: 'Contact', fr: 'Contact', de: 'Kontakt', pt: 'Contato' },
  ];

  return (
    <nav className="navbar" style={isScrolled ? { background: 'rgba(9, 11, 20, 0.96)', boxShadow: '0 4px 30px rgba(0,0,0,0.4)' } : { background: 'rgba(9, 11, 20, 0.7)', boxShadow: 'none' }}>
      <div className="nav-logo">
        <span className="logo-bracket">&lt;</span>JM<span className="logo-bracket">/&gt;</span>
      </div>
      <ul className={`nav-menu ${isMenuOpen ? 'open' : ''}`}>
        {navLinks.map((link) => (
          <li key={link.id}>
            <a
              href={`#${link.id}`}
              className={currentSection === link.id ? 'active' : ''}
              onClick={() => setIsMenuOpen(false)}
            >
              {link[currentLang as keyof typeof link]}
            </a>
          </li>
        ))}
      </ul>
      <div className="lang-switcher">
        {['es', 'en', 'fr', 'de', 'pt'].map((code) => (
          <button
            key={code}
            className={`lang-btn ${currentLang === code ? 'active' : ''}`}
            onClick={() => setLanguage(code as 'es' | 'en' | 'fr' | 'de' | 'pt')}
            title={code.toUpperCase()}
          >
            {code.toUpperCase()}
          </button>
        ))}
      </div>
      <button className="hamburger" id="hamburger" onClick={() => setIsMenuOpen(!isMenuOpen)}>
        <span></span><span></span><span></span>
      </button>
    </nav>
  );
};

export default Navbar;
