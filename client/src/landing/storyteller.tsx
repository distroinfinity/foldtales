/**
 * The second way in: the AI Storyteller. The night shore, full width, with the cast; their lines appear
 * underneath like a film's subtitles, a story being made up as you watch. Then the door: one state from
 * lane D's provider (sign-in, the microphone, the connection, tonight's limit), each with its one step.
 */
import { motion, useInView, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
import type { Device } from './device.ts';
import type { LibraryState } from './library.ts';
import { STORYTELLER_ON } from './flags.ts';
import { askMicrophone, refreshStoryteller, storytellerSnapshot, subscribeStoryteller, type DoorState } from '../stage/seams.ts';
import content from './page-content.json';
import { art } from './preload.ts';
import { TextAnimate } from './ui/text-animate.tsx';

const STORY = content.storyteller;

function Shore() {
  const box = useRef<HTMLDivElement>(null);
  const still = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: box, offset: ['start end', 'end start'] });
  const far = useTransform(scrollYProgress, [0, 1], still ? [0, 0] : [-24, 24]);
  const mid = useTransform(scrollYProgress, [0, 1], still ? [0, 0] : [-10, 10]);
  const near = useTransform(scrollYProgress, [0, 1], still ? [0, 0] : [16, -16]);
  const inView = useInView(box, { amount: 0.6, once: true });
  return (
    <div className="relative mx-auto w-full max-w-[1500px]">
    <div ref={box} className="relative mx-auto aspect-[4/3] max-h-[64svh] w-full overflow-hidden md:aspect-[21/9]">
      <motion.img src={art('shore-layer-1-sky-night.webp')} alt="" className="absolute left-1/2 top-[-6%] w-[118%] max-w-none -translate-x-1/2" style={{ y: far }} />
      <motion.img src={art('shore-layer-2-headland.webp')} alt="" className="absolute left-1/2 top-[18%] w-[118%] max-w-none -translate-x-1/2 brightness-[.55] saturate-[.8]" style={{ y: mid }} />
      <motion.img src={art('shore-layer-3-dunes.webp')} alt="" className="absolute left-1/2 top-[50%] w-[118%] max-w-none -translate-x-1/2 brightness-[.55]" style={{ y: mid }} />
      <motion.div className="absolute inset-0" style={{ y: near }}>
        {STORY.cast.map((c) => (
          <img key={c.file} src={art(c.file)} alt={c.alt} className={c.className} />
        ))}
        <div aria-hidden className="absolute bottom-[26%] left-[53%] size-[30%] -translate-x-1/2 rounded-full mix-blend-screen" style={{ background: 'radial-gradient(circle, rgba(255,214,130,.42), rgba(255,200,110,0) 62%)' }} />
        <motion.img src={art(STORY.flier.file)} alt={STORY.flier.alt} className={STORY.flier.className} animate={still ? undefined : { y: [0, -7, 0], rotate: [0, -3, 0] }} transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }} />
        <motion.img
          src={art(STORY.gift.file)}
          alt={STORY.gift.alt}
          className="absolute left-[56%] top-[30%] w-[3.6%] drop-shadow-[0_10px_12px_rgba(4,6,14,.5)]"
          initial={still ? false : { opacity: 0, y: -50, rotate: -20 }}
          animate={inView ? { opacity: 1, y: 0, rotate: 18 } : undefined}
          transition={{ delay: 0.3, duration: 1.2, ease: [0.2, 0.8, 0.2, 1] }}
        />
      </motion.div>
      <img src={art('shore-layer-4-foreground.webp')} alt="" className="absolute bottom-[-10%] left-1/2 w-[112%] max-w-none -translate-x-1/2 brightness-[.5]" />
      {/* Edges fade into the room, so the scene reads as lit, not boxed. */}
      <div aria-hidden className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 62% 70% at 50% 55%, rgba(21,17,14,0) 55%, #15110e 100%)' }} />
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-[30%] bg-gradient-to-t from-room to-transparent" />
      {/* Subtitles, as in a film: the characters' lines, written as they're said. */}
    </div>
      <div className="relative flex flex-col items-center gap-1.5 px-5 pt-3 text-center md:absolute md:inset-x-0 md:bottom-[5%] md:pt-0">
        {STORY.lines.map((l, i) => (
          <p key={l.who} className="m-0 max-w-[60ch] text-[clamp(16px,1.5vw,21px)] leading-snug text-page [text-shadow:0_2px_12px_rgba(0,0,0,.8)]">
            <span className="mr-2 text-sage">{l.who}</span>
            <TextAnimate text={l.text} play={inView} delay={0.8 + i * 2.6} stagger={0.028} />
          </p>
        ))}
      </div>
    </div>
  );
}

