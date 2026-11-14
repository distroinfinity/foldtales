/**
 * The second way in: the AI Storyteller. A painted night shore with the cast, a line that writes
 * itself, lost things drifting onto the page, and the door, which says exactly what's missing.
 */
import { motion, useReducedMotion, useScroll, useTransform, useInView } from 'motion/react';
import { useRef, useState } from 'react';
import { SendToQuest } from './actions.tsx';
import type { Device } from './device.ts';
import type { LibraryState } from './library.ts';
import { askForMicrophone } from './microphone.ts';
import { TextAnimate } from './ui/text-animate.tsx';

const art = (f: string) => `./web/${f}`;

function Shore() {
  const box = useRef<HTMLDivElement>(null);
  const still = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: box, offset: ['start end', 'end start'] });
  const far = useTransform(scrollYProgress, [0, 1], still ? [0, 0] : [30, -30]);
  const mid = useTransform(scrollYProgress, [0, 1], still ? [0, 0] : [50, -50]);
  const near = useTransform(scrollYProgress, [0, 1], still ? [0, 0] : [80, -80]);
  const inView = useInView(box, { amount: 0.55, once: true });
  const things = [
    { f: 'object-kite.webp', x: '5%', y: '8%', w: '12%', r: -14, d: 0.4 },
    { f: 'object-brass-key.webp', x: '68%', y: '6%', w: '7%', r: 22, d: 0.8 },
    { f: 'object-spool.webp', x: '84%', y: '60%', w: '8%', r: 10, d: 1.1 },
  ];
  return (
    <div className="w-full shadow-[0_30px_80px_rgba(4,6,14,.6)]">
    <div ref={box} className="relative aspect-[16/10] w-full overflow-hidden rounded-t-[14px]">
      <motion.img src={art('shore-layer-1-sky-night.webp')} alt="" className="absolute inset-x-[-6%] top-[-4%] w-[112%] max-w-none" style={{ y: far }} />
      <motion.img src={art('shore-layer-2-headland.webp')} alt="" className="absolute inset-x-[-6%] top-[16%] w-[112%] max-w-none brightness-[.62] saturate-[.8]" style={{ y: mid }} />
      <motion.img src={art('shore-layer-3-dunes.webp')} alt="" className="absolute inset-x-[-6%] top-[47%] w-[112%] max-w-none brightness-[.6]" style={{ y: mid }} />
      <motion.div className="absolute inset-0" style={{ y: near }}>
        <img src={art('wick.webp')} alt="Wick the badger" className="absolute bottom-[14%] left-[14%] h-[52%] brightness-[.8]" />
        <img src={art('pip-talk.webp')} alt="Pip the fox, holding his lantern" className="absolute bottom-[11%] left-[42%] h-[58%]" />
        <div aria-hidden className="absolute bottom-[34%] left-[51%] size-[34%] -translate-x-1/2 rounded-full mix-blend-screen" style={{ background: 'radial-gradient(circle, rgba(255,214,130,.45), rgba(255,200,110,0) 65%)' }} />
        <motion.img src={art('moth.webp')} alt="Moth" className="absolute right-[4%] top-[26%] h-[19%]" animate={still ? undefined : { y: [0, -8, 0], rotate: [0, -3, 0] }} transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }} />
      </motion.div>
      <img src={art('shore-layer-4-foreground.webp')} alt="" className="absolute inset-x-[-4%] bottom-[-6%] w-[108%] max-w-none brightness-[.55]" />
      {things.map((t) => (
        <motion.img
          key={t.f}
          src={art(t.f)}
          alt=""
          className="absolute drop-shadow-[0_10px_12px_rgba(4,6,14,.5)]"
          style={{ left: t.x, top: t.y, width: t.w }}
          initial={still ? false : { opacity: 0, y: -40, rotate: t.r - 20 }}
          animate={inView ? { opacity: 1, y: 0, rotate: t.r } : undefined}
          transition={{ delay: t.d, duration: 1.1, ease: [0.2, 0.8, 0.2, 1] }}
        />
      ))}
    </div>
      {/* The caption band, printed on the page as in the book: a story being made up, line by line. */}
    <div className="paper rounded-b-[14px] px-5 py-4 text-ink">
      <p className="m-0 text-[clamp(15px,1.5vw,20px)] leading-snug">
        <span className="font-medium">Pip: </span>
        <TextAnimate text="“A key! Wick, the Giant gave us a key. What does it open?”" play={inView} stagger={0.03} />
      </p>
      <p className="m-0 mt-1 text-[clamp(15px,1.5vw,20px)] leading-snug">
        <span className="font-medium">Wick: </span>
        <TextAnimate text="“Hmph. The old cellar, I’d wager. Nobody’s been down there in years.”" play={inView} delay={2.4} stagger={0.03} />
      </p>
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

function Door({ device, library, signedIn, onSignIn, enterStoryteller, storytellerLabel }: DoorProps) {
  const [mic, setMic] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  if (device !== 'headset') return <SendToQuest compact />;
  const secondary = 'inline-flex min-h-14 items-center rounded-[10px] border border-sage/70 bg-sage/15 px-7 text-[19px] text-page hover:bg-sage/25 cursor-pointer';
  if (!signedIn)
    return (
      <div className="flex flex-col items-start gap-3">
        <button type="button" className={secondary} onClick={onSignIn}>
          Sign in to start
        </button>
        <p className="m-0 text-[16px] text-page/65">The AI Storyteller needs an account and the internet. The chapters need neither.</p>
      </div>
    );
  if (!library.storyteller.available || !enterStoryteller)
    return <p className="m-0 max-w-[36ch] text-[17px] text-page/75">Signed in as {signedIn}. The AI Storyteller is on its way to this book, and it will open from here.</p>;
  return (
    <div className="flex flex-col items-start gap-3">
      <p className="m-0 text-[16px] text-page/75">✓ Signed in as {signedIn}{mic === 'granted' ? '   ✓ They can hear you' : ''}</p>
      {mic !== 'granted' ? (
        <>
          <button type="button" className={secondary} onClick={async () => setMic(await askForMicrophone(navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices)))}>
            Let them hear you
          </button>
          <p className="m-0 max-w-[40ch] text-[15px] leading-relaxed text-page/65">
            {mic === 'denied'
              ? 'The AI Storyteller needs your voice. Allow the microphone in the browser’s settings, then try again.'
              : 'You talk to the characters out loud. Your voice goes to a cloud service to be understood, and isn’t kept.'}
          </p>
        </>
      ) : (
        <button type="button" className={secondary} onClick={enterStoryteller}>
          {storytellerLabel?.startsWith('Back') ? storytellerLabel : 'Start the AI Storyteller'}
        </button>
      )}
    </div>
  );
}

export function Storyteller(props: DoorProps) {
  return (
    <section className="relative px-4 py-[14vh] md:px-10" aria-labelledby="storyteller-title">
      <div className="mx-auto grid max-w-[1400px] items-center gap-10 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] md:gap-14">
        <Shore />
        <div>
          <h2 id="storyteller-title" className="display m-0 max-w-[15ch] text-[clamp(34px,4.4vw,60px)] leading-[1.02]">
            Or make up a new story, out loud.
          </h2>
          <p className="m-0 mt-5 max-w-[36ch] text-[clamp(18px,1.5vw,21px)] leading-relaxed text-page/75">
            The <span className="text-page">AI Storyteller</span>: talk to Pip, Wick and Moth, hand them anything, and the AI makes up the story as you go. Voiced live.
          </p>
          <div className="mt-8">
            <Door {...props} />
          </div>
        </div>
      </div>
    </section>
  );
}
