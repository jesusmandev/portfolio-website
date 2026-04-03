import { motion } from 'motion/react';
import type { Variants } from 'motion/react';

interface BlurTextProps {
  text: string;
  delay?: number;
  animateBy?: 'words' | 'letters';
  direction?: 'top' | 'bottom';
  onAnimationComplete?: () => void;
  className?: string;
  color?: string;
}

const BlurText: React.FC<BlurTextProps> = ({ 
  text, 
  delay = 50, 
  animateBy = 'words', 
  direction = 'top', 
  onAnimationComplete,
  className = '',
  color
}) => {
  const elements = animateBy === 'words' ? text.split(' ') : text.split('');
  
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: delay / 1000,
      }
    }
  };

  const childVariants: Variants = {
    hidden: { 
      opacity: 0, 
      filter: 'blur(8px)',
      y: direction === 'top' ? -20 : 20 
    },
    visible: { 
      opacity: 1, 
      filter: 'blur(0px)',
      y: 0,
      transition: {
        duration: 0.6,
        ease: [0.33, 1, 0.68, 1]
      }
    }
  };

  return (
    <motion.div 
      className={`inline-block ${className}`}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      onAnimationComplete={onAnimationComplete}
      style={{ color: color }}
    >
      {elements.map((el, i) => (
        <motion.span 
          key={i} 
          variants={childVariants} 
          className="inline-block"
          style={{ marginRight: animateBy === 'words' ? '0.25em' : '0' }}
        >
          {el === ' ' ? '\u00A0' : el}
        </motion.span>
      ))}
    </motion.div>
  );
};

export default BlurText;
