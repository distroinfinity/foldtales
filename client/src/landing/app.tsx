import { useEffect, useState, useSyncExternalStore } from 'react';
import { currentReader } from './account-ui.ts';
import { OpenTheBook, PaintedRoomLink, SendToQuest } from './actions.tsx';
import type { Device } from './device.ts';
import { landingSnapshot, subscribeLanding } from './landing.ts';
import { BOOK_TITLE, libraryStateShim, type LibraryState } from './library.ts';
import { Bookplate, ChaptersSheet } from './sheets.tsx';
import { Story } from './story.tsx';
import { Storyteller } from './storyteller.tsx';
import { BlurFade } from './ui/blur-fade.tsx';

export const TAGLINE = 'A living storybook on your table. Reach in and help the characters through each chapter, or make up a new story with the AI Storyteller.';

const footLink = 'text-page/70 underline decoration-page/30 underline-offset-[5px] hover:text-page cursor-pointer bg-transparent border-0 p-0 font-[inherit] text-[16px]';

function useLibrary(): LibraryState {
  const state = useSyncExternalStore(subscribeLanding, landingSnapshot);
  // Re-read whenever the 3D side reports a new state, e.g. after a chapter is finished.
  const [library, setLibrary] = useState(() => libraryStateShim(localStorage, () => true));
  useEffect(() => setLibrary(libraryStateShim(localStorage, () => true)), [state.kind]);
  return library;
}

export function App({ device }: { device: Device }) {
  const state = useSyncExternalStore(subscribeLanding, landingSnapshot);
  const library = useLibrary();
  const [reader, setReader] = useState<string | null>(null);
  const [sheet, setSheet] = useState<'plate' | 'chapters' | null>(null);
  useEffect(() => {
    void currentReader().then((r) => setReader(r?.name ?? null));
  }, []);

  const hero = (
    <div className="pt-16 md:pt-0">
      <BlurFade delay={0.15}>
        <h1 className="display m-0 max-w-[13ch] text-[clamp(40px,5.4vw,76px)] leading-[0.98] text-page">{BOOK_TITLE}</h1>
      </BlurFade>
      <BlurFade delay={0.35}>
        <p className="m-0 mt-5 max-w-[38ch] text-[clamp(18px,1.55vw,21px)] leading-relaxed text-page/80">{TAGLINE}</p>
      </BlurFade>
      <BlurFade delay={0.55} className="mt-8">
        {device === 'headset' ? <OpenTheBook state={state} library={library} signedIn={reader} onSignIn={() => setSheet('plate')} /> : <SendToQuest />}
      </BlurFade>
    </div>
  );

  return (
    <>
      <header className="pointer-events-none fixed inset-x-0 top-0 z-20 flex items-center justify-between bg-gradient-to-b from-deep via-deep/70 to-transparent px-4 pb-6 pt-4 md:px-10">
        <a href="./" className="display pointer-events-auto text-[21px] text-page no-underline">
          Tabletop Theater
        </a>
        {device === 'headset' && (
          <button type="button" className="pointer-events-auto min-h-12 cursor-pointer rounded-full border border-page/20 bg-night/60 px-5 text-[16px] text-page backdrop-blur-sm hover:border-page/40" onClick={() => setSheet('plate')}>
            {reader ? `${reader}’s book` : 'Sign in'}
          </button>
        )}
      </header>

      <main>
        <Story hero={hero} />
        <Storyteller device={device} library={library} signedIn={reader} onSignIn={() => setSheet('plate')} enterStoryteller={null} />

        <section className="px-4 pb-16 pt-[10vh] text-center md:px-10" aria-labelledby="end-title">
          <h2 id="end-title" className="display m-0 text-[clamp(30px,3.6vw,48px)] leading-tight">
            {device === 'headset' ? 'Your table is ready.' : 'Open it on your Quest.'}
          </h2>
          <div className="mt-8 flex justify-center">{device === 'headset' ? <OpenTheBook state={state} library={library} signedIn={reader} onSignIn={() => setSheet('plate')} /> : <SendToQuest />}</div>
          <p className="mx-auto m-0 mt-12 max-w-[56ch] text-[16px] leading-relaxed text-page/60">
            What you need: a Meta Quest 3 or 3S, a table (or the painted room), about 6 minutes, and just your hands.
          </p>
        </section>
      </main>

      <footer className="border-t border-page/10 px-4 py-8 md:px-10">
        <nav className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-8 gap-y-4" aria-label="More">
          <button type="button" className={footLink} onClick={() => setSheet('chapters')}>
            Chapters
          </button>
          <PaintedRoomLink state={state} device={device} />
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
          <span className="ml-auto text-[14px] text-page/40">Made for the Meta VR Start Developer Competition, 2026</span>
        </nav>
      </footer>

      <Bookplate open={sheet === 'plate'} onClose={() => setSheet(null)} signedIn={reader} />
      <ChaptersSheet open={sheet === 'chapters'} onClose={() => setSheet(null)} library={library} />
    </>
  );
}
