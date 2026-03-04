import React, { useEffect, useRef } from 'react';
import { LocalizedText } from '../hooks/useLanguage';

interface CertificationsProps {
  onOpenCert: (src: string) => void;
}

const Certifications: React.FC<CertificationsProps> = ({ onOpenCert }) => {
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

  return (
    <section id="certifications" className="certifications-section" ref={sectionRef}>
      <div className="container">
        <div className="section-header">
          <span className="section-tag">
            <LocalizedText 
              en="03. My Learning Journey" 
              es="03. Mi Camino de Aprendizaje" 
              fr="03. Mon Parcours" 
              de="03. Mein Lernweg" 
              pt="03. Minha Jornada" 
            />
          </span>
          <h2>
            <LocalizedText en="Certifications" es="Certificaciones" fr="Certifications" de="Zertifikate" pt="Certificações" />
          </h2>
        </div>
        <div className="certifications-grid">
          <div 
            className="cert-card" 
            style={{ cursor: 'pointer' }} 
            onClick={() => onOpenCert('img/171033285.jpg')}
            ref={(el) => { if (el) cardsRef.current[0] = el; }}
          >
            <img src="img/171033285.jpg" alt="Certificado Udemy" className="cert-img" />
            <div className="cert-info">
              <h3>
                <LocalizedText en="Programming Steps" es="Programación Primeros Pasos" fr="Premiers Pas" de="Programación Primeros Pasos" pt="Programación Primeros Pasos" />
              </h3>
              <p>Udemy</p>
            </div>
          </div>
          <div 
            className="cert-card" 
            style={{ cursor: 'pointer' }} 
            onClick={() => onOpenCert('img/image.png')}
            ref={(el) => { if (el) cardsRef.current[1] = el; }}
          >
            <img src="img/image.png" alt="Certificado Platzi" className="cert-img" />
            <div className="cert-info">
              <h3>
                <LocalizedText en="Basic Programming" es="Programación Básica" fr="Programmation de Base" de="Programación Básica" pt="Programación Básica" />
              </h3>
              <p>Platzi</p>
            </div>
          </div>
          <div 
            className="cert-card" 
            style={{ cursor: 'pointer' }} 
            onClick={() => onOpenCert('img/react.jpg')}
            ref={(el) => { if (el) cardsRef.current[2] = el; }}
          >
            <img src="img/react.jpg" alt="Certificado React" className="cert-img" />
            <div className="cert-info">
              <h3>
                <LocalizedText en="React: From zero to expert" es="React: De cero a experto" fr="React: De zéro à expert" de="React: Von Null zum Experten" pt="React: Do zero a especialista" />
              </h3>
              <p>Udemy</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Certifications;
