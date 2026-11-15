/**
 * Printed pages that rise over the page when you ask for them: the bookplate (your account) and the
 * book's contents. Built on <dialog>, so focus, Escape and the backdrop come from the browser.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { deleteMyBook, finishSignIn, googleSignInUrl, signOutHere, startPhoneSignIn, watchPhoneSignIn, type DeviceCode } from './account-ui.ts';
import { pageLink } from './actions.tsx';
import { BOOK_TITLE, type LibraryState } from './library.ts';
import { readCollection, type Collection } from './collection.ts';
import type { FinishedStory } from '../stage/seams.ts';

function Sheet({ open, onClose, label, children }: { open: boolean; onClose: () => void; label: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-label={label}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="paper m-auto w-[min(560px,calc(100vw-32px))] rounded-[12px] border-0 p-0 backdrop:bg-[#15110e]/75 backdrop:backdrop-blur-[2px] open:animate-[sheet-in_.32s_ease-out]"
    >
      <div className="relative px-7 pb-7 pt-8 sm:px-10 sm:pt-10">
        <button type="button" onClick={onClose} className="absolute right-3 top-3 grid size-12 cursor-pointer place-items-center rounded-full border-0 bg-transparent text-[26px] text-ink/75 hover:text-ink" aria-label="Close">
          ×
        </button>
        {children}
      </div>
      <style>{'@keyframes sheet-in { from { opacity: 0; transform: translateY(18px) } to { opacity: 1; transform: none } }'}</style>
    </dialog>
  );
}

const plateButton = 'flex min-h-14 w-full cursor-pointer items-center justify-center gap-3 rounded-[10px] border px-5 text-[19px] font-medium transition-colors';

const GOOGLE_ICON = (
  <svg aria-hidden width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.5 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z" /><path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.8c4.3-4 6.9-9.9 6.9-17.1z" /><path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z" /><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.8c-2.1 1.4-4.8 2.3-8.5 2.3-6.2 0-11.5-4.2-13.4-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z" /></svg>
);

const quietInk = 'cursor-pointer border-0 bg-transparent p-2 font-[inherit] text-[16px] text-ink/70 underline decoration-ink/30 underline-offset-4 hover:text-ink';

/** The phone-code sign-in: shows the code, and follows the phone's answer until it's settled. */
function PhoneCode({ onCancel }: { onCancel: () => void }) {
  const [code, setCode] = useState<DeviceCode | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  useEffect(() => {
    let stop: (() => void) | null = null;
    let live = true;
    void startPhoneSignIn().then((next) => {
      if (!live) return;
      if (!next) {
        setNote('Couldn’t get a code just now. Check your connection, then try again.');
        return;
      }
      setCode(next);
      stop = watchPhoneSignIn((status) => {
        if (status === 'approved') {
          setNote('Signed in. Opening your book…');
          void finishSignIn();
        } else if (status === 'denied') {
          setNote('That sign-in was declined on your phone, so here’s a new code.');
          setRound((r) => r + 1);
        } else if (status === 'expired') {
          setNote('That code expired, so here’s a new one.');
          setRound((r) => r + 1);
        }
      });
    });
    return () => {
      live = false;
      stop?.();
    };
  }, [round]);
  const where = (code?.verificationUrl ?? `${location.origin}/link/`).replace(/^https?:\/\//, '');
  return (
    <>
      <p className="display m-0 text-[30px] leading-tight text-navy">Put your name in the book</p>
      <p className="m-0 mt-4 text-[18px] text-ink/80">On your phone or laptop, go to</p>
      <p className="m-0 mt-1 text-[21px] font-medium break-all text-ink">{where}</p>
      <p className="m-0 mt-3 text-[18px] text-ink/80">and enter</p>
      <p className="m-0 mt-1 min-h-[52px] text-[40px] font-medium tracking-[0.14em] tabular-nums text-navy">{code?.userCode ?? '· · · ·'}</p>
      <p className="m-0 mt-3 min-h-6 text-[16px] text-ink/75" role="status">
        {note ?? (code ? 'Waiting for your phone…' : 'Getting a code…')}
      </p>
      <button type="button" className={`${quietInk} mt-1`} onClick={onCancel}>
        Cancel
      </button>
    </>
  );
}

export function Bookplate({ open, onClose, signedIn }: { open: boolean; onClose: () => void; signedIn: string | null }) {
  const [mode, setMode] = useState<'choose' | 'phone' | 'confirm-delete'>('choose');
  const [problem, setProblem] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const google = googleSignInUrl(pageLink());
  useEffect(() => {
    if (!open) {
      setMode('choose');
      setProblem(null);
      setOffline(false);
    }
  }, [open]);
  const leave = async (force: boolean) => {
    const result = await signOutHere(force);
    if (result === 'offline') setOffline(true);
  };
  const remove = async () => {
    const result = await deleteMyBook();
    if (result === 'needs-fresh-sign-in') {
      setProblem('To delete your book, sign in again first, then come back here.');
      setMode('phone');
    } else if (result === 'failed') setProblem('Couldn’t reach the server, so nothing was deleted. Check your connection, then try again.');
  };
  return (
    <Sheet open={open} onClose={onClose} label="Your book">
      {/* A bookplate, like the label inside an old book's cover. */}
      <div className="rounded-[8px] border-2 border-double border-ink/35 px-6 py-7 text-center sm:px-8">
        {signedIn && mode !== 'phone' ? (
          mode === 'confirm-delete' ? (
            <>
              <p className="display m-0 text-[30px] leading-tight text-navy">Delete your book?</p>
              <p className="m-0 mx-auto mt-3 max-w-[36ch] text-[17px] leading-relaxed text-ink/75">This removes your account, your place in the book, and every headset signed in to it. It can’t be undone.</p>
              <div className="mx-auto mt-6 flex max-w-[340px] flex-col gap-3">
                <button type="button" className={`${plateButton} border-rust/40 bg-rust text-page hover:bg-rust-deep`} onClick={remove}>
                  Delete my book
                </button>
                <button type="button" className={quietInk} onClick={() => setMode('choose')}>
                  Keep it
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="display m-0 text-[30px] leading-tight text-navy">This book belongs to {signedIn}</p>
              <p className="m-0 mx-auto mt-3 max-w-[38ch] text-[17px] leading-relaxed text-ink/75">The chapters you’ve read follow you to any headset. Your exact place in a chapter, and the keepsakes you find, stay on the headset you used.</p>
              {offline ? (
                <div className="mx-auto mt-6 flex max-w-[360px] flex-col gap-3">
                  <p className="m-0 text-[16px] text-ink/80" role="alert">You’re offline, so your last few minutes aren’t saved to your account. Sign out anyway?</p>
                  <button type="button" className={`${plateButton} border-navy/25 bg-navy text-page`} onClick={() => void leave(true)}>
                    Sign out anyway
                  </button>
                  <button type="button" className={quietInk} onClick={() => setOffline(false)}>
                    Stay signed in
                  </button>
                </div>
              ) : (
                <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
                  <button type="button" className={quietInk} onClick={() => void leave(false)}>
                    Sign out
                  </button>
                  <button type="button" className={quietInk} onClick={() => setMode('confirm-delete')}>
                    Delete my book
                  </button>
                </div>
              )}
            </>
          )
        ) : mode === 'phone' ? (
          <>
            {problem && <p className="m-0 mb-3 text-[16px] text-rust" role="alert">{problem}</p>}
            <PhoneCode onCancel={() => setMode('choose')} />
          </>
        ) : (
          <>
            <p className="display m-0 text-[30px] leading-tight text-navy">Put your name in the book</p>
            <p className="m-0 mx-auto mt-3 max-w-[34ch] text-[17px] leading-relaxed text-ink/75">Keep your place on any headset, and open the AI Storyteller.</p>
            <div className="mx-auto mt-6 flex max-w-[340px] flex-col gap-3">
              <a href={google ?? undefined} className={`${plateButton} border-ink/20 bg-white text-ink no-underline hover:bg-[#fffaf0]`}>
                {GOOGLE_ICON}
                Continue with Google
              </a>
              <button type="button" className={`${plateButton} border-navy/25 bg-navy text-page hover:bg-[#283657]`} onClick={() => setMode('phone')}>
                Use your phone
              </button>
            </div>
            <button type="button" className={`${quietInk} mt-5`} onClick={onClose}>
              Not now, just open the book
            </button>
          </>
        )}
      </div>
      <p className="m-0 mt-4 text-center text-[14px] text-ink/75">
        We keep your name, email and place in the book. <a className="text-ink/70" href="./privacy/">Privacy</a>
      </p>
    </Sheet>
  );
}

/** One way into a chapter from Your book: its label, and what a tap does (null: nothing to do from here). */
export type ShelfAction = { label: string; run: () => void } | null;

/**
 * Your book: the shelf (each chapter, with what a tap does), the AI Storyteller's finished stories,
 * and what you've kept, by name. Nothing here looks tappable that isn't.
 */
export function BookSheet({ open, onClose, library, actionFor, stories }: { open: boolean; onClose: () => void; library: LibraryState; actionFor: (n: number) => ShelfAction; stories: FinishedStory[] }) {
  const word = { unread: '', started: 'started', finished: 'read' } as const;
  const [kept, setKept] = useState<Collection | 'loading'>('loading');
  useEffect(() => {
    if (!open) return;
    setKept('loading');
    let live = true;
    void readCollection().then((c) => live && setKept(c));
    return () => {
      live = false;
    };
  }, [open]);
  const keptLine = (names: string[] | null, empty: string) => (names === null ? <span className="text-rust">Couldn’t read what’s kept on this headset.</span> : names.length ? names.join(' · ') : <span className="text-ink/60">{empty}</span>);
  return (
    <Sheet open={open} onClose={onClose} label="Your book">
      <h2 className="display m-0 text-[32px] leading-tight text-navy">Your book</h2>
      <p className="m-0 mt-1 text-[17px] text-ink/70">{BOOK_TITLE}</p>
      <div className="mt-3 h-px bg-ink/20" />
      <ol className="m-0 mt-3 list-none p-0">
        {library.chapters.map((c) => {
          const action = actionFor(c.n);
          return (
            <li key={c.n} className="flex items-baseline gap-3 py-2 text-[19px]">
              <span className="w-6 text-ink/55">{c.n}</span>
              <span className="text-ink">{c.title}</span>
              <span aria-hidden className="mx-1 flex-1 translate-y-[-4px] border-b border-dotted border-ink/30" />
              {action ? (
                <button type="button" className={`${quietInk} p-1 text-[16px]`} onClick={action.run}>
                  {action.label}
                </button>
              ) : (
                <span className="text-[16px] text-ink/70">{word[c.state]}</span>
              )}
            </li>
          );
        })}
      </ol>
      <p className="m-0 mt-1 text-[16px] text-ink/70">More chapters on the way.</p>
      <h3 className="m-0 mt-7 text-[15px] font-medium text-ink/75">Your stories, with the AI Storyteller</h3>
      {stories.length ? (
        <ul className="m-0 mt-2 list-none p-0">
          {stories.map((st) => (
            <li key={st.id} className="py-2">
              <p className="display m-0 text-[20px] text-navy">{st.title}</p>
              {st.lines.length > 0 && <p className="m-0 mt-1 text-[16px] leading-relaxed text-ink/75">{st.lines.slice(0, 3).join(' ')}</p>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 mt-2 text-[16px] text-ink/60">Stories you finish with the AI Storyteller are kept here.</p>
      )}
      <h3 className="m-0 mt-7 text-[15px] font-medium text-ink/75">What you’ve kept</h3>
      {kept === 'loading' ? (
        <p className="m-0 mt-2 text-[16px] text-ink/60" role="status">Looking in your satchel…</p>
      ) : (
        <>
          <p className="m-0 mt-2 text-[16px] leading-relaxed text-ink/80">From the chapters: {keptLine(kept.chapters, 'nothing yet. Things you use in a chapter are kept.')}</p>
          <p className="m-0 mt-1 text-[16px] leading-relaxed text-ink/80">Painted for you: {keptLine(kept.painted, 'nothing yet.')}</p>
          <p className="m-0 mt-2 text-[14px] text-ink/60">Kept on this headset.</p>
        </>
      )}
    </Sheet>
  );
}
