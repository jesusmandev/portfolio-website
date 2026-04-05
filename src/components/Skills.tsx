import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
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
          cardObserver.unobserve(entry.target); // <--- optimization!
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
    { name: 'HTML5', width: 92, svg: <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/html5/html5-original.svg" alt="HTML5" width="40" height="40" /> },
    { name: 'CSS3', width: 90, svg: <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/css3/css3-original.svg" alt="CSS3" width="40" height="40" /> },
    { name: 'JavaScript', width: 88, svg: <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/javascript/javascript-original.svg" alt="JavaScript" width="40" height="40" /> },
    { name: 'React', width: 90, svg: <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/react/react-original.svg" alt="React" width="40" height="40" /> },
    { name: 'TypeScript', width: 88, svg: <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/typescript/typescript-original.svg" alt="TypeScript" width="40" height="40" /> },
    { name: 'Node.js', width: 80, svg: <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/nodejs/nodejs-original.svg" alt="Node.js" width="40" height="40" /> },
    { name: 'Vite', width: 85, svg: <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/vitejs/vitejs-original.svg" alt="Vite" width="40" height="40" /> },
    { name: 'Responsive Design', width: 85, svg: <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/><rect x="6" y="6" width="5" height="8" rx="1" fill="none" stroke="#0ea5e9" strokeWidth="1"/></svg> },
    { name: 'DOM Manipulation', width: 82, svg: <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#f5a623" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg> },
    { name: 'Git & GitHub', width: 82, svg: <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/git/git-original.svg" alt="Git" width="40" height="40" /> },
    { name: 'APIs', width: 85, svg: <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg> },
  ];

  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIndex((prev) => prev + 1);
    }, 2300); // 1.5s pause + 0.8s rotation animation time
    return () => clearInterval(timer);
  }, []);

  const angleStep = 360 / skills.length;

  return (
    <section id="skills" className="skills-section relative overflow-hidden" ref={sectionRef}>
      <div className="container relative z-10">
        <div className="section-header">
          <span className="section-tag">
            <LocalizedText 
              en="02. Mastering the Tech" 
              es="02. Dominando la Tecnología" 
              fr="02. Maîtriser la technologie" 
              de="02. Die Technik beherrschen" 
              pt="02. Dominando a Tecnologia" 
            />
          </span>
          <h2>
            <LocalizedText 
              en="Skills" 
              es="Habilidades" 
              fr="Compétences" 
              de="Fähigkeiten" 
              pt="Habilidades" 
            />
          </h2>
        </div>

        {/* 3D Orbit Carousel */}
        <div 
          className="relative w-full flex justify-center items-center mt-10 md:mt-20 mb-16 md:mb-32" 
          style={{ height: '400px', perspective: '1200px' }}
        >
          <motion.div
            style={{
              position: 'relative',
              width: 80,
              height: 80,
              transformStyle: 'preserve-3d',
            }}
            animate={{ rotateY: -activeIndex * angleStep }}
            transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }} 
          >
            {skills.map((skill, index) => {
              const theta = index * angleStep;
              // Determine if this skill is currently at the front of the carousel
              const isFront = (activeIndex % skills.length) === index;
              
              return (
                <div
                  key={skill.name}
                  className="absolute top-0 left-0 w-full h-full flex justify-center items-center"
                  style={{
                    transform: `rotateY(${theta}deg) translateZ(clamp(130px, 35vw, 320px))`,
                    transformStyle: 'preserve-3d'
                  }}
                >
                  <motion.div
                    className="skill-carousel-item flex flex-col justify-center items-center rounded-2xl cursor-pointer transition-colors relative"
                    title={skill.name}
                    style={{
                       width: 'clamp(65px, 20vw, 130px)',
                       height: 'clamp(65px, 20vw, 130px)',
                       background: isFront ? 'rgba(30, 41, 59, 1)' : 'rgba(30, 41, 59, 0.8)',
                       border: isFront ? '2px solid rgba(245, 166, 35, 0.6)' : '1px solid rgba(255, 255, 255, 0.1)',
                       boxShadow: isFront ? '0 0 35px rgba(245, 166, 35, 0.3)' : '0 0 15px rgba(0,0,0,0.5)',
                    }}
                    animate={{ rotateY: activeIndex * angleStep - theta }}
                    transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
                    whileHover={{ scale: 1.15 }}
                  >
                    <div style={{ width: '65%', height: '65%', display: 'flex', justifySelf: 'center', alignItems: 'center' }}>
                      {skill.svg}
                    </div>
                    
                    {/* Name appears when in front */}
                    {isFront && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                        className="absolute -bottom-10 whitespace-nowrap text-amber-500 font-mono text-sm md:text-base font-bold drop-shadow-md"
                      >
                        {skill.name}
                      </motion.div>
                    )}
                  </motion.div>
                </div>
              );
            })}
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default Skills;
