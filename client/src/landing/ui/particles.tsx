/**
 * Adapted from Magic UI's Particles (MIT, magicui.design): a few motes drifting in the lamp's light.
 * No pointer magnetism (hover doesn't exist for hands on the Quest), and nothing at all for reduced motion.
 */
import { useEffect, useRef } from 'react';

export function Particles({ className, quantity = 36, color = '255, 214, 150' }: { className?: string; quantity?: number; color?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = canvas.current;
    if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = el.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(2, devicePixelRatio || 1);
    let w = 0;
    let h = 0;
    type Mote = { x: number; y: number; r: number; a: number; dx: number; dy: number; phase: number };
    let motes: Mote[] = [];
    const size = () => {
      w = el.clientWidth;
      h = el.clientHeight;
      el.width = w * dpr;
      el.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      motes = Array.from({ length: quantity }, () => ({ x: Math.random() * w, y: Math.random() * h, r: 0.6 + Math.random() * 1.6, a: 0.15 + Math.random() * 0.5, dx: (Math.random() - 0.5) * 0.12, dy: -0.04 - Math.random() * 0.12, phase: Math.random() * 6.28 }));
    };
    size();
    const observer = new ResizeObserver(size);
    observer.observe(el);
    let raf = 0;
    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      for (const m of motes) {
        m.x += m.dx + Math.sin(t / 2400 + m.phase) * 0.05;
        m.y += m.dy;
        if (m.y < -4) { m.y = h + 4; m.x = Math.random() * w; }
        const twinkle = 0.65 + 0.35 * Math.sin(t / 900 + m.phase);
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${color}, ${m.a * twinkle})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); observer.disconnect(); };
  }, [quantity, color]);
  return <canvas ref={canvas} aria-hidden className={className} />;
}
