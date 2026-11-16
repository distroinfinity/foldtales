/**
 * The first screen and the short "how it works" after it (owner, Nov 16): the product itself in action
 * above the fold (a real render of the book open on a table, the pop-up set standing), and both ways
 * in side by side. Every picture here is a render of the actual app in the IWSDK emulator, or the
 * book's own painted art; nothing is a mock scene.
 */
import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';
import { SendToQuest } from './actions.tsx';
import type { Device } from './device.ts';
import { art } from './preload.ts';
import { Door, type DoorProps } from './storyteller.tsx';

/** The renders, in client/public/web/renders/ (from the emulator, panels and gizmos hidden). */
export const RENDERS = {
  hero: 'renders/book-on-table.webp',
  reachIn: 'renders/reach-in.webp',
  beam: 'renders/room-beam.webp',
  sea: 'renders/room-sea.webp',
  sky: 'renders/room-sky.webp',
} as const;

function Rise({ ready, delay, children, className }: { ready: boolean; delay: number; children: ReactNode; className?: string }) {
  const still = useReducedMotion();
  return (
    <motion.div className={className} initial={still ? false : { opacity: 0, y: 12 }} animate={ready ? { opacity: 1, y: 0 } : undefined} transition={{ delay, duration: 0.9, ease: [0.2, 0.7, 0.2, 1] }}>
      {children}
    </motion.div>
  );
}

const doorCard = 'flex flex-col items-start gap-3 rounded-[16px] border border-page/12 bg-[#1c1713] p-5 text-left [&_a]:whitespace-nowrap [&_button]:whitespace-nowrap';

/** A door's title and its one line. */
function DoorHead({ title, line, tone }: { title: string; line: string; tone: 'rust' | 'sage' }) {
  return (
    <div>
      <p className={`m-0 text-[13px] font-medium tracking-[0.04em] ${tone === 'rust' ? 'text-[#e39a7c]' : 'text-[#a9c2ae]'}`}>{tone === 'rust' ? 'Chapters' : 'Made up with you'}</p>
      <h2 className="display m-0 mt-1 text-[clamp(26px,2.2vw,32px)] font-semibold leading-tight text-page">{title}</h2>
      <p className="m-0 mt-2 max-w-[34ch] text-[16px] leading-relaxed text-page/75">{line}</p>
    </div>
  );
}

export function Hero({ device, ready, title, tagline, openBook, door }: { device: Device; ready: boolean; title: string; tagline: string; openBook: ReactNode; door: DoorProps }) {
  const headset = device === 'headset';
  return (
    <section className="relative overflow-hidden bg-room" aria-labelledby="hero-title">
      {/* The lamp's warm pool behind the book, so the render sits in light, not in a box. */}
      <div aria-hidden className="pointer-events-none absolute right-[-10%] top-[8%] h-[80%] w-[70%] rounded-full opacity-60 blur-3xl" style={{ background: 'radial-gradient(circle, rgba(233,184,100,.22), rgba(233,184,100,0) 65%)' }} />
      <div className="relative mx-auto grid max-w-[1320px] items-center gap-8 px-5 pb-14 pt-20 md:min-h-[100svh] md:grid-cols-[minmax(0,1fr)_minmax(0,1.12fr)] md:gap-12 md:px-10 md:pb-[6vh] md:pt-[12vh]">
        {/* The book itself, open on a table in a room, its pop-up set standing: a render of the real app. */}
        <Rise ready={ready} delay={0.15} className="md:order-2">
          <figure className="m-0">
            <img src={art(RENDERS.hero)} alt="The pop-up book open on a living-room table: Pip the fox with his lantern, Moth, a kite and a spool standing on the shore, the lighthouse behind them." className="block aspect-[16/11] w-full rounded-[18px] border border-page/10 object-cover object-[50%_42%] shadow-[0_30px_80px_rgba(0,0,0,.55)]" />
            <figcaption className="m-0 mt-3 text-[14px] text-page/55">In the headset: the book opens on your own table, and the story stands up from its pages.</figcaption>
          </figure>
        </Rise>
        <div className="md:order-1">
          <Rise ready={ready} delay={0.3}>
            <h1 id="hero-title" className="display m-0 max-w-[12ch] text-[clamp(42px,5vw,78px)] font-semibold italic leading-[0.95] text-page">
              {title}
            </h1>
            <p className="m-0 mt-4 max-w-[40ch] text-[clamp(17px,1.35vw,19px)] leading-relaxed text-page/80">{tagline}</p>
          </Rise>
          <Rise ready={ready} delay={0.5} className="mt-7 grid gap-4 sm:grid-cols-2">
            <div className={doorCard}>
              <DoorHead tone="rust" title="Read the book" line="Pip, Wick and Moth in the Lost and Found, chapter by chapter." />
              {headset ? openBook : <SendToQuest buttonOnly />}
            </div>
            <div className={doorCard}>
              <DoorHead tone="sage" title="The AI Storyteller" line="Talk to them, hand them anything, and the story is made up with you." />
              {headset ? <Door {...door} /> : <SendToQuest buttonOnly />}
            </div>
          </Rise>
          {!headset && (
            <Rise ready={ready} delay={0.65} className="mt-4">
              <p className="m-0 text-[15px] text-page/60">For a Meta Quest 3 or 3S. Send the link to your Quest, and open it there.</p>
            </Rise>
          )}
        </div>
      </div>
    </section>
  );
}

