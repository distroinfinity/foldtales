/**
 * The first screen: what Foldtales is, and the choice between its two ways to play, side by side.
 * Each door is a small painted window onto that way, its words, and one button. On a desktop or
 * phone the doors keep their words, and one "Send to your Quest" sits under both.
 */
import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';
import { SendToQuest } from './actions.tsx';
import type { Device } from './device.ts';
import { BOOK_TITLE } from './library.ts';
import content from './page-content.json';
import { art } from './preload.ts';

const DOORS = content.doors;

function Reveal({ ready, delay, children, className }: { ready: boolean; delay: number; children: ReactNode; className?: string }) {
  const still = useReducedMotion();
  return (
    <motion.div className={className} initial={still ? false : { opacity: 0, y: 10, filter: 'blur(8px)' }} animate={ready ? { opacity: 1, y: 0, filter: 'blur(0px)' } : undefined} transition={{ delay, duration: 0.9, ease: [0.2, 0.7, 0.2, 1] }}>
      {children}
    </motion.div>
  );
}

/** The book, closed, lying on the painted table under the lamp. */
function BookWindow() {
  return (
    <div className="relative h-full w-full overflow-hidden" style={{ perspective: '700px' }}>
      <img src={art('room-tabletop.webp')} alt="" className="absolute inset-0 h-full w-full object-cover brightness-[.62] saturate-[.9]" />
      <div aria-hidden className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 46% 62% at 50% 60%, rgba(255,214,150,.45), rgba(255,200,120,.08) 60%, rgba(21,17,14,.55) 100%)', mixBlendMode: 'soft-light' }} />
      <div className="absolute left-1/2 top-[54%] h-[118%] w-auto" style={{ aspectRatio: '2 / 3', transform: 'translate(-50%,-50%) rotateX(48deg) rotateZ(-10deg)', transformStyle: 'preserve-3d' }}>
        <div aria-hidden className="absolute -inset-[8%] rounded-[50%]" style={{ background: 'radial-gradient(ellipse, rgba(20,12,6,.7), rgba(20,12,6,0) 66%)', transform: 'translateZ(-2px)' }} />
        <img src={art('cover.webp')} alt="The closed book, Tales from the Table’s Edge, on a table in lamplight" className="relative h-full w-full rounded-r-[4px] object-cover" />
        <p className="display absolute inset-x-[18%] top-[9.6%] m-0 grid h-[22%] place-items-center text-center text-[clamp(8px,0.95vw,13px)] italic leading-[1.02] text-navy">{BOOK_TITLE}</p>
      </div>
    </div>
  );
}

/** The cast on the night shore, mid-conversation. */
function StoryWindow() {
  return (
    <div className="relative h-full w-full overflow-hidden">
      <img src={art('shore-layer-1-sky-night.webp')} alt="" className="absolute left-1/2 top-[-10%] w-[150%] max-w-none -translate-x-1/2" />
      <img src={art('shore-layer-3-dunes.webp')} alt="" className="absolute left-1/2 top-[48%] w-[150%] max-w-none -translate-x-1/2 brightness-[.55]" />
      {content.storyteller.cast.map((c) => (
        <img key={c.file} src={art(c.file)} alt={c.alt} className={`absolute bottom-[4%] ${c.lantern ? 'left-[50%] h-[78%]' : 'left-[26%] h-[70%] brightness-[.8]'}`} />
      ))}
      <img src={art(content.storyteller.flier.file)} alt={content.storyteller.flier.alt} className="absolute left-[70%] top-[16%] h-[24%]" />
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-[45%] bg-gradient-to-t from-room/90 to-transparent" />
      <p className="absolute inset-x-3 bottom-2 m-0 text-center text-[clamp(13px,1.05vw,15px)] text-page [text-shadow:0_2px_10px_rgba(0,0,0,.9)]">
        <span className="mr-1.5 text-sage">Pip</span>
        {DOORS.make.quote}
      </p>
    </div>
  );
}

function Door({ window, heading, title, line, needs, action, tone }: { window: ReactNode; heading: string; title: string; line: string; needs: string; action: ReactNode; tone: 'rust' | 'sage' }) {
  return (
    <article className="flex flex-col text-left">
      <div className={`relative h-[clamp(120px,21svh,260px)] overflow-hidden rounded-[10px] shadow-[0_18px_40px_rgba(4,3,2,.55)] ring-1 ${tone === 'rust' ? 'ring-gold/35' : 'ring-sage/45'}`}>{window}</div>
      <h2 className="display m-0 mt-3 text-[clamp(25px,2.3vw,34px)] leading-tight text-page">{heading}</h2>
      <p className={`m-0 mt-0.5 text-[16px] ${tone === 'rust' ? 'text-gold/90' : 'text-sage'}`}>
        {tone === 'rust' ? <em className="display text-[19px] not-italic">{title}</em> : title}
      </p>
      <p className="m-0 mt-1.5 max-w-[46ch] text-[16px] leading-snug text-page/75">{line} <span className="text-page/55">{needs}</span></p>
      {action && <div className="mt-3">{action}</div>}
    </article>
  );
}

export function Hero({ ready, device, bookAction, storyAction }: { ready: boolean; device: Device; bookAction: ReactNode; storyAction: ReactNode }) {
  const headset = device === 'headset';
  return (
    <section className="relative px-5 pb-10 pt-[max(64px,8svh)] md:px-10" aria-label="Foldtales">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10" style={{ background: 'radial-gradient(ellipse 70% 60% at 50% 30%, rgba(233,184,100,.10), rgba(21,17,14,0) 70%)' }} />
      <div className="mx-auto max-w-[1180px]">
        <Reveal ready={ready} delay={0.3} className="text-center">
          <h1 className="display m-0 text-[clamp(44px,min(6vw,9svh),84px)] font-semibold leading-[0.95] text-page">Foldtales</h1>
          <p className="m-0 mx-auto mt-2 max-w-[44ch] text-[clamp(18px,1.6vw,22px)] leading-relaxed text-page/80">{content.promise}</p>
        </Reveal>
        <Reveal ready={ready} delay={0.6} className="mt-[clamp(16px,3svh,40px)] grid gap-8 md:grid-cols-2 md:gap-10">
          <Door window={<BookWindow />} tone="rust" heading={DOORS.listen.heading} title={DOORS.listen.title} line={DOORS.listen.line} needs={DOORS.listen.needs} action={headset ? bookAction : null} />
          <Door window={<StoryWindow />} tone="sage" heading={DOORS.make.heading} title={DOORS.make.title} line={DOORS.make.line} needs={DOORS.make.needs} action={headset ? storyAction : null} />
        </Reveal>
        {!headset && (
          <Reveal ready={ready} delay={0.85} className="mt-9 flex justify-center">
            <SendToQuest />
          </Reveal>
        )}
      </div>
    </section>
  );
}
