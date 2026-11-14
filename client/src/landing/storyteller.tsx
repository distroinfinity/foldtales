/**
 * The second way in: the AI Storyteller. The night shore, full width, with the cast; their lines appear
 * underneath like a film's subtitles, a story being made up as you watch. Then the door, which says
 * exactly what's missing (an account, the microphone) before it lets you in.
 */
import { motion, useInView, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { useRef, useState } from 'react';
import type { Device } from './device.ts';
import type { LibraryState } from './library.ts';
import { askForMicrophone } from './microphone.ts';
import { ACCOUNTS_ON, STORYTELLER_ON } from './flags.ts';
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
  enterStoryteller: (() => void) | null;
  /** "Back to the AI Storyteller" when you've just been in it. */
  storytellerLabel?: string | null;
};

const doorButton = 'inline-flex min-h-14 cursor-pointer items-center justify-center rounded-[12px] border border-sage/60 bg-sage/20 px-8 text-[18px] font-medium text-page transition-colors hover:bg-sage/30';

function Door({ device, library, signedIn, onSignIn, enterStoryteller, storytellerLabel }: DoorProps) {
  const [mic, setMic] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  // Elsewhere, the page's own "Send to your Quest" sits just below; one is enough.
  if (device !== 'headset') return null;
  if (!STORYTELLER_ON) return <p className="m-0 max-w-[40ch] text-[16px] leading-relaxed text-page/70">The AI Storyteller opens here soon. The chapters are ready now.</p>;
  if (ACCOUNTS_ON && !signedIn)
    return (
      <div className="flex flex-col items-center gap-3">
        <button type="button" className={doorButton} onClick={onSignIn}>
          Sign in to start
        </button>
        <p className="m-0 text-[15px] text-page/55">It needs an account and the internet. The chapters need neither.</p>
      </div>
    );
  // Built and switched on in this build when ticket 3's side supplies the launcher (PR review 2).
  if (!(library.storyteller.available || enterStoryteller) || !enterStoryteller)
    return <p className="m-0 max-w-[40ch] text-[16px] text-page/65">{signedIn ? `You’re signed in as ${signedIn}. ` : ''}The AI Storyteller is on its way to this book, and it will open from here.</p>;
  // Never open it without the microphone: it's a conversation (owner, in the headset, Nov 14).
  if (mic !== 'granted')
    return (
      <div className="flex flex-col items-center gap-3">
        <button type="button" className={doorButton} onClick={async () => setMic(await askForMicrophone(navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices)))}>
          Let them hear you
        </button>
        <p className="m-0 max-w-[46ch] text-[15px] leading-relaxed text-page/55">
          {mic === 'denied'
            ? 'The AI Storyteller needs your voice. Allow the microphone in the browser’s site settings, then try again.'
            : 'You talk to the characters out loud. Your voice goes to a speech service to be understood, and isn’t kept.'}
        </p>
      </div>
    );
  return (
    <button type="button" className={doorButton} onClick={enterStoryteller}>
      {storytellerLabel?.startsWith('Back') ? storytellerLabel : 'Start the AI Storyteller'}
    </button>
  );
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
    </section>
  );
}
