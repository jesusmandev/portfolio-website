import React, { useEffect, useRef } from 'react';
import { LocalizedText } from '../hooks/useLanguage';

const About: React.FC = () => {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-in');
        } else {
          entry.target.classList.remove('animate-in');
        }
      });
    }, {
      threshold: 0.15,
      rootMargin: '0px 0px -30px 0px'
    });

    const header = sectionRef.current?.querySelector('.section-header');
    if (header) observer.observe(header);

    return () => observer.disconnect();
  }, []);

  return (
    <section id="about" className="about-section" ref={sectionRef}>
      <div className="container">
        <div className="section-header">
          <span className="section-tag">
            <LocalizedText en="01. Who am I?" es="01. ¿Quién soy?" fr="01. Qui suis-je?" de="01. Wer bin ich?" pt="01. Quem sou?" />
          </span>
          <h2>
            <LocalizedText en="About Me" es="Acerca de Mí" fr="À propos" de="Über mich" pt="Sobre mim" />
          </h2>
        </div>
        <div className="about-grid">
          <div className="about-text">
            <p>
              <LocalizedText 
                en="Hello! I'm Jesus Martinez, a Frontend Developer from Colombia with a global vision. I specialize in building robust applications using TypeScript, React, and Next.js, while maintaining a strong foundation in HTML, CSS, and JavaScript. My passion is creating the bridge between design and functionality, using Vite for fast builds and testing, and integrating complex APIs to deliver impactful digital solutions. Thanks to my command of English, I collaborate on international projects ensuring high-quality, modern web experiences." 
                es="¡Hola! Soy Jesus Martinez, un desarrollador Frontend de Colombia con una visión global. Me especializo en construir aplicaciones robustas usando TypeScript, React y Next.js, manteniendo siempre una base sólida en HTML, CSS y JavaScript. Mi pasión es crear el puente entre el diseño y la funcionalidad, utilizando Vite para realizar pruebas y compilaciones rápidas, e integrando APIs complejas para ofrecer soluciones digitales impactantes. Gracias a mi dominio del inglés, colaboro en proyectos internacionales asegurando experiencias web modernas y de alta calidad." 
                fr="Bonjour ! Je suis Jesus Martinez, un développeur Frontend de Colombie avec une vision mondiale. Je me spécialise dans la construction d'applications robustes utilisant TypeScript, React et Next.js, tout en conservant une base solide en HTML, CSS et JavaScript. Ma passion est de créer le pont entre le design et la fonctionnalité, en utilisant Vite pour des tests et des compilations rapides, et en intégrant des API complexes." 
                de="Hallo! Ich bin Jesus Martinez, ein Frontend-Entwickler aus Kolumbien mit einer globalen Vision. Ich spezialisiere mich auf den Aufbau robuster Anwendungen mit TypeScript, React und Next.js, wobei ich eine starke Basis in HTML, CSS und JavaScript beibehalte. Meine Leidenschaft ist es, die Brücke zwischen Design und Funktionalität zu schlagen, Vite für schnelles Testen und Bauen zu nutzen und komplexe APIs zu integrieren." 
                pt="Olá! Sou Jesus Martinez, um desenvolvedor Frontend da Colômbia com uma visão global. Especializo-me na construção de aplicações robustas usando TypeScript, React e Next.js, mantendo uma base sólida em HTML, CSS e JavaScript. Minha paixão é criar a ponte entre o design e a funcionalidade, utilizando o Vite para testes e compilações rápidas, e integrando APIs complexas." 
              />
            </p>
            <p>
              <LocalizedText 
                en="I believe in learning by doing — every project is a new challenge that pushes my skills further." 
                es="Creo en aprender haciendo — cada proyecto es un nuevo reto que lleva mis habilidades más lejos." 
                fr="Je crois en l'apprentissage par la pratique — chaque projet est un nouveau défi." 
                de="Ich glaube an Lernen durch Tun — jedes Projekt ist eine neue Herausforderung." 
                pt="Acredito em aprender fazendo — cada projeto é um novo desafio." 
              />
            </p>
            <a href="#contact" className="btn btn-primary">
              <LocalizedText en="Let's Talk" es="Hablemos" fr="Parlons" de="Kontakt" pt="Vamos conversar" />
            </a>
          </div>
          <div className="about-stats">
            <div className="stat-card" style={{ opacity: 1, transform: 'translateY(0)' }}>
              <span className="stat-number">1</span>
              <span className="stat-label">
                <LocalizedText en="Years Experience" es="Años de Experiencia" fr="Années d'expérience" de="Jahrelange Erfahrung" pt="Anos de Experiência" />
              </span>
            </div>
            <div className="stat-card" style={{ opacity: 1, transform: 'translateY(0)' }}>
              <span className="stat-number">8+</span>
              <span className="stat-label">
                <LocalizedText en="Projects Built" es="Proyectos Creados" fr="Projets créés" de="Projekte erstellt" pt="Projetos Criados" />
              </span>
            </div>
            <div className="stat-card" style={{ opacity: 1, transform: 'translateY(0)' }}>
              <span className="stat-number">∞</span>
              <span className="stat-label">
                <LocalizedText en="Motivation" es="Motivación" fr="Motivation" de="Motivation" pt="Motivação" />
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default About;
