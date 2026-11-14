/**
 * The second way to play: the AI Storyteller. A pinned scroll over the night shore, from the real
 * art: first what it is, then three beats: you talk and they answer; you ask for something and it
 * appears; your room joins in. The door (StoryDoor) lives in the hero and at the end, and says
 * exactly what's missing before it lets you in: the microphone first, then a fresh tap into XR.
 */
import { motion, useMotionValueEvent, useReducedMotion, useScroll, useSpring } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import type { Device } from './device.ts';
import { ACCOUNTS_ON, STORYTELLER_ON } from './flags.ts';
import type { LibraryState } from './library.ts';
import { askForMicrophone } from './microphone.ts';
import content from './page-content.json';
import { art } from './preload.ts';
import { TextAnimate } from './ui/text-animate.tsx';

const STORY = content.storyteller;
const clamp = (v: number) => Math.max(0, Math.min(1, v));

type Beat = (typeof STORY.beats)[number];

export type DoorProps = {
  device: Device;
  library: LibraryState;
  signedIn: string | null;
  onSignIn: () => void;
  enterStoryteller: (() => void) | null;
  /** "Back to the AI Storyteller" when you've just been in it. */
  storytellerLabel?: string | null;
};

// The same size and weight as the book's rust button: two equal doors, in two colours.
const doorButton = 'inline-flex min-h-16 cursor-pointer items-center justify-center rounded-[10px] border-0 bg-[#5f7a66] px-9 text-[22px] font-medium text-page shadow-[0_6px_0_#46594b,0_14px_28px_rgba(5,7,16,0.5)] transition-[transform,box-shadow] duration-150 hover:bg-[#6b8873] active:translate-y-1 active:shadow-[0_2px_0_#46594b,0_8px_16px_rgba(5,7,16,0.45)]';
const note = 'm-0 max-w-[40ch] text-[15px] leading-relaxed text-page/65';

/** Whether the browser already lets this page use the microphone, so the door can skip asking. */
function useMic(): ['unknown' | 'granted' | 'denied', (v: 'granted' | 'denied') => void] {
  const [mic, setMic] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  useEffect(() => {
    void navigator.permissions
      ?.query({ name: 'microphone' as PermissionName })
      .then((status) => {
        if (status.state === 'granted') setMic('granted');
      })
      .catch(() => undefined);
  }, []);
  return [mic, setMic];
}

/** The AI Storyteller's door. Headset only: elsewhere, the page's one "Send to your Quest" covers both ways. */
export function StoryDoor({ device, library, signedIn, onSignIn, enterStoryteller, storytellerLabel }: DoorProps) {
  const [mic, setMic] = useMic();
  if (device !== 'headset') return null;
  if (!STORYTELLER_ON) return <p className={note}>The AI Storyteller opens here soon. The book is ready now.</p>;
  if (ACCOUNTS_ON && !signedIn)
    return (
      <button type="button" className={doorButton} onClick={onSignIn}>
        Sign in to start
      </button>
    );
  if (!(library.storyteller.available || enterStoryteller) || !enterStoryteller) return <p className={note}>The AI Storyteller is getting ready. Try again in a moment.</p>;
  // Never open it without the microphone: it's a conversation (owner, in the headset, Nov 14).
  if (mic !== 'granted')
    return (
      <div className="flex flex-col items-start gap-2">
        <button type="button" className={doorButton} onClick={async () => setMic(await askForMicrophone(navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices)))}>
          Start a story
        </button>
        <p className={note}>{mic === 'denied' ? 'It needs your voice. Allow the microphone in the browser’s site settings, then try again.' : 'Your browser will ask to use the microphone first.'}</p>
      </div>
    );
  return (
    <button type="button" className={doorButton} onClick={enterStoryteller}>
      {storytellerLabel?.startsWith('Back') ? storytellerLabel : 'Open the AI Storyteller'}
    </button>
  );
}

/** One beat's caption, written as it's said: your line (if any), then theirs. */
function Lines({ beat, play }: { beat: Beat; play: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1.5 text-center">
      {beat.you && (
        <p className="m-0 max-w-[56ch] text-[clamp(16px,1.45vw,20px)] leading-snug text-page/85 [text-shadow:0_2px_12px_rgba(0,0,0,.85)]">
          <span className="mr-2 text-gold">You</span>
          <TextAnimate text={beat.you} play={play} stagger={0.025} />
        </p>
      )}
      <p className="m-0 max-w-[56ch] text-[clamp(16px,1.45vw,20px)] leading-snug text-page [text-shadow:0_2px_12px_rgba(0,0,0,.85)]">
        <span className="mr-2 text-sage">{beat.them.who}</span>
        <TextAnimate text={beat.them.text} play={play} delay={beat.you ? 1.1 : 0.2} stagger={0.025} />
      </p>
    </div>
  );
}

function shown(p: number, from: number, to: number, fade = 0.04): number {
  if (from <= 0 && p <= to) return clamp((to - p) / fade);
  if (to >= 1 && p >= from) return clamp((p - from) / fade);
  return Math.min(clamp((p - from) / fade), clamp((to - p) / fade));
}

