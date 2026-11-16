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
import { Room } from './book-stage.tsx';

/**
 * The renders, in client/public/web/renders/ (from the IWSDK emulator, panels and gizmos hidden).
 * The hero is one swappable file: replace `book-on-table.webp` with a capture from the Quest
 * (about 1200 × 700, the book centred) and nothing else changes.
 */
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

/** A door: its kind, its name and its one line; on a headset, its own action under them. */
const doorCard =
  'flex min-w-0 flex-col items-stretch gap-4 rounded-[16px] border border-page/12 bg-[#18130f]/85 p-5 text-left backdrop-blur-sm [&_[data-action=open]]:w-full [&_[data-action=open]]:px-5 [&_[data-action=open]]:text-[19px] [&_[data-door]>button:first-child]:w-full';

function DoorHead({ kind, title, line, tone }: { kind: string; title: string; line: string; tone: 'rust' | 'sage' }) {
  return (
    <div>
      <p className={`m-0 text-[13px] font-medium tracking-[0.04em] ${tone === 'rust' ? 'text-[#e39a7c]' : 'text-[#a9c2ae]'}`}>{kind}</p>
      <h2 className="display m-0 mt-1 text-[clamp(26px,2.2vw,32px)] font-semibold leading-tight text-page">{title}</h2>
      <p className="m-0 mt-2 text-[16px] leading-relaxed text-page/75">{line}</p>
    </div>
  );
}

export function Hero({ device, ready, title, tagline, openBook, door }: { device: Device; ready: boolean; title: string; tagline: string; openBook: ReactNode; door: DoorProps }) {
  const headset = device === 'headset';
  return (
    <section className="relative overflow-hidden bg-room" aria-labelledby="hero-title">
      {/* The page's own room: the painted, lamp-lit reading room behind everything, as before. */}
      <Room p={0} light={{ lampX: 0.62, lampY: 0.45 }} />
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse 55% 60% at 64% 52%, rgba(233,184,100,.20), rgba(233,184,100,0) 70%)' }} />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-r from-room/90 via-room/55 to-room/20" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[28%] bg-gradient-to-t from-room to-transparent" />

      <div className="relative mx-auto grid max-w-[1320px] items-center gap-8 px-5 pb-14 pt-20 md:min-h-[100svh] md:grid-cols-[minmax(0,1fr)_minmax(0,1.12fr)] md:gap-12 md:px-10 md:pb-[6vh] md:pt-[12vh]">
        {/* The book itself, open on a table, its pop-up set standing: a render of the real app. */}
        <Rise ready={ready} delay={0.15} className="md:order-2">
          <figure className="m-0">
            <img src={art(RENDERS.hero)} alt="The pop-up book open on a table in the painted reading room: Pip the fox with his lantern, Moth, a kite and a spool on the shore, the lighthouse behind them, a window with the moon." className="block aspect-[16/10] w-full rounded-[18px] border border-page/15 object-cover object-[50%_45%] shadow-[0_30px_80px_rgba(0,0,0,.6)]" />
            <figcaption className="m-0 mt-3 text-[14px] text-page/60">In the headset: the book opens on your own table, and the story stands up from its pages.</figcaption>
          </figure>
        </Rise>
        <div className="min-w-0 md:order-1">
          <Rise ready={ready} delay={0.3}>
            <h1 id="hero-title" className="display m-0 max-w-[12ch] text-[clamp(42px,5vw,78px)] font-semibold italic leading-[0.95] text-page">
              {title}
            </h1>
            <p className="m-0 mt-4 max-w-[40ch] text-[clamp(17px,1.35vw,19px)] leading-relaxed text-page/85">{tagline}</p>
          </Rise>
          <Rise ready={ready} delay={0.5} className="mt-7 grid gap-4 lg:grid-cols-2">
            <div className={doorCard}>
              <DoorHead tone="rust" kind="Chapters" title="Read the book" line="Pip, Wick and Moth in the Lost and Found, chapter by chapter." />
              {headset && openBook}
            </div>
            <div className={doorCard}>
              <DoorHead tone="sage" kind="Made up with you" title="The AI Storyteller" line="Talk to them, hand them anything, and the story is made up with you." />
              {headset && <Door {...door} />}
            </div>
          </Rise>
          {!headset && (
            <Rise ready={ready} delay={0.65} className="mt-6 flex flex-col items-start gap-2">
              {/* Away from a headset, one action for the page: both are found on the Quest. */}
              <SendToQuest />
            </Rise>
          )}
        </div>
      </div>
    </section>
  );
}

function Shot({ src, alt, label, cutout = false }: { src: string; alt: string; label?: string; cutout?: boolean }) {
  return (
    <figure className="m-0">
      <img src={art(src)} alt={alt} loading="lazy" className={`block aspect-[4/3] w-full rounded-[14px] border border-page/10 ${cutout ? 'bg-[#1b2336] object-contain p-4' : 'object-cover'}`} />
      {label && <figcaption className="m-0 mt-2 text-[14px] text-page/60">{label}</figcaption>}
    </figure>
  );
}

function Words({ title, line, children }: { title: string; line: string; children?: ReactNode }) {
  return (
    <div>
      <h3 className="display m-0 text-[clamp(28px,2.4vw,36px)] font-semibold leading-tight text-page">{title}</h3>
      <p className="m-0 mt-2 max-w-[40ch] text-[17px] leading-relaxed text-page/75">{line}</p>
      {children}
    </div>
  );
}

/** Three things, with real renders and very few words. */
export function HowItWorks() {
  return (
    <section className="mx-auto max-w-[1320px] px-5 py-[10vh] md:px-10" aria-labelledby="how-title">
      <h2 id="how-title" className="display m-0 text-[clamp(32px,3.6vw,52px)] leading-[1.02] text-page">
        A book you can reach into.
      </h2>
      <div className="mt-10 grid gap-10 md:grid-cols-2 md:gap-8">
        <div className="flex flex-col gap-4">
          <Shot src={RENDERS.reachIn} alt="Wick and Pip at the top of the lighthouse, standing up from the open book on a table." />
          <Words title="Reach in" line="Pick things up, hand them to the characters, turn the pages. Your hands are all you need." />
        </div>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-2">
            <Shot cutout src="pip-talk.webp" alt="Pip, talking." />
            <Shot cutout src="wick.webp" alt="Wick, with his logbook." />
            <Shot cutout src="moth.webp" alt="Moth." />
          </div>
          <Words title="Ask for anything" line="With the AI Storyteller, the cast answers in their own voices, and paints what you ask for into the story.">
            <a className="mt-3 inline-block text-[14px] text-page/60 no-underline hover:text-page/85 hover:underline" href="https://runwayml.com" target="_blank" rel="noopener">
              Powered by Runway
            </a>
          </Words>
        </div>
      </div>
      <div className="mt-14">
        <Words title="Your room joins in" line="The story reaches past the book: the lamp's beam crosses your walls, the sea comes in over your floor, the stars come out on your ceiling." />
        <div className="mt-6 grid gap-5 md:grid-cols-3">
          <Shot src={RENDERS.beam} alt="The lighthouse lamp's beam sweeping up the wall of a room." label="The lamp's beam, on your walls" />
          <Shot src={RENDERS.sea} alt="The sea in a ring on the floor around the table the book stands on." label="The sea, on your floor" />
          <Shot src={RENDERS.sky} alt="Paper stars and a crescent moon on the ceiling." label="The night sky, on your ceiling" />
        </div>
      </div>
    </section>
  );
}
