import React, { useEffect, useRef } from 'react';
import { LocalizedText } from '../hooks/useLanguage';

const Contact: React.FC = () => {
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
    <section id="contact" className="contact-section" ref={sectionRef}>
      <div className="container">
        <div className="section-header">
          <span className="section-tag">
            <LocalizedText en="05. Get in touch" es="05. Hablemos" fr="05. Contactez-moi" de="05. Kontakt" pt="05. Contato" />
          </span>
          <h2>
            <LocalizedText en="Contact" es="Contacto" fr="Contact" de="Kontakt" pt="Contato" />
          </h2>
        </div>
        <div className="contact-grid">
          <div className="contact-card" ref={(el) => { if (el) cardsRef.current[0] = el; }}>
            <div className="contact-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2"></rect>
                <path d="M22 4L12 13 2 4"></path>
              </svg>
            </div>
            <h3>Email</h3>
            <p><a href="mailto:jesusmanuelserpa23@gmail.com">jesusmanuelserpa23@gmail.com</a></p>
            <a href="mailto:jesusmanuelserpa23@gmail.com" className="contact-link">
              <LocalizedText en="Send Email" es="Enviar Email" fr="Envoyer Email" de="Email senden" pt="Enviar Email" />
            </a>
          </div>
          <div className="contact-card" ref={(el) => { if (el) cardsRef.current[1] = el; }}>
            <div className="contact-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
              </svg>
            </div>
            <h3>WhatsApp</h3>
            <p>+57 301 468 6477</p>
            <a href="https://wa.me/573014686477" target="_blank" rel="noopener noreferrer" className="contact-link">
              <LocalizedText en="Send Message" es="Enviar Mensaje" fr="Envoyer Message" de="Nachricht senden" pt="Enviar Mensagem" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Contact;
