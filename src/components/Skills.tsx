import React, { useEffect, useRef } from 'react';
import { LocalizedText } from '../hooks/useLanguage';

const Skills: React.FC = () => {
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
          entry.target.classList.add('animated');
        } else {
          (entry.target as HTMLElement).style.opacity = '0';
          (entry.target as HTMLElement).style.transform = 'translateY(30px) scale(0.95)';
          entry.target.classList.remove('animated');
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

  const skills = [
    { name: 'HTML5', width: 85, svg: <svg viewBox="0 0 128 128" width="40" height="40"><path fill="#E44D26" d="M19.037 113.876L9.032 1.661h109.936l-10.016 112.198-45.019 12.48z"></path><path fill="#F16529" d="M64 116.8l36.378-10.086 8.559-95.878H64z"></path><path fill="#EBEBEB" d="M64 52.455H45.788L44.53 38.361H64V24.599H29.489l.33 3.692 3.382 37.927H64zm0 35.743l-.061.017-15.327-4.14-.979-10.975H33.816l1.928 21.609 28.193 7.826.063-.017z"></path><path fill="#fff" d="M63.952 52.455v13.763h16.947l-1.597 17.849-15.35 4.143v14.319l28.215-7.82.207-2.325 3.234-36.233.335-3.696h-3.708zm0-27.856v13.762h33.244l.276-3.092.628-6.978.329-3.692z"></path></svg> },
    { name: 'CSS3', width: 80, svg: <svg viewBox="0 0 128 128" width="40" height="40"><path fill="#1572B6" d="M18.814 114.123L8.76 1.352h110.48l-10.064 112.754-45.243 12.543-45.119-12.526z"></path><path fill="#33A9DC" d="M64.001 117.062l36.559-10.136 8.601-96.354h-45.16v106.49z"></path><path fill="#fff" d="M64.001 51.429h18.302l1.264-14.163H64.001V23.435h34.682l-.332 3.711-3.4 38.114h-30.95V51.429z"></path><path fill="#EBEBEB" d="M64.083 87.349l-.061.018-15.403-4.159-.985-11.031H33.752l1.937 21.717 28.331 7.863.063-.018v-14.39z"></path><path fill="#fff" d="M81.127 64.675l-1.666 18.522-15.426 4.164v14.39l28.354-7.858.208-2.337 2.406-26.881H81.127z"></path><path fill="#EBEBEB" d="M64.048 23.435v13.831H30.64l-.277-3.108-.63-7.012-.331-3.711h34.646zm-.047 27.996v13.831H48.792l-.277-3.108-.631-7.012-.33-3.711h16.447z"></path></svg> },
    { name: 'JavaScript', width: 70, svg: <svg viewBox="0 0 128 128" width="40" height="40"><path fill="#F0DB4F" d="M1.408 1.408h125.184v125.185H1.408z"></path><path fill="#323330" d="M116.347 96.736c-.917-5.711-4.641-10.508-15.672-14.981-3.832-1.761-8.104-3.022-9.377-5.926-.452-1.69-.512-2.642-.226-3.665.821-3.32 4.784-4.355 7.925-3.403 2.023.678 3.938 2.237 5.093 4.724 5.402-3.498 5.391-3.475 9.163-5.879-1.381-2.141-2.118-3.129-3.022-4.045-3.249-3.629-7.676-5.498-14.756-5.355l-3.688.477c-3.534.893-6.902 2.748-8.877 5.235-5.926 6.724-4.236 18.492 2.975 23.335 7.104 5.332 17.54 6.545 18.873 11.531 1.297 6.104-4.486 8.08-10.234 7.378-4.236-.881-6.592-3.034-9.139-6.949-4.688 2.713-4.688 2.713-9.508 5.485 1.143 2.499 2.344 3.63 4.26 5.795 9.068 9.198 31.76 8.746 35.83-5.176.165-.478 1.261-3.666.38-8.581zM69.462 58.943H57.753l-.048 30.272c0 6.438.333 12.34-.714 14.149-1.713 3.558-6.152 3.117-8.175 2.427-2.059-1.012-3.106-2.451-4.319-4.485-.333-.584-.583-1.036-.667-1.071l-9.52 5.83c1.583 3.249 3.915 6.069 6.902 7.901 4.462 2.678 10.459 3.499 16.731 2.059 4.082-1.189 7.604-3.652 9.448-7.401 2.666-4.915 2.094-10.864 2.07-17.444.06-10.735.001-21.468.001-32.237z"></path></svg> },
    { name: 'React', width: 60, svg: <svg width="40" height="40" viewBox="-10.5 -9.45 21 18.9" fill="none"><circle cx="0" cy="0" r="2" fill="#61dafb"></circle><g stroke="#61dafb" strokeWidth="1" fill="none"><ellipse rx="10" ry="4.5"></ellipse><ellipse rx="10" ry="4.5" transform="rotate(60)"></ellipse><ellipse rx="10" ry="4.5" transform="rotate(120)"></ellipse></g></svg> },
    { name: 'TypeScript', width: 70, svg: <svg width="40" height="40" viewBox="0 0 24 24" fill="none"><rect x="4" y="4" width="16" height="16" fill="#3178C6" rx="2" /><path d="M10 10H8v4H7v-4H5V9h5v1zm2 1.5c0-.8.6-1.5 1.5-1.5h2c.8 0 1.5.7 1.5 1.5v.5h-1v-.5c0-.3-.2-.5-.5-.5h-2c-.3 0-.5.2-.5.5v.5c0 .3.2.5.5.5h1.5c.8 0 1.5.7 1.5 1.5v.5c0 .8-.6 1.5-1.5 1.5h-2c-.8 0-1.5-.7-1.5-1.5v-.5h1v.5c0 .3.2.5.5.5h2c.3 0 .5-.2.5-.5v-.5c0-.3-.2-.5-.5-.5h-1.5c-.8 0-1.5-.7-1.5-1.5v-.5z" fill="#FFF" /></svg> },
    { name: 'Node.js', width: 50, svg: <svg width="40" height="40" viewBox="0 0 128 128" fill="none"><path fill="#339933" d="M64 4L14 33v58l50 29 50-29V33z"/><path fill="#fff" d="M66.6 92.5c-4.4 0-7.8-1.5-10-4.6l5.3-5c1.4 1.7 3.1 2.6 5 2.6 2.3 0 3.6-1.1 3.6-2.9 0-3.6-12.8-1.8-12.8-10.7 0-4.5 3.3-7.5 8.7-7.5 3.8 0 6.6 1.2 8.5 3.5l-4.8 5.1c-1.3-1.4-2.6-2-4.1-2-1.7 0-2.8.9-2.8 2.2 0 3 12.8 1.4 12.8 10.5 0 4.9-3.7 8.3-9.4 8.3zm-27.2-2.1V74.9c-2 .7-4 1-5.7 1-4.8 0-7.2-2.5-7.2-7.5V65h-4.3v-6.9H26.5V50h7v8h6.1v6.9h-6.1v10.5c0 1.9.9 2.8 2.7 2.8.9 0 2-.2 3.2-.5v7.2zm38.2-15.6V71c0 6.2 3.6 8.3 8.3 8.3 3.6 0 6.1-1.2 7.5-3.5v3.1h7v-25h-7v2.8c-1.4-1.9-3.9-3.2-7.3-3.2-5.7 0-10.2 4.4-10.2 10.7 0 6.2 4.1 10.6 8.6 10.6zm15.4-8.7c0-2.6-1.8-4.3-4.1-4.3s-4.3 1.8-4.3 4.3 1.8 4.3 4.3 4.3 4.1-1.7 4.1-4.3zm19.6-12.6v28.8h-7v-3.7c-1.6 2.5-4.4 4.1-8.2 4.1-6.1 0-10.9-4.8-10.9-10.9s4.8-10.9 10.9-10.9c3.8 0 6.6 1.6 8.2 4.1v-11.5h7zM113 74.5c0-2.6-1.8-4.3-4.1-4.3s-4.3 1.8-4.3 4.3 1.8 4.3 4.3 4.3 4.1-1.7 4.1-4.3z"/></svg> },
    { name: 'Vite', width: 65, svg: <svg width="40" height="40" viewBox="0 0 24 24" fill="none"><path d="M12.999 1L5 8l1.5 5.5v.5h-1L15 6v1.5l1.5-1L22 4l-9-3z" fill="#646CFF" /><path d="M12.999 1l-7.999 7 5 1 1 8L15 6.5l-6-1 1.999-4.5z" fill="#FFD859" /><path d="M22 4l-4 8.5 1-2.5L22 4z" fill="#646CFF"/></svg> },
    { name: 'Responsive Design', width: 75, svg: <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12" y2="18.01"></line><path d="M2 7h4M18 7h4M2 12h4M18 12h4"></path></svg> },
    { name: 'DOM Manipulation', width: 72, svg: <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline><line x1="14" y1="4" x2="10" y2="20"></line></svg> },
    { name: 'Git & GitHub', width: 65, svg: <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="18" r="3"></circle><circle cx="6" cy="6" r="3"></circle><path d="M13 6h3a2 2 0 0 1 2 2v7"></path><line x1="6" y1="9" x2="6" y2="21"></line></svg> },
    { name: 'API Consumption', width: 80, svg: <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8c0 1.5-1.5 2.5-3 2.5-1.5 0-2.5-1-2.5-2.5S14 5.5 15.5 5.5s3 1 3 2.5Z"></path><path d="M12 11c-1.5 0-3 1-3 2.5s1 2.5 2.5 2.5 3-1 3-2.5"></path><path d="M9 16c-1.5 0-3 1-3 2.5s1 2.5 2.5 2.5 3-1 3-2.5"></path><path d="M14 9.5l-2 1.5"></path><path d="M10 13.5l-1 2.5"></path></svg> },
  ];

  return (
    <section id="skills" className="skills-section" ref={sectionRef}>
      <div className="container">
        <div className="section-header">
          <span className="section-tag">
            <LocalizedText en="02. What I use" es="02. Qué uso" fr="02. Ce que j'utilise" de="02. Was ich nutze" pt="02. O que uso" />
          </span>
          <h2>
            <LocalizedText en="Skills" es="Habilidades" fr="Compétences" de="Fähigkeiten" pt="Habilidades" />
          </h2>
        </div>
        <div className="skills-grid">
          {skills.map((skill, index) => (
            <div 
              key={skill.name} 
              className="skill-card" 
              ref={(el) => { if (el) cardsRef.current[index] = el; }}
            >
              <div className="skill-icon">
                {skill.svg}
              </div>
              <h3>{skill.name}</h3>
              <div className="skill-bar">
                <div className="skill-fill" style={{ '--w': `${skill.width}%` } as React.CSSProperties}></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Skills;