type DoorProps = {
  device: Device;
  library: LibraryState;
  signedIn: string | null;
  onSignIn: () => void;
  /** Into the Storyteller, asking for the microphone first if it hasn't been allowed. */
  enterStoryteller: (() => void) | null;
  /** Into the Storyteller without the microphone: the story is played by hand. */
  playByHand: (() => void) | null;
  /** The chapters, offered beside a door that can't open. */
  openBook: (() => void) | null;
  /** Your stories, in Your book. */
  onStories: () => void;
  /** "Back to the AI Storyteller" when you've just been in it. */
  storytellerLabel?: string | null;
};

type DoorWords = { button?: string; line?: string; quiet?: string };
/** The door's words per state. Lane D's, from page-content.json's `storyteller.door`, over these defaults. */
const DEFAULT_WORDS: Record<DoorState['kind'], DoorWords> = {
  'signed-out': { button: 'Sign in to start', line: 'It needs an account and the internet. The chapters need neither.' },
  'auth-loading': { button: 'Checking your sign-in…' },
  'auth-failed': { button: 'Try again', line: 'Couldn’t check your sign-in just now.' },
  'session-expired': { button: 'Sign in again', line: 'Your sign-in has ended.' },
  'mic-not-asked': { button: 'Let them hear you', line: 'You talk to the characters out loud. Your voice goes to a speech service to be understood, and isn’t kept.', quiet: 'or play by hand' },
  'mic-refused': { button: 'Start a new story', line: 'They can’t hear you, so you’ll play by hand. To talk, allow the microphone in the browser’s site settings.', quiet: 'Try the microphone again' },
  unavailable: { line: 'The AI Storyteller needs the internet. The chapters don’t.' },
  'limit-reached': { line: 'The AI Storyteller is resting for tonight. The chapters are here any time.' },
  ready: { button: 'Start a new story', quiet: 'Your stories' },
};
const wordsFor = (kind: DoorState['kind']): DoorWords => ({ ...DEFAULT_WORDS[kind], ...((STORY as { door?: Partial<Record<DoorState['kind'], DoorWords>> }).door?.[kind] ?? {}) });

const doorButton = 'inline-flex min-h-14 cursor-pointer items-center justify-center rounded-[12px] border border-sage/60 bg-sage/20 px-8 text-[18px] font-medium text-page transition-colors hover:bg-sage/30 disabled:cursor-default disabled:opacity-50 disabled:hover:bg-sage/20';
const quietLink = 'cursor-pointer border-0 bg-transparent p-2 font-[inherit] text-[16px] text-page/75 underline decoration-page/30 underline-offset-4 hover:text-page';

