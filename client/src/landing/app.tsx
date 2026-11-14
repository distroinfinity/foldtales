import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { currentReader } from './account-ui.ts';
import { OpenTheBook, PaintedRoomLink, SendToQuest } from './actions.tsx';
import type { Device } from './device.ts';
import { landingSnapshot, openingTap, subscribeLanding } from './landing.ts';
import { BOOK_TITLE, libraryStateShim, type LibraryState } from './library.ts';
import { preloadArt } from './preload.ts';
import { Bookplate, ChaptersSheet } from './sheets.tsx';
import { Story } from './story.tsx';
import { Storyteller } from './storyteller.tsx';

export const TAGLINE = 'A living storybook on your table. Reach in and help the characters through each chapter, or make up a new story with the AI Storyteller.';

const footLink = 'cursor-pointer border-0 bg-transparent p-0 font-[inherit] text-[15px] text-page/60 no-underline hover:text-page';

function useLibrary(): LibraryState {
  const state = useSyncExternalStore(subscribeLanding, landingSnapshot);
  // Re-read whenever the 3D side reports a new state, e.g. after a chapter is finished.
  const [library, setLibrary] = useState(() => libraryStateShim(localStorage, () => true));
  useEffect(() => setLibrary(libraryStateShim(localStorage, () => true)), [state.kind]);
  return library;
}

/** The page's one orchestrated entrance: the room is dark, the lamp comes up, then the words. */
function Reveal({ ready, delay, children, className }: { ready: boolean; delay: number; children: ReactNode; className?: string }) {
  const still = useReducedMotion();
  return (
    <motion.div className={className} initial={still ? false : { opacity: 0, y: 10, filter: 'blur(8px)' }} animate={ready ? { opacity: 1, y: 0, filter: 'blur(0px)' } : undefined} transition={{ delay, duration: 0.9, ease: [0.2, 0.7, 0.2, 1] }}>
      {children}
    </motion.div>
  );
}

export function App({ device }: { device: Device }) {
  const state = useSyncExternalStore(subscribeLanding, landingSnapshot);
  const library = useLibrary();
  const [reader, setReader] = useState<string | null>(null);
  const [sheet, setSheet] = useState<'plate' | 'chapters' | null>(null);
  const [artReady, setArtReady] = useState(false);
  useEffect(() => {
    void currentReader().then((r) => setReader(r?.name ?? null));
    void preloadArt().then(() => setArtReady(true));
  }, []);

  const action = (compact: boolean) =>
    device === 'headset' ? <OpenTheBook state={state} library={library} signedIn={reader} onSignIn={() => setSheet('plate')} compact={compact} /> : <SendToQuest compact={compact} />;

  const hero = (
    <>
      <Reveal ready={artReady} delay={0.5}>
        <h1 className="display m-0 text-[clamp(44px,6.2vw,96px)] font-semibold italic leading-[0.95] text-page">{BOOK_TITLE}</h1>
      </Reveal>
      <Reveal ready={artReady} delay={0.75}>
        <p className="m-0 mx-auto mt-4 max-w-[44ch] text-[clamp(17px,1.5vw,20px)] leading-relaxed text-page/80">{TAGLINE}</p>
      </Reveal>
      <Reveal ready={artReady} delay={1} className="mt-7">
        {device === 'headset' ? action(false) : <SendToQuest compact />}
      </Reveal>
    </>
  );

  return (
    <>
      <header className="pointer-events-none fixed inset-x-0 top-0 z-20 flex items-center justify-between bg-gradient-to-b from-room via-room/70 to-transparent px-5 pb-7 pt-4 md:px-10">
        <a href="./" className="display pointer-events-auto text-[22px] font-medium tracking-[0.005em] text-page no-underline">
          Tabletop Theater
        </a>
        {device === 'headset' && (
          <button type="button" className="pointer-events-auto min-h-12 cursor-pointer rounded-full border border-page/15 bg-room/50 px-5 text-[15px] text-page/85 backdrop-blur-md hover:border-page/35" onClick={() => setSheet('plate')}>
            {reader ? `${reader}’s book` : 'Sign in'}
          </button>
        )}
      </header>

      {/* Until the pictures are ready, the room is dark; then the lamp comes up. */}
      <motion.div aria-hidden className="pointer-events-none fixed inset-0 z-10 bg-room" initial={{ opacity: 1 }} animate={{ opacity: artReady ? 0 : 1 }} transition={{ duration: 1.1, ease: 'easeOut' }} />

      <main>
        <Story hero={hero} />
        <Storyteller
          device={device}
          library={library}
          signedIn={reader}
          onSignIn={() => setSheet('plate')}
          enterStoryteller={state.kind === 'ready' && state.storyteller ? () => openingTap(state.storyteller!.run) : null}
          storytellerLabel={state.kind === 'ready' ? (state.storyteller?.label ?? null) : null}
        />

        <section className="px-5 pb-20 pt-[16vh] text-center" aria-labelledby="end-title">
          <h2 id="end-title" className="display m-0 text-[clamp(36px,4.6vw,64px)] leading-[1.02]">
            {device === 'headset' ? 'Your table is ready.' : 'Open it on your Quest.'}
          </h2>
          <p className="m-0 mx-auto mt-4 max-w-[44ch] text-[18px] leading-relaxed text-page/65">
            You’ll need a Meta Quest 3 or 3S and about six minutes. A table helps, but the painted room works anywhere.
          </p>
          <div className="mt-8 flex justify-center">{device === 'headset' ? action(true) : <SendToQuest />}</div>
        </section>
      </main>

      <footer className="border-t border-page/10 px-5 py-7 md:px-10">
        <nav className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-8 gap-y-3" aria-label="More">
          <button type="button" className={footLink} onClick={() => setSheet('chapters')}>
            Chapters
          </button>
          <PaintedRoomLink state={state} device={device} className={footLink} />
          <a className={footLink} href="./about/">
            About
          </a>
          <a className={footLink} href="./privacy/">
            Privacy
          </a>
          {device !== 'headset' && (
            <a className={footLink} href="./?page=landing">
              Open it here anyway
            </a>
          )}
          <span className="text-[14px] text-page/35 md:ml-auto">Made for the Meta VR Start Developer Competition, 2026</span>
        </nav>
      </footer>

      <Bookplate open={sheet === 'plate'} onClose={() => setSheet(null)} signedIn={reader} />
      <ChaptersSheet open={sheet === 'chapters'} onClose={() => setSheet(null)} library={library} />
    </>
  );
}
