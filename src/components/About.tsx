import React from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { LocalizedText } from '../hooks/useLanguage';
import animadaImg from '../assets/img/ANIMADA.png';

const About: React.FC = () => {
  // 3D Tilt Logic
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseXSpring = useSpring(x, { stiffness: 300, damping: 30 });
  const mouseYSpring = useSpring(y, { stiffness: 300, damping: 30 });

  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["15deg", "-15deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-15deg", "15deg"]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const xPct = mouseX / width - 0.5;
    const yPct = mouseY / height - 0.5;
    x.set(xPct);
    y.set(yPct);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <section id="about" className="py-24 relative overflow-hidden bg-slate-900/50">
      {/* Subtle Background Glow */}
      <div className="absolute top-1/2 left-0 w-96 h-96 bg-amber-500/10 blur-[150px] -translate-y-1/2 rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <motion.div
           initial={{ opacity: 0, y: 30 }}
           whileInView={{ opacity: 1, y: 0 }}
           viewport={{ margin: "-100px", once: true }} // Re-animates when scrolling up/down
           transition={{ duration: 0.8 }}
           className="text-center mb-16 lg:mb-32 pb-4 lg:pb-0"
        >
          <span className="text-amber-500 font-mono tracking-widest text-sm mb-4 block">
            <LocalizedText en="01. Who am I?" es="01. ¿Quién soy?" fr="01. Qui suis-je?" de="01. Wer bin ich?" pt="01. Quem sou?" />
          </span>
          <h2 className="text-4xl md:text-5xl font-bold font-display tracking-tight text-white mb-4 drop-shadow-[0_0_15px_rgba(245,166,35,0.3)]">
            <LocalizedText en="About Me" es="Acerca de Mí" fr="À propos" de="Über mich" pt="Sobre mim" />
          </h2>
        </motion.div>

        <div className="grid lg:grid-cols-12 gap-8 lg:gap-16 items-center">
          
          {/* Left Column: 3D Image */}
          <motion.div
            initial={{ opacity: 0, x: -80, rotateY: -20 }}
            whileInView={{ opacity: 1, x: 0, rotateY: 0 }}
            viewport={{ margin: "-100px", once: true }}
            transition={{ duration: 1, type: "spring", bounce: 0.4 }}
            className="flex justify-center perspective-[1200px] lg:col-span-5"
          >
            <motion.div
              style={{
                rotateX,
                rotateY,
                transformStyle: "preserve-3d",
              }}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              className="relative w-full max-w-[400px] rounded-3xl"
            >
              {/* Image Container with Glassmorphism Border */}
              <div 
                className="relative bg-slate-800/40 backdrop-blur-md rounded-[2.5rem] p-4 border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden" 
                style={{ transform: "translateZ(30px)" }}
              >
                {/* Embedded Glow */}
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/20 to-purple-600/20 opacity-0 hover:opacity-100 transition-opacity duration-500" />
                <img 
                  src={animadaImg} 
                  alt="Jesus Martinez Animated" 
                  className="w-full h-auto rounded-[2rem] object-cover drop-shadow-[0_0_15px_rgba(255,255,255,0.1)] relative z-10"
                />
              </div>
            </motion.div>
          </motion.div>

          {/* Right Column: Text and Stats */}
          <motion.div
            initial={{ opacity: 0, x: 80 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ margin: "-100px", once: true }}
            transition={{ duration: 1, delay: 0.2, type: "spring", bounce: 0.4 }}
            className="flex flex-col space-y-8 lg:col-span-7"
          >
            <div className="space-y-8 text-lg text-slate-200 leading-loose font-light">
              <p>
                <LocalizedText 
                  en="Hello! I'm Jesus Martinez, a Frontend Developer from Colombia with a global vision. I specialize in building robust applications using TypeScript, React, and Next.js, while maintaining a strong foundation in HTML, CSS, and JavaScript. My passion is creating the bridge between design and functionality, using Vite for fast builds and testing, and integrating complex APIs to deliver impactful digital solutions." 
                  es="¡Hola! Soy Jesus Martinez, un desarrollador Frontend de Colombia con una visión global. Me especializo en construir aplicaciones robustas usando TypeScript, React y Next.js, manteniendo siempre una base sólida en HTML, CSS y JavaScript. Mi pasión es crear el puente entre el diseño y la funcionalidad, utilizando Vite para realizar pruebas y compilaciones rápidas, e integrando APIs complejas para ofrecer soluciones digitales impactantes." 
                  fr="Bonjour ! Je suis Jesus Martinez, un développeur Frontend de Colombie avec une vision mondiale. Je me spécialise dans la construction d'applications robustes utilisant TypeScript, React et Next.js, tout en conservant une base solide en HTML, CSS et JavaScript." 
                  de="Hallo! Ich bin Jesus Martinez, ein Frontend-Entwickler aus Kolumbien mit einer globalen Vision. Ich spezialisiere mich auf den Aufbau robuster Anwendungen mit TypeScript, React und Next.js, wobei ich eine starke Basis in HTML, CSS und JavaScript beibehalte." 
                  pt="Olá! Sou Jesus Martinez, um desenvolvedor Frontend da Colômbia com uma visão global. Especializo-me na construção de aplicações robustas usando TypeScript, React e Next.js, mantendo uma base sólida em HTML, CSS e JavaScript." 
                />
              </p>
              <p className="py-2 italic text-white/80">
                <LocalizedText 
                  en="I believe in learning by doing — every project is a new challenge that pushes my skills further." 
                  es="Creo en aprender haciendo — cada proyecto es un nuevo reto que lleva mis habilidades más lejos." 
                  fr="Je crois en l'apprentissage par la pratique — chaque projet est un nouveau défi." 
                  de="Ich glaube an Lernen durch Tun — jedes Projekt ist eine neue Herausforderung." 
                  pt="Acredito em aprender fazendo — cada projeto é um novo desafio." 
                />
              </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6 pt-8 lg:pt-10 mt-4 border-t border-white/5">
              {[
                { num: "1", label: { en: "Years Experience", es: "Años de Experiencia", fr: "Années d'expérience", de: "Erfahrung", pt: "Anos de Experiência" }, href: null },
                { num: "8+", label: { en: "Projects Built", es: "Proyectos Creados", fr: "Projets créés", de: "Projekte", pt: "Projetos Criados" }, href: "#projects" },
                { num: "∞", label: { en: "Motivation", es: "Motivación", fr: "Motivation", de: "Motivation", pt: "Motivação" }, href: null }
              ].map((stat, i) => {
                const isClickable = !!stat.href;
                const baseClass = "flex flex-col items-center bg-slate-800/40 border border-white/10 rounded-2xl p-4 transition-colors";
                const hoverClass = isClickable 
                  ? "cursor-pointer hover:border-amber-500 hover:bg-slate-800/70 hover:shadow-[0_0_20px_rgba(245,166,35,0.2)] hover:-translate-y-2"
                  : "hover:border-amber-500/50 hover:-translate-y-1";

                const content = (
                  <>
                    <span className="text-4xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-600 drop-shadow-[0_0_10px_rgba(245,166,35,0.4)] mb-2">
                      {stat.num}
                    </span>
                    <span className="text-xs uppercase tracking-widest text-slate-400 text-center font-mono font-bold">
                      <LocalizedText {...stat.label} />
                    </span>
                  </>
                );

                if (isClickable) {
                  return (
                    <motion.a 
                      key={i}
                      href={stat.href!}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ margin: "-50px", once: true }}
                      transition={{ duration: 0.6, delay: 0.4 + (i * 0.1) }}
                      className={`${baseClass} ${hoverClass}`}
                    >
                      {content}
                    </motion.a>
                  );
                }

                return (
                  <motion.div 
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ margin: "-50px" }}
                    transition={{ duration: 0.6, delay: 0.4 + (i * 0.1) }}
                    className={`${baseClass} ${hoverClass}`}
                  >
                    {content}
                  </motion.div>
                );
              })}
            </div>
            
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default About;
