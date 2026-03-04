import React, { useEffect, useRef } from 'react';
import { LocalizedText } from '../hooks/useLanguage';

const Projects: React.FC = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);

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

    const cardObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          (entry.target as HTMLElement).style.opacity = '1';
          (entry.target as HTMLElement).style.transform = 'translateY(0) scale(1)';
        } else {
          (entry.target as HTMLElement).style.opacity = '0';
          (entry.target as HTMLElement).style.transform = 'translateY(30px) scale(0.95)';
        }
      });
    }, {
      threshold: 0.08,
      rootMargin: '0px 0px -40px 0px'
    });

    cardsRef.current.forEach(card => {
      if (card) {
        card.style.opacity = '0';
        card.style.transform = 'translateY(30px) scale(0.95)';
        card.style.transition = 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
        cardObserver.observe(card);
      }
    });

    return () => {
      observer.disconnect();
      cardObserver.disconnect();
    };
  }, []);

  const handleClick = (e: React.MouseEvent, url?: string) => {
    if ((e.target as HTMLElement).closest('a') || (e.target as HTMLElement).closest('.btn')) return;
    if (url) {
      window.open(url, '_blank');
    }
  };

  const projects = [
    {
      id: '01',
      url: 'https://jesusmandev.github.io/platform-to-sell-streaming-accounts/',
      featured: true,
      tag: <LocalizedText en="Web App" es="Aplicación Web" fr="App Web" de="Web App" pt="App Web" />,
      title: <LocalizedText en="Streaming Account Store" es="Tienda de Cuentas Streaming" fr="Boutique Streaming" de="Streaming Shop" pt="Loja Streaming" />,
      desc: <LocalizedText en="Full platform to buy and sell streaming service accounts. Complete UI with cart and listings." es="Plataforma completa para comprar y vender cuentas de servicios streaming." fr="Plateforme complète pour acheter et vendre des comptes streaming." de="Vollständige Plattform für Streaming-Konten." pt="Plataforma completa para comprar e vender contas." />,
      tech: ['HTML', 'CSS', 'JS']
    },
    {
      id: '02',
      url: 'https://jesusmandev.github.io/Hangman-game/',
      featured: false,
      tag: 'Game',
      title: <LocalizedText en="Hangman Game" es="Juego del Ahorcado" fr="Jeu du Pendu" de="Galgenmännchen" pt="Jogo da Forca" />,
      desc: <LocalizedText en="Classic hangman game with multiple difficulty levels." es="Juego clásico con múltiples niveles de dificultad." fr="Jeu classique avec plusieurs niveaux." de="Klassisches Spiel mit mehreren Schwierigkeitsgraden." pt="Jogo clássico com vários níveis." />,
      tech: ['HTML', 'CSS', 'JS']
    },
    {
      id: '03',
      url: 'https://jesusmandev.github.io/valentine-card/',
      featured: false,
      tag: <LocalizedText en="Design" es="Diseño" fr="Design" de="Design" pt="Design" />,
      title: <LocalizedText en="Valentine's Day Card" es="Tarjeta de San Valentín" fr="Carte Saint-Valentin" de="Valentinstagkarte" pt="Cartão Dia dos Namorados" />,
      desc: <LocalizedText en="Interactive animated card with CSS effects." es="Tarjeta interactiva animada con efectos CSS." fr="Carte animée interactive avec effets CSS." de="Interaktive animierte Karte mit CSS-Effekten." pt="Cartão animado interativo com efeitos CSS." />,
      tech: ['HTML', 'CSS', 'JS']
    },
    {
      id: '04',
      url: 'https://jesusmandev.github.io/calculadora/',
      featured: false,
      tag: <LocalizedText en="Utility" es="Utilidad" fr="Utilitaire" de="Werkzeug" pt="Utilitário" />,
      title: <LocalizedText en="Calculator" es="Calculadora" fr="Calculatrice" de="Rechner" pt="Calculadora" />,
      desc: <LocalizedText en="Functional calculator with clean UI." es="Calculadora funcional con diseño limpio y operaciones completas." fr="Calculatrice fonctionnelle avec interface claire." de="Funktionsfähiger Rechner mit sauberem UI." pt="Calculadora funcional com design limpo." />,
      tech: ['HTML', 'CSS', 'JS']
    },
    {
      id: '05',
      url: 'https://jesusmandev.github.io/WorldMenu/',
      featured: false,
      tag: <LocalizedText en="Food" es="Comida" fr="Gastronomie" de="Essen" pt="Comida" />,
      title: <LocalizedText en="World Food Menu" es="Menú de Comida Mundial" fr="Menu Mondial" de="Weltmenü" pt="Menu Mundial" />,
      desc: <LocalizedText en="Gastronomic menu showcasing dishes from around the world." es="Menú gastronómico con platos de todo el mundo y diseño llamativo." fr="Menu gastronomique avec des plats du monde entier." de="Gastronomisches Menü mit Gerichten aus aller Welt." pt="Menu gastronômico com pratos de todo o mundo." />,
      tech: ['HTML', 'CSS', 'JS']
    },
    {
      id: '06',
      url: 'https://jesusmandev.github.io/clima-vivo/',
      featured: false,
      tag: 'API',
      title: <LocalizedText en="Weather App" es="Pagina web del Clima" fr="App Météo" de="Wetter App" pt="App Clima" />,
      desc: <LocalizedText en="Real-time weather app using external API." es="Clima en tiempo real con API externa e íconos dinámicos." fr="Application météo en temps réel." de="Echtzeit-Wetter-App mit externer API." pt="App de clima em tempo real." />,
      tech: ['HTML', 'CSS', 'JS', 'API']
    },
    {
      id: '07',
      url: 'https://jesusmandev.github.io/simulator/',
      featured: false,
      tag: <LocalizedText en="Education" es="Educación" fr="Éducation" de="Bildung" pt="Educação" />,
      title: <LocalizedText en="ICFES Simulator" es="Simulador PreIcfes" fr="Simulateur ICFES" de="ICFES Simulator" pt="Simulador PreIcfes" />,
      desc: <LocalizedText en="Pre-ICFES exam simulator with timed questions." es="Simulador del examen PreIcfes con temporizador y puntuación." fr="Simulateur d'examen avec questions chronométrées." de="Prüfungssimulator mit zeitgesteuerten Fragen." pt="Simulador de exame com questões temporizadas." />,
      tech: ['HTML', 'CSS', 'JS']
    },
    {
      id: '08',
      url: 'https://jesusmandev.github.io/CAFES-COLOMBIANOS/',
      featured: false,
      tag: 'Colombia ☕',
      title: <LocalizedText en="Colombian Cafés" es="Cafés Colombianos" fr="Cafés Colombiens" de="Kolumbianische Cafés" pt="Cafés Colombianos" />,
      desc: <LocalizedText en="Landing page showcasing Colombian coffee culture." es="Landing page sobre la cultura del café colombiano." fr="Page d'accueil sur la culture du café colombien." de="Landingpage über kolumbianische Kaffeekultur." pt="Landing page sobre a cultura do café colombiano." />,
      tech: ['HTML', 'CSS', 'JS']
    },
    {
      id: '09',
      url: 'https://jesusmandev.github.io/song/',
      featured: false,
      tag: <LocalizedText en="Music" es="Música" fr="Musique" de="Musik" pt="Música" />,
      title: <LocalizedText en="Music Player" es="Reproductor de Música" fr="Lecteur de Musique" de="Musikplayer" pt="Reprodutor de Música" />,
      desc: <LocalizedText en="Modern music player with full controls and song visualization." es="Reproductor de música moderno con controles completos y visualización de canciones." fr="Lecteur de musique moderne avec contrôles complets et visualisation des chansons." de="Moderner Musikplayer mit vollständiger Steuerung und Songvisualisierung." pt="Reprodutor de música moderno com controles completos e visualização de músicas." />,
      tech: ['HTML', 'CSS', 'JS']
    }
  ];

  return (
    <section id="projects" className="projects-section" ref={sectionRef}>
      <div className="container">
        <div className="section-header">
          <span className="section-tag">
            <LocalizedText en="04. What I've built" es="04. Lo que he creado" fr="04. Mes créations" de="04. Meine Projekte" pt="04. O que construí" />
          </span>
          <h2>
            <LocalizedText en="Projects" es="Proyectos" fr="Projets" de="Projekte" pt="Projetos" />
          </h2>
        </div>
        <div className="projects-grid">
          {projects.map((proj, i) => (
            <div 
              key={proj.id}
              className={`project-card ${proj.featured ? 'featured' : ''}`}
              onClick={(e) => handleClick(e, proj.url)}
              style={{ cursor: 'pointer' }}
              ref={(el) => { if (el) cardsRef.current[i] = el; }}
            >
              <div className="project-number">{proj.id}</div>
              <div className="project-tag">{proj.tag}</div>
              <h3>{proj.title}</h3>
              <p>{proj.desc}</p>
              <div className="project-tech">
                {proj.tech.map(t => <span key={t}>{t}</span>)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Projects;
