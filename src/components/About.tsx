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
                en="Hello! I'm Jesus Martinez, a Frontend Developer from Colombia with a global vision. My passion is building the bridge between design and functionality, ensuring that every web page is not only visually attractive in its blue tones, but also intuitive for the user. Thanks to my command of English, I can collaborate on international projects applying best practices in HTML, CSS, and JavaScript." 
                es="¡Hola! Soy Jesus Martinez, un desarrollador Frontend de Colombia con una visión global. Mi pasión es construir el puente entre el diseño y la funcionalidad, asegurando que cada página web no solo sea visualmente atractiva en sus tonos azules, sino también intuitiva para el usuario. Gracias a mi dominio del inglés, puedo colaborar en proyectos internacionales aplicando las mejores prácticas en HTML, CSS y JavaScript." 
                fr="Bonjour ! Je suis Jesus Martinez, un développeur Frontend de Colombie avec une vision mondiale. Ma passion est de bâtir le pont entre le design et la fonctionnalité, en veillant à ce que chaque page web soit non seulement visuellement attrayante dans ses tons bleus, mais aussi intuitive pour l'utilisateur. Grâce à ma maîtrise de l'anglais, je peux collaborer sur des projets internationaux en appliquant les meilleures pratiques en HTML, CSS et JavaScript." 
                de="Hallo! Ich bin Jesus Martinez, ein Frontend-Entwickler aus Kolumbien mit einer globalen Vision. Meine Leidenschaft ist es, die Brücke zwischen Design und Funktionalität zu schlagen und sicherzustellen, dass jede Webseite nicht nur in ihren Blautönen visuell ansprechend, sondern auch für den Benutzer intuitiv ist. Dank meiner Englischkenntnisse kann ich an internationalen Projekten mitarbeiten und Best Practices in HTML, CSS und JavaScript anwenden." 
                pt="Olá! Sou Jesus Martinez, um desenvolvedor Frontend da Colômbia com uma visão global. Minha paixão é construir a ponte entre o design e a funcionalidade, garantindo que cada página web não seja apenas visualmente atraente em seus tons azuis, mas também intuitiva para o usuário. Graças ao meu domínio do inglês, posso colaborar em projetos internacionais aplicando as melhores práticas em HTML, CSS e JavaScript." 
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
