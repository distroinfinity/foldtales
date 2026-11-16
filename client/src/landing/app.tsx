import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { currentReader, pullBook, pushBook, signInFor, takeSignInReturn } from './account-ui.ts';
import { OpenTheBook, PaintedRoomLink, SendToQuest } from './actions.tsx';
import type { Device } from './device.ts';
import { landingSnapshot, openingTap, subscribeLanding } from './landing.ts';
import { BOOK_TITLE, readLibrary, type LibraryState } from './library.ts';
import { ACCOUNTS_ON } from './flags.ts';
import { HERO_ART, WEB_ART, preloadArt } from './preload.ts';
import { BookSheet, Bookplate, type ShelfAction } from './sheets.tsx';
import { shelfTarget } from './library.ts';
import { storytellerSnapshot, subscribeStoryteller } from '../stage/seams.ts';
import { Story } from './story.tsx';
import { Hero, HowItWorks, RENDERS } from './hero.tsx';
import { Storyteller } from './storyteller.tsx';

export const TAGLINE = 'A living storybook on your table. Reach in and help the characters through each chapter, or make up a new story with the AI Storyteller.';

const footLink = 'cursor-pointer border-0 bg-transparent p-0 font-[inherit] text-[15px] text-page/60 no-underline hover:text-page';

function useLibrary(): LibraryState {
  const state = useSyncExternalStore(subscribeLanding, landingSnapshot);
  // Re-read whenever the 3D side reports a new state, e.g. after a chapter is finished.
  const [library, setLibrary] = useState(() => readLibrary(localStorage));
  useEffect(() => setLibrary(readLibrary(localStorage)), [state.kind]);
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
  // A sign-in round trip that just ended: a failure reopens the plate with what happened, in front of the door that started it.
  const [signInReturn] = useState(() => (ACCOUNTS_ON ? takeSignInReturn() : null));
  const [sheet, setSheet] = useState<'plate' | 'chapters' | null>(signInReturn?.problem ? 'plate' : null);
  const [artReady, setArtReady] = useState(false);
  /** The bookplate, opened for a sign-in from the Storyteller's door (comes back to it) or from anywhere else. */
  const openPlate = (forStoryteller = false) => {
    signInFor(forStoryteller ? 'storyteller' : null);
    setSheet('plate');
  };
  // Back from a sign-in: the page is where the reader started it again (the door in the hero, or the one further down).
  useEffect(() => {
    if (artReady && signInReturn && signInReturn.y > 0) window.scrollTo({ top: signInReturn.y, behavior: 'instant' });
  }, [artReady, signInReturn]);
  // Back from the book, signed in: save where you got to, so another headset knows.
  const [wasInside, setWasInside] = useState(false);
  useEffect(() => {
    if (state.kind === 'inside') setWasInside(true);
    else if (ACCOUNTS_ON && wasInside && state.kind === 'ready' && reader) {
      setWasInside(false);
      void pushBook();
    }
  }, [state.kind, wasInside, reader]);
  useEffect(() => {
    if (ACCOUNTS_ON) void currentReader().then((r) => {
      setReader(r?.name ?? null);
      if (r) void pullBook();
    });
    // The hero waits only for its own pictures; the story's are fetched straight after, long before the scroll needs them.
    void preloadArt([RENDERS.hero, ...HERO_ART], 3500).then(() => {
      setArtReady(true);
      void preloadArt(WEB_ART.slice(HERO_ART.length), 15000);
    });
  }, []);

  const storyteller = useSyncExternalStore(subscribeStoryteller, storytellerSnapshot);
  /**
   * A chapter on the shelf: on a headset, the one the button opens goes in one tap; another one is
   * chosen as the entry target, and the page reloads to prepare it. Elsewhere, only its state shows.
   */
  const shelfAction = (n: number): ShelfAction => {
    if (device !== 'headset' || state.kind !== 'ready' || !state.openChapter) return null;
    const c = library.chapters.find((x) => x.n === n);
    if (!c) return null;
    const t = shelfTarget(c);
    const open = state.openChapter;
    return { label: t.label, run: () => openingTap(() => open(n, t.from)) };
  };
  const action = (compact: boolean) =>
    device === 'headset' ? <OpenTheBook state={state} library={library} signedIn={reader} onSignIn={() => openPlate()} compact={compact} /> : <SendToQuest compact={compact} />;

  const doorProps = {
    device,
    library,
    signedIn: reader,
    onSignIn: () => openPlate(true),
    enterStoryteller: state.kind === 'ready' && state.storyteller ? () => openingTap(state.storyteller!.run) : null,
    playByHand: state.kind === 'ready' && state.storyteller?.byHand ? () => openingTap(state.storyteller!.byHand!) : null,
    openBook: state.kind === 'ready' ? () => openingTap(state.open) : null,
    onStories: () => setSheet('chapters'),
    storytellerLabel: state.kind === 'ready' ? (state.storyteller?.label ?? null) : null,
  };
  // The scroll below now opens with one line: the hero above already says what the book is.
  const storyIntro = (
    <h2 className="display m-0 text-[clamp(34px,4.4vw,64px)] leading-[1.02] text-page">Open the book, and this happens.</h2>
  );

  return (
    <>
      <header className="pointer-events-none fixed inset-x-0 top-0 z-20 flex items-center justify-between bg-gradient-to-b from-room via-room/70 to-transparent px-5 pb-7 pt-4 md:px-10">
        <a href="./" className="display pointer-events-auto text-[22px] font-medium tracking-[0.005em] text-page no-underline">
          Foldtales
        </a>
        {ACCOUNTS_ON && device === 'headset' && (
          <button type="button" className="pointer-events-auto min-h-12 cursor-pointer rounded-full border border-page/15 bg-room/50 px-5 text-[15px] text-page/85 backdrop-blur-md hover:border-page/35" onClick={() => openPlate()}>
            {reader ? `${reader}’s book` : 'Sign in'}
          </button>
        )}
      </header>

      {/* Until the pictures are ready, the room is dark; then the lamp comes up. */}
      <motion.div aria-hidden className="pointer-events-none fixed inset-0 z-10 bg-room" initial={{ opacity: 1 }} animate={{ opacity: artReady ? 0 : 1 }} transition={{ duration: 1.1, ease: 'easeOut' }} />

      <main>
        <Hero device={device} ready={artReady} title={BOOK_TITLE} tagline={TAGLINE} openBook={action(true)} door={doorProps} />
        <Story hero={storyIntro} />
        <HowItWorks />
        <Storyteller {...doorProps} />

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
            Your book
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
          <span className="text-[14px] text-page/60 md:ml-auto">Made for the Meta VR Start Developer Competition, 2026</span>
        </nav>
      </footer>

      {ACCOUNTS_ON && <Bookplate open={sheet === 'plate'} onClose={() => setSheet(null)} signedIn={reader} notice={signInReturn?.problem ?? null} />}
      <BookSheet open={sheet === 'chapters'} onClose={() => setSheet(null)} library={library} actionFor={shelfAction} stories={storyteller.finished} />
    </>
  );
}
