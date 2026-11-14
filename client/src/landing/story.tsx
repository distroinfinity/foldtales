/**
 * The page's first section, pinned while you scroll, as Apple's product pages are: the hero over a
 * closed book on the table, then the book opening, the lantern going out and coming back, the page turning to the lamp, and
 * its beam sweeping the room. The scroll is smoothed with a spring, so the book glides, not steps.
 */
import { useMotionValueEvent, useReducedMotion, useScroll, useSpring } from 'motion/react';
import { useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { BookStage, MARKS, Room, beamHeading, clamp, type StageLight } from './book-stage.tsx';
import content from './page-content.json';

/** How visible a block of words is: in over `fade` after `from`, out over `fade` before `to`. */
function shown(p: number, from: number, to: number, fade = 0.028): number {
  if (from <= 0 && p <= to) return clamp((to - p) / fade);
  if (to >= 1 && p >= from) return clamp((p - from) / fade);
  return Math.min(clamp((p - from) / fade), clamp((to - p) / fade));
}

type Beat = { from: number; to: number; title: string; line: string };

export const BEATS: Beat[] = content.beats;

function Words({ opacity, children }: { opacity: number; children: ReactNode }) {
  return (
    <div
      className="absolute inset-x-0 top-0 flex flex-col items-center px-5 text-center"
      style={{ opacity, transform: `translateY(${(1 - opacity) * 10}px)`, pointerEvents: opacity > 0.5 ? 'auto' : 'none', visibility: opacity <= 0.01 ? 'hidden' : 'visible' }}
    >
      {children}
    </div>
  );
}

export function BeatWords({ beat }: { beat: Beat }) {
  return (
    <>
      <h2 className="display m-0 text-[clamp(34px,4.4vw,64px)] leading-[1.02] text-page">{beat.title}</h2>
      <p className="m-0 mt-3 max-w-[40ch] text-[clamp(17px,1.35vw,20px)] leading-relaxed text-page/70">{beat.line}</p>
    </>
  );
}

export function Story({ hero }: { hero: ReactNode }) {
  const section = useRef<HTMLElement>(null);
  const still = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: section, offset: ['start start', 'end end'] });
  const smooth = useSpring(scrollYProgress, { stiffness: 110, damping: 26, mass: 0.5, restDelta: 0.0002 });
  const [p, setP] = useState(0);
  const [light, setLight] = useState<StageLight>({ lampX: 0.4, lampY: 0.4 });
  useMotionValueEvent(smooth, 'change', (v) => setP(v));

  if (still) return <StillStory hero={hero} />;

  const lit = p >= MARKS.lit;
  const heading = beamHeading(p);
  // As the beam swings toward you, the whole room lifts, as your real walls do in the headset.
  const towardYou = lit ? Math.pow(Math.max(0, Math.cos(((heading - 180) * Math.PI) / 180)), 3) : 0;

  return (
    <section ref={section} className="relative h-[620vh]" aria-label="What happens when you open the book">
      <div className="sticky top-0 h-[100svh] overflow-hidden bg-room">
        <Room p={p} light={light} />
        <BookStage p={p} className="absolute inset-0" onLamp={setLight} />
        {/* A soft dark band behind the words, so they read over the room. */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[46%] bg-gradient-to-b from-room via-room/80 to-transparent" />
        <div className="absolute inset-x-0 top-[max(76px,10svh)]">
          <Words opacity={shown(p, 0, 0.07, 0.03)}>{hero}</Words>
          {BEATS.map((b) => (
            <Words key={b.title} opacity={shown(p, b.from, b.to)}>
              <BeatWords beat={b} />
            </Words>
          ))}
        </div>
        <div aria-hidden className="pointer-events-none absolute inset-0 mix-blend-screen" style={{ opacity: towardYou * 0.5, background: `radial-gradient(ellipse 90% 80% at ${light.lampX * 100}% ${light.lampY * 100}%, rgba(255,222,160,.5), rgba(255,210,140,.1) 55%, rgba(255,210,140,0) 80%)` }} />
        {/* The beam: the page's one bold moment. It sweeps past the book, across the room. */}
        <div aria-hidden className="beam pointer-events-none absolute inset-0 transition-opacity duration-700" style={{ opacity: lit ? 1 : 0, '--beam': `${heading}deg`, '--bx': `${light.lampX * 100}%`, '--by': `${light.lampY * 100}%` } as CSSProperties} />
      </div>
    </section>
  );
}

/** With reduced motion: the hero, then one still moment per beat, nothing scrubbed. */
function StillStory({ hero }: { hero: ReactNode }) {
  const stills = [0.33, 0.62, 0.95];
  return (
    <section aria-label="What happens when you open the book" className="bg-room">
      <div className="relative h-[100svh] overflow-hidden">
        <Room p={0} light={{ lampX: 0.4, lampY: 0.4 }} />
        <BookStage p={0} className="absolute inset-0" />
        <div className="absolute inset-x-0 top-[max(76px,10svh)] flex flex-col items-center px-5 text-center">{hero}</div>
      </div>
      {BEATS.map((b, i) => (
        <div key={b.title} className="relative h-[90svh] overflow-hidden">
          <Room p={stills[i]!} light={{ lampX: 0.4, lampY: 0.4 }} />
          <BookStage p={stills[i]!} className="absolute inset-0" />
          <div className="absolute inset-x-0 top-[8svh] flex flex-col items-center px-5 text-center">
            <BeatWords beat={b} />
          </div>
        </div>
      ))}
    </section>
  );
}
