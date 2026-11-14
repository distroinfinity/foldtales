import { motion } from 'motion/react';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { currentReader, pullBook, pushBook } from './account-ui.ts';
import { OpenTheBook, PaintedRoomLink, SendToQuest } from './actions.tsx';
import type { Device } from './device.ts';
import { landingSnapshot, openingTap, subscribeLanding } from './landing.ts';
import { readLibrary, type LibraryState } from './library.ts';
import { ACCOUNTS_ON } from './flags.ts';
import { HERO_ART, WEB_ART, preloadArt } from './preload.ts';
import { Bookplate, ChaptersSheet } from './sheets.tsx';
import { Story } from './story.tsx';
import { StoryDoor, Storyteller } from './storyteller.tsx';
import { Hero } from './hero.tsx';
import content from './page-content.json';

export const TAGLINE = 'A living storybook on your table. Reach in and help the characters through each chapter, or make up a new story with the AI Storyteller.';

const footLink = 'cursor-pointer border-0 bg-transparent p-0 font-[inherit] text-[15px] text-page/60 no-underline hover:text-page';

function useLibrary(): LibraryState {
  const state = useSyncExternalStore(subscribeLanding, landingSnapshot);
  // Re-read whenever the 3D side reports a new state, e.g. after a chapter is finished.
  const [library, setLibrary] = useState(() => readLibrary(localStorage));
  useEffect(() => setLibrary(readLibrary(localStorage)), [state.kind]);
  return library;
}

export function App({ device }: { device: Device }) {
  const state = useSyncExternalStore(subscribeLanding, landingSnapshot);
  const library = useLibrary();
  const [reader, setReader] = useState<string | null>(null);
  const [sheet, setSheet] = useState<'plate' | 'chapters' | null>(null);
  const [artReady, setArtReady] = useState(false);
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
    void preloadArt(HERO_ART, 3500).then(() => {
      setArtReady(true);
      void preloadArt(WEB_ART.slice(HERO_ART.length), 15000);
    });
  }, []);

  const bookDoor = (compact: boolean, align: 'start' | 'center') => <OpenTheBook state={state} library={library} signedIn={reader} onSignIn={() => setSheet('plate')} compact={compact} align={align} />;
  const storyDoor = (
    <StoryDoor
      device={device}
      library={library}
      signedIn={reader}
      onSignIn={() => setSheet('plate')}
      enterStoryteller={state.kind === 'ready' && state.storyteller ? () => openingTap(state.storyteller!.run) : null}
      storytellerLabel={state.kind === 'ready' ? (state.storyteller?.label ?? null) : null}
    />
  );
  // The "Listen" section opens with what it is; the 3D book does the rest as you scroll.
  const listenIntro = (
    <>
      <h2 className="display m-0 text-[clamp(34px,4.4vw,64px)] leading-[1.02] text-page">{content.listenIntro.title}</h2>
      <p className="m-0 mt-3 max-w-[42ch] text-[clamp(17px,1.35vw,20px)] leading-relaxed text-page/70">{content.listenIntro.line}</p>
    </>
  );

  return (
    <>
      <header className="pointer-events-none fixed inset-x-0 top-0 z-20 flex items-center justify-between bg-gradient-to-b from-room via-room/70 to-transparent px-5 pb-7 pt-4 md:px-10">
        <a href="./" className="display pointer-events-auto text-[22px] font-medium tracking-[0.005em] text-page no-underline">
          Foldtales
        </a>
        {ACCOUNTS_ON && device === 'headset' && (
          <button type="button" className="pointer-events-auto min-h-12 cursor-pointer rounded-full border border-page/15 bg-room/50 px-5 text-[15px] text-page/85 backdrop-blur-md hover:border-page/35" onClick={() => setSheet('plate')}>
            {reader ? `${reader}’s book` : 'Sign in'}
          </button>
        )}
      </header>

      {/* Until the pictures are ready, the room is dark; then the lamp comes up. */}
      <motion.div aria-hidden className="pointer-events-none fixed inset-0 z-10 bg-room" initial={{ opacity: 1 }} animate={{ opacity: artReady ? 0 : 1 }} transition={{ duration: 1.1, ease: 'easeOut' }} />

      <main>
        <Hero ready={artReady} device={device} bookAction={bookDoor(true, 'start')} storyAction={storyDoor} />
        <Story hero={listenIntro} />
        <Storyteller />

        <section className="px-5 pb-20 pt-[14vh] md:px-10" aria-labelledby="end-title">
          <h2 id="end-title" className="display m-0 text-center text-[clamp(36px,4.6vw,64px)] leading-[1.02]">
            {content.end.title}
          </h2>
          <p className="m-0 mx-auto mt-4 max-w-[46ch] text-center text-[18px] leading-relaxed text-page/65">{content.end.needs}</p>
          {device === 'headset' ? (
            <div className="mx-auto mt-10 grid max-w-[860px] gap-10 md:grid-cols-2">
              <div>
                <h3 className="display m-0 text-[28px] text-page">{content.doors.listen.heading}</h3>
                <p className="m-0 mb-4 mt-1 text-[16px] text-page/60">{content.doors.listen.needs}</p>
                {bookDoor(true, 'start')}
              </div>
              <div>
                <h3 className="display m-0 text-[28px] text-page">{content.doors.make.heading}</h3>
                <p className="m-0 mb-4 mt-1 text-[16px] text-page/60">{content.doors.make.needs}</p>
                {storyDoor}
              </div>
            </div>
          ) : (
            <div className="mt-9 flex justify-center">
              <SendToQuest />
            </div>
          )}
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
          <span className="text-[14px] text-page/60 md:ml-auto">Made for the Meta VR Start Developer Competition, 2026</span>
        </nav>
      </footer>

      {ACCOUNTS_ON && <Bookplate open={sheet === 'plate'} onClose={() => setSheet(null)} signedIn={reader} />}
      <ChaptersSheet open={sheet === 'chapters'} onClose={() => setSheet(null)} library={library} />
    </>
  );
}
