/** Adapted from Magic UI's Text Animate (MIT, magicui.design): a line that writes itself, letter by letter. */
import { motion, useReducedMotion } from 'motion/react';

export function TextAnimate({ text, className, play, stagger = 0.035, delay = 0 }: { text: string; className?: string; play: boolean; stagger?: number; delay?: number }) {
  const still = useReducedMotion();
  if (still) return <span className={className}>{text}</span>;
  return (
    <span className={className} aria-label={text}>
      {[...text].map((ch, i) => (
        <motion.span
          key={i}
          aria-hidden
          initial={{ opacity: 0, filter: 'blur(4px)' }}
          animate={play ? { opacity: 1, filter: 'blur(0px)' } : { opacity: 0, filter: 'blur(4px)' }}
          transition={{ delay: play ? delay + i * stagger : 0, duration: 0.25 }}
        >
          {ch}
        </motion.span>
      ))}
    </span>
  );
}
