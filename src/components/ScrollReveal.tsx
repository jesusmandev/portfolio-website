import React from 'react';
import { motion, useInView } from 'motion/react';

interface ScrollRevealProps {
  children: React.ReactNode;
  direction?: 'left' | 'right';
  className?: string;
}

const ScrollReveal: React.FC<ScrollRevealProps> = ({ 
  children, 
  direction = 'left',
  className = ""
}) => {
  const ref = React.useRef(null);
  const isInView = useInView(ref, { 
    once: true, 
    amount: 0.2 
  });

  const variants = {
    hidden: { 
      opacity: 0, 
      x: direction === 'left' ? -100 : 100 
    },
    visible: { 
      opacity: 1, 
      x: 0 
    }
  };

  return (
    <div ref={ref} className={`w-full overflow-x-hidden ${className}`}>
      <motion.div
        variants={variants}
        initial="hidden"
        animate={isInView ? "visible" : "hidden"}
        transition={{ 
          duration: 0.6, 
          ease: "easeInOut" 
        }}
      >
        {children}
      </motion.div>
    </div>
  );
};

export default ScrollReveal;
