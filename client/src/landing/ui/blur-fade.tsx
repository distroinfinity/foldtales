/** Adapted from Magic UI's Blur Fade (MIT, magicui.design). Words arrive softly, once. */
import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';

export function BlurFade({ children, className, delay = 0, duration = 0.6, show = true }: { children: ReactNode; className?: string; delay?: number; duration?: number; show?: boolean }) {
  const still = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={still ? false : { opacity: 0, y: 8, filter: 'blur(6px)' }}
      animate={show ? { opacity: 1, y: 0, filter: 'blur(0px)' } : { opacity: 0, y: 8, filter: 'blur(6px)' }}
      transition={{ delay: 0.04 + delay, duration, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}
