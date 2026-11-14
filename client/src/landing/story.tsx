/**
 * The page's first section: the hero, then a pinned stage your scrolling scrubs, as Apple's product
 * pages do. The scroll opens the real pop-up book: it tilts onto the table and opens, the shore stands
 * up, Pip's lantern goes out and comes back, the page turns to the lamp, and its beam sweeps the page.
 */
import { useMotionValueEvent, useReducedMotion, useScroll } from 'motion/react';
import { useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { BookStage, MARKS } from './book-stage.tsx';
import { Particles } from './ui/particles.tsx';

const clamp = (v: number) => Math.max(0, Math.min(1, v));

/** How visible a block of words is: fades in over `a`, holds, fades out over `b`. */
function shown(p: number, from: number, to: number, fade = 0.03): number {
  if (from <= 0 && p <= to) return clamp((to - p) / fade);
  if (to >= 1 && p >= from) return clamp((p - from) / fade);
  return Math.min(clamp((p - from) / fade), clamp((to - p) / fade));
}

type Beat = { from: number; to: number; title: string; line: string };

export const BEATS: Beat[] = [
  { from: 0.075, to: 0.36, title: 'It opens on your table.', line: 'A painted pop-up book appears on your real table, and the room dims around it like a theatre.' },
  { from: 0.39, to: 0.64, title: 'Reach in.', line: 'Pip’s lantern blows out. Pick it up, hand it back, and the light comes home. Your hands are all you need.' },
  { from: 0.68, to: 1, title: 'The lighthouse lights your room.', line: 'When the lamp is lit again, its beam sweeps across your real walls.' },
];

function Words({ opacity, children, label }: { opacity: number; children: ReactNode; label?: string }) {
  return (
    <div
      className="absolute inset-0 flex flex-col justify-center"
      aria-label={label}
      style={{ opacity, transform: `translateY(${(1 - opacity) * 14}px)`, pointerEvents: opacity > 0.5 ? 'auto' : 'none', visibility: opacity <= 0.01 ? 'hidden' : 'visible', filter: opacity < 1 ? `blur(${(1 - opacity) * 5}px)` : undefined }}
    >
      {children}
    </div>
  );
}

export function BeatWords({ beat }: { beat: Beat }) {
  return (
    <>
      <h2 className="display m-0 max-w-[14ch] text-[clamp(34px,4.4vw,60px)] leading-[1.02] text-page">{beat.title}</h2>
      <p className="m-0 mt-5 max-w-[34ch] text-[clamp(18px,1.5vw,21px)] leading-relaxed text-page/75">{beat.line}</p>
    </>
  );
}

export function Story({ hero }: { hero: ReactNode }) {
  const section = useRef<HTMLElement>(null);
  const still = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: section, offset: ['start start', 'end end'] });
  const [p, setP] = useState(0);
  const [lampAt, setLampAt] = useState<[number, number]>([0.3, 0.4]);
  useMotionValueEvent(scrollYProgress, 'change', (v) => setP(v));

  if (still) return <StillStory hero={hero} />;

  const sweep = clamp((p - MARKS.sweep[0]) / (MARKS.sweep[1] - MARKS.sweep[0]));
  const lit = p >= MARKS.lit;

  return (
    <section ref={section} className="relative h-[560vh]" aria-label="What happens when you open the book">
      <div className="sticky top-0 h-[100svh] overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 55% at 32% 58%, #1f2a44 0%, #151c2e 55%, #0e1424 100%)' }} />
        <Particles className="pointer-events-none absolute inset-0 h-full w-full" quantity={28} />
        <div className="relative mx-auto grid h-full max-w-[1400px] grid-rows-[minmax(0,58fr)_minmax(0,42fr)] px-4 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] md:grid-rows-1 md:gap-8 md:px-10">
          <BookStage p={p} className="h-full w-full" onLamp={(x, y) => setLampAt([x, y])} />
          <div className="relative h-full">
            <Words opacity={shown(p, 0, 0.07, 0.025)} label="Tabletop Theater">
              {hero}
            </Words>
            {BEATS.map((b) => (
              <Words key={b.title} opacity={shown(p, b.from, b.to)}>
                <BeatWords beat={b} />
              </Words>
            ))}
          </div>
        </div>
        {/* As the beam swings toward you, the whole room lifts, as your real walls do in the headset. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 mix-blend-screen" style={{ opacity: lit ? Math.max(0, Math.cos(((-40 + sweep * 520 - 180) * Math.PI) / 180)) * 0.55 : 0, background: `radial-gradient(ellipse 90% 80% at ${lampAt[0] * 100}% ${lampAt[1] * 100}%, rgba(255,222,160,.55), rgba(255,210,140,.12) 55%, rgba(255,210,140,0) 80%)` }} />
        {/* The beam: the page's one bold moment. It sweeps past the book, across everything. */}
        <div
          aria-hidden
          className="beam pointer-events-none absolute inset-0 transition-opacity duration-700"
          style={{ opacity: lit ? 1 : 0, '--beam': `${-40 + sweep * 520}deg`, '--bx': `${lampAt[0] * 100}%`, '--by': `${lampAt[1] * 100}%` } as CSSProperties}
        />
        <div aria-hidden className={`pointer-events-none absolute bottom-5 left-1/2 hidden -translate-x-1/2 text-[15px] text-page/50 transition-opacity duration-500 md:block ${p > 0.02 ? 'opacity-0' : 'opacity-100'}`}>
          Scroll to open the book
        </div>
      </div>
    </section>
  );
}

/** With reduced motion: the hero, then one still moment per beat, nothing scrubbed. */
function StillStory({ hero }: { hero: ReactNode }) {
  const stills = [0.33, 0.62, 0.95];
  return (
    <section aria-label="What happens when you open the book">
      <div className="mx-auto grid min-h-[100svh] max-w-[1400px] grid-rows-[minmax(0,58fr)_auto] items-center px-4 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] md:grid-rows-1 md:px-10">
        <BookStage p={0} className="h-[56svh] w-full md:h-[80svh]" />
        <div>{hero}</div>
      </div>
      {BEATS.map((b, i) => (
        <div key={b.title} className="mx-auto grid max-w-[1400px] items-center px-4 py-10 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] md:px-10">
          <BookStage p={stills[i]!} className="h-[50svh] w-full md:h-[70svh]" />
          <div>
            <BeatWords beat={b} />
          </div>
        </div>
      ))}
    </section>
  );
}