function Tile({ img, alt, title, line, children, cutouts = false }: { img: string | string[]; alt: string; title: string; line: string; children?: ReactNode; cutouts?: boolean }) {
  const imgs = Array.isArray(img) ? img : [img];
  return (
    <figure className="m-0 flex flex-col gap-4">
      <div className={`grid overflow-hidden rounded-[14px] border border-page/10 ${imgs.length > 1 ? 'grid-cols-3 gap-px bg-page/10' : ''}`}>
        {imgs.map((src, i) => (
          <img key={src} src={art(src)} alt={i === 0 ? alt : ''} loading="lazy" className={`block w-full ${cutouts ? 'bg-[#1b2336] object-contain p-3' : 'object-cover'} ${imgs.length > 1 ? 'aspect-[3/4]' : 'aspect-[16/10]'}`} />
        ))}
      </div>
      <figcaption>
        <h3 className="display m-0 text-[clamp(26px,2.2vw,32px)] font-semibold leading-tight text-page">{title}</h3>
        <p className="m-0 mt-2 max-w-[38ch] text-[16px] leading-relaxed text-page/70">{line}</p>
        {children}
      </figcaption>
    </figure>
  );
}

/** Three things, with real renders and very few words. */
export function HowItWorks() {
  return (
    <section className="mx-auto max-w-[1280px] px-5 py-[10vh] md:px-10" aria-labelledby="how-title">
      <h2 id="how-title" className="display m-0 text-[clamp(32px,3.6vw,52px)] leading-[1.02] text-page">
        A book you can reach into.
      </h2>
      <div className="mt-10 grid gap-10 md:grid-cols-3 md:gap-8">
        <Tile img={RENDERS.reachIn} alt="Wick and Pip at the top of the lighthouse, standing up from the open book on a table." title="Reach in" line="Pick things up, hand them to the characters, turn the pages. Your hands are all you need." />
        <Tile img={[RENDERS.beam, RENDERS.sea, RENDERS.sky]} alt="The lighthouse beam sweeping the room's wall, the sea on the floor around the table, and stars and a moon on the ceiling." title="Your room joins in" line="The lamp's beam crosses your walls. The sea comes in over your floor. Stars come out on your ceiling." />
        <Tile img={['pip-talk.webp', 'wick.webp', 'moth.webp']} alt="Pip, Wick and Moth, painted." cutouts title="Ask for anything" line="With the AI Storyteller, the cast answers in their own voices, and paints what you ask for into the story.">
          <a className="mt-3 inline-block text-[14px] text-page/55 no-underline hover:text-page/80 hover:underline" href="https://runwayml.com" target="_blank" rel="noopener">
            Powered by Runway
          </a>
        </Tile>
      </div>
    </section>
  );
}