/** The night shore with the cast, as a flat painted scene; what changes is driven by the beat (-1 before any). */
function Scene({ beat, k }: { beat: number; k: number }) {
  const still = useReducedMotion();
  // Moth flies off for the key in the second beat and comes back with it.
  const mothAway = beat === 1 && k > 0.15 && k < 0.55;
  const key = beat >= 1 && !mothAway;
  const room = beat >= 2;
  return (
    <div className="relative mx-auto aspect-[4/3] w-full max-w-[1500px] overflow-hidden md:aspect-[21/9]">
      <img src={art('shore-layer-1-sky-night.webp')} alt="" className="absolute left-1/2 top-[-6%] w-[118%] max-w-none -translate-x-1/2" />
      <img src={art('shore-layer-2-headland.webp')} alt="" className="absolute left-1/2 top-[18%] w-[118%] max-w-none -translate-x-1/2 brightness-[.55] saturate-[.8]" />
      <img src={art('shore-layer-3-dunes.webp')} alt="" className="absolute left-1/2 top-[50%] w-[118%] max-w-none -translate-x-1/2 brightness-[.55]" />
      {/* Your room's armchair walks into the story in the third beat. */}
      <motion.img src={art('room-flat-lamp.webp')} alt="" className="absolute bottom-[2%] right-[4%] h-[80%]" initial={false} animate={{ opacity: room ? 0.95 : 0, x: room ? 0 : 90 }} transition={{ duration: still ? 0 : 0.8, ease: [0.2, 0.7, 0.2, 1] }} />
      {STORY.cast.map((c) => (
        <img key={c.file} src={art(c.file)} alt={c.alt} className={c.className} />
      ))}
      <div aria-hidden className="absolute bottom-[26%] left-[53%] size-[30%] -translate-x-1/2 rounded-full mix-blend-screen" style={{ background: 'radial-gradient(circle, rgba(255,214,130,.42), rgba(255,200,110,0) 62%)' }} />
      <motion.img src={art(STORY.flier.file)} alt={STORY.flier.alt} className={STORY.flier.className} initial={false} animate={{ x: mothAway ? '-260%' : 0, y: mothAway ? '120%' : 0, opacity: mothAway ? 0 : 1 }} transition={{ duration: still ? 0 : 0.9, ease: 'easeInOut' }} />
      <motion.img src={art(STORY.gift.file)} alt={STORY.gift.alt} className="absolute left-[60%] top-[34%] w-[3.6%] drop-shadow-[0_10px_12px_rgba(4,6,14,.5)]" initial={false} animate={{ opacity: key ? 1 : 0, rotate: key ? 18 : -20, y: key ? 0 : -30 }} transition={{ duration: still ? 0 : 0.7 }} />
      <img src={art('shore-layer-4-foreground.webp')} alt="" className="absolute bottom-[-10%] left-1/2 w-[112%] max-w-none -translate-x-1/2 brightness-[.5]" />
      <div aria-hidden className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 62% 70% at 50% 55%, rgba(21,17,14,0) 55%, #15110e 100%)' }} />
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-[34%] bg-gradient-to-t from-room to-transparent" />
    </div>
  );
}

export function Storyteller() {
  const section = useRef<HTMLElement>(null);
  const still = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: section, offset: ['start start', 'end end'] });
  const smooth = useSpring(scrollYProgress, { stiffness: 110, damping: 26, mass: 0.5, restDelta: 0.0002 });
  const [p, setP] = useState(0);
  useMotionValueEvent(smooth, 'change', (v) => setP(v));
  const beats = STORY.beats;
  // An opening stretch that says what this is, then one stretch per beat.
  const parts = beats.length + 1;
  const part = Math.min(parts - 1, Math.floor(p * parts));
  const within = p * parts - part;
  const beat = part - 1;

  if (still)
    return (
      <section className="px-5 py-[12vh]" aria-labelledby="storyteller-title">
        <h2 id="storyteller-title" className="display m-0 text-center text-[clamp(36px,4.6vw,64px)] leading-[1.02]">
          {STORY.title}
        </h2>
        <p className="m-0 mx-auto mt-3 max-w-[46ch] text-center text-[18px] text-page/70">{STORY.line}</p>
        {beats.map((b, i) => (
          <div key={b.title} className="mt-12">
            <Scene beat={i} k={1} />
            <h3 className="display m-0 mt-6 text-center text-[clamp(28px,3vw,44px)]">{b.title}</h3>
            <p className="m-0 mx-auto mt-2 max-w-[44ch] text-center text-[18px] text-page/70">{b.line}</p>
            <div className="mt-4">
              <Lines beat={b} play />
            </div>
          </div>
        ))}
      </section>
    );

  const headings = [{ title: STORY.title, line: STORY.line }, ...beats.map((b) => ({ title: b.title, line: b.line }))];
  return (
    <section ref={section} className="relative h-[420vh]" aria-labelledby="storyteller-title">
      <div className="sticky top-0 flex h-[100svh] flex-col overflow-hidden bg-room">
        <div className="relative z-10 shrink-0 px-5 pt-[max(72px,9svh)] text-center">
          <div className="relative mx-auto h-[clamp(112px,16svh,150px)] max-w-[900px]">
            {headings.map((h, i) => {
              const o = shown(p, i / parts, (i + 1) / parts);
              const Tag = i === 0 ? 'h2' : 'h3';
              return (
                <div key={h.title} className="absolute inset-0" style={{ opacity: o, transform: `translateY(${(1 - o) * 8}px)`, visibility: o > 0.01 ? 'visible' : 'hidden' }}>
                  <Tag id={i === 0 ? 'storyteller-title' : undefined} className="display m-0 text-[clamp(32px,4.2vw,60px)] leading-[1.02]">
                    {h.title}
                  </Tag>
                  <p className="m-0 mx-auto mt-2 max-w-[50ch] text-[clamp(16px,1.35vw,19px)] leading-relaxed text-page/70">{h.line}</p>
                </div>
              );
            })}
          </div>
        </div>
        <div className="relative min-h-0 flex-1">
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2">
            <Scene beat={beat} k={within} />
          </div>
          <div className="absolute inset-x-0 bottom-[6%] px-5">
            {beats.map((b, i) => (
              <div key={b.title} className={i === beat ? 'block' : 'hidden'}>
                <Lines beat={b} play={i === beat && within > 0.08} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