function Door({ device, signedIn, onSignIn, enterStoryteller, playByHand, openBook, onStories, storytellerLabel }: DoorProps) {
  const snap = useSyncExternalStore(subscribeStoryteller, storytellerSnapshot);
  // The door follows sign-in, the microphone and the connection as they change, without a reload.
  useEffect(() => {
    void refreshStoryteller();
    const again = () => void refreshStoryteller();
    addEventListener('online', again);
    addEventListener('offline', again);
    addEventListener('focus', again);
    return () => {
      removeEventListener('online', again);
      removeEventListener('offline', again);
      removeEventListener('focus', again);
    };
  }, [signedIn]);
  // Elsewhere, the page's own "Send to your Quest" sits just below; one is enough.
  if (device !== 'headset') return null;
  if (!STORYTELLER_ON) return <p className="m-0 max-w-[40ch] text-[16px] leading-relaxed text-page/70">The AI Storyteller opens here soon. The chapters are ready now.</p>;
  const door = snap.door;
  const w = wordsFor(door.kind);
  const line = w.line && <p className="m-0 max-w-[46ch] text-[15px] leading-relaxed text-page/60">{w.line}</p>;
  const chaptersBeside = openBook && (
    <button type="button" className={quietLink} onClick={openBook}>
      Open the book
    </button>
  );
  const box = (main: ReactNode, below: ReactNode = null) => (
    <div className="flex flex-col items-center gap-3" data-door={door.kind}>
      {main}
      {below}
      {line}
    </div>
  );
  switch (door.kind) {
    case 'signed-out':
    case 'session-expired':
      return box(
        <button type="button" className={doorButton} onClick={onSignIn}>
          {w.button}
        </button>,
      );
    case 'auth-loading':
      return box(
        <button type="button" className={doorButton} disabled>
          {w.button}
        </button>,
      );
    case 'auth-failed':
      return box(
        <button type="button" className={doorButton} onClick={() => void refreshStoryteller()}>
          {w.button}
        </button>,
      );
    case 'mic-not-asked':
      return box(
        <button type="button" className={doorButton} disabled={!enterStoryteller} onClick={() => enterStoryteller?.()}>
          {w.button}
        </button>,
        playByHand && (
          <button type="button" className={quietLink} onClick={playByHand}>
            {w.quiet}
          </button>
        ),
      );
    case 'mic-refused':
      return box(
        <button type="button" className={doorButton} disabled={!playByHand} onClick={() => playByHand?.()}>
          {w.button}
        </button>,
        <button type="button" className={quietLink} onClick={() => void askMicrophone()}>
          {w.quiet}
        </button>,
      );
    case 'unavailable':
    case 'limit-reached':
      return box(
        <button type="button" className={doorButton} disabled>
          {door.kind === 'unavailable' ? (door.why === 'offline' ? 'No internet connection' : 'Not available just now') : 'Resting for tonight'}
        </button>,
        chaptersBeside,
      );
    case 'ready':
      return box(
        <button type="button" className={doorButton} disabled={!enterStoryteller} onClick={() => enterStoryteller?.()}>
          {storytellerLabel?.startsWith('Back') ? storytellerLabel : w.button}
        </button>,
        snap.finished.length > 0 && (
          <button type="button" className={quietLink} onClick={onStories}>
            {w.quiet}
          </button>
        ),
      );
  }
}

export function Storyteller(props: DoorProps) {
  return (
    <section className="relative pt-[14vh]" aria-labelledby="storyteller-title">
      <div className="px-5 text-center">
        <h2 id="storyteller-title" className="display m-0 text-[clamp(36px,4.6vw,64px)] leading-[1.02]">
          {STORY.title}
        </h2>
        <p className="m-0 mx-auto mt-4 max-w-[46ch] text-[clamp(17px,1.4vw,20px)] leading-relaxed text-page/70">
          {STORY.line}
        </p>
      </div>
      <div className="mt-[6vh]">
        <Shore />
      </div>
      <div className="mt-8 flex justify-center px-5">
        <Door {...props} />
      </div>
      {/* Things are painted for you live, by Runway: said once, quietly, like a caption. */}
      <p className="m-0 mt-6 text-center text-[14px] text-page/55">
        <a className="text-page/55 no-underline hover:text-page/80 hover:underline" href="https://runwayml.com" target="_blank" rel="noopener">
          Powered by Runway
        </a>
      </p>
    </section>
  );
}
