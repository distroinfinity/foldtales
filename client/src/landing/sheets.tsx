/**
 * Printed pages that rise over the page when you ask for them: the bookplate (your account) and the
 * book's contents. Built on <dialog>, so focus, Escape and the backdrop come from the browser.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { startPhoneSignIn, googleSignInUrl, type DeviceCode } from './account-ui.ts';
import { pageLink } from './actions.tsx';
import { BOOK_TITLE, type LibraryState } from './library.ts';

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
      className="paper m-auto w-[min(560px,calc(100vw-32px))] rounded-[12px] border-0 p-0 backdrop:bg-[#0e1424]/70 backdrop:backdrop-blur-[2px] open:animate-[sheet-in_.32s_ease-out]"
    >
      <div className="relative px-7 pb-7 pt-8 sm:px-10 sm:pt-10">
        <button type="button" onClick={onClose} className="absolute right-3 top-3 grid size-12 cursor-pointer place-items-center rounded-full border-0 bg-transparent text-[26px] text-ink/60 hover:text-ink" aria-label="Close">
          ×
        </button>
        {children}
      </div>
      <style>{'@keyframes sheet-in { from { opacity: 0; transform: translateY(18px) } to { opacity: 1; transform: none } }'}</style>
    </dialog>
  );
}

const plateButton = 'flex min-h-14 w-full cursor-pointer items-center justify-center gap-3 rounded-[10px] border px-5 text-[19px] font-medium transition-colors';

export function Bookplate({ open, onClose, signedIn }: { open: boolean; onClose: () => void; signedIn: string | null }) {
  const [code, setCode] = useState<DeviceCode | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const google = googleSignInUrl(pageLink());
  const usePhone = async () => {
    setProblem(null);
    const next = await startPhoneSignIn();
    if (next) setCode(next);
    else setProblem('Couldn’t get a code just now. Check your connection, then try again.');
  };
  return (
    <Sheet open={open} onClose={onClose} label="Your book">
      {/* A bookplate, like the label inside an old book's cover. */}
      <div className="rounded-[8px] border-2 border-double border-ink/35 px-6 py-7 text-center sm:px-8">
        {signedIn ? (
          <>
            <p className="display m-0 text-[30px] leading-tight text-navy">This book belongs to {signedIn}</p>
            <p className="m-0 mt-3 text-[17px] text-ink/75">Your place in the book is kept with your account, on any headset. Keepsakes stay on the headset they were found on.</p>
          </>
        ) : code ? (
          <>
            <p className="display m-0 text-[30px] leading-tight text-navy">Put your name in the book</p>
            <p className="m-0 mt-4 text-[18px] text-ink/80">On your phone, go to</p>
            <p className="m-0 mt-1 text-[22px] font-medium text-ink">{code.verificationUrl.replace(/^https?:\/\//, '')}</p>
            <p className="m-0 mt-3 text-[18px] text-ink/80">and enter</p>
            <p className="m-0 mt-1 text-[38px] font-medium tabular-nums tracking-[0.14em] text-navy">{code.userCode}</p>
            <p className="m-0 mt-4 text-[16px] text-ink/65" role="status">Waiting for your phone…</p>
            <button type="button" className="mt-2 cursor-pointer border-0 bg-transparent p-2 text-[17px] text-ink/70 underline underline-offset-4" onClick={() => setCode(null)}>
              Cancel
            </button>
          </>
        ) : (
          <>
            <p className="display m-0 text-[30px] leading-tight text-navy">Put your name in the book</p>
            <p className="m-0 mx-auto mt-3 max-w-[34ch] text-[17px] leading-relaxed text-ink/75">Keep your place on any headset, and open the AI Storyteller.</p>
            <div className="mx-auto mt-6 flex max-w-[340px] flex-col gap-3">
              <a href={google ?? undefined} aria-disabled={!google} className={`${plateButton} border-ink/20 bg-white text-ink no-underline hover:bg-[#fffaf0] aria-disabled:pointer-events-none aria-disabled:opacity-50`}>
                <svg aria-hidden width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.5 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z" /><path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.8c4.3-4 6.9-9.9 6.9-17.1z" /><path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z" /><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.8c-2.1 1.4-4.8 2.3-8.5 2.3-6.2 0-11.5-4.2-13.4-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z" /></svg>
                Continue with Google
              </a>
              <button type="button" className={`${plateButton} border-navy/25 bg-navy text-page hover:bg-[#283657]`} onClick={usePhone}>
                Use your phone
              </button>
            </div>
            {problem && (
              <p className="m-0 mt-4 text-[16px] text-rust" role="alert">
                {problem}
              </p>
            )}
            <button type="button" className="mt-5 cursor-pointer border-0 bg-transparent p-2 text-[17px] text-ink/70 underline underline-offset-4" onClick={onClose}>
              Not now, just open the book
            </button>
          </>
        )}
      </div>
      <p className="m-0 mt-4 text-center text-[14px] text-ink/55">
        We keep your name, email and place in the book. <a className="text-ink/70" href="./privacy/">Privacy</a>
      </p>
    </Sheet>
  );
}

export function ChaptersSheet({ open, onClose, library }: { open: boolean; onClose: () => void; library: LibraryState }) {
  const word = { unread: '', started: 'started', finished: 'read' } as const;
  return (
    <Sheet open={open} onClose={onClose} label="Chapters">
      <h2 className="display m-0 text-[32px] leading-tight text-navy">{BOOK_TITLE}</h2>
      <div className="mt-2 h-px bg-ink/20" />
      <h3 className="m-0 mt-6 text-[15px] font-medium text-ink/60">Chapters</h3>
      <ol className="m-0 mt-2 list-none p-0">
        {library.chapters.map((c) => (
          <li key={c.n} className="flex items-baseline gap-3 py-2 text-[20px]">
            <span className="w-6 text-ink/55">{c.n}</span>
            <span className="text-ink">{c.title}</span>
            <span aria-hidden className="mx-1 flex-1 translate-y-[-4px] border-b border-dotted border-ink/30" />
            <span className="text-[16px] text-ink/60">{word[c.state]}</span>
          </li>
        ))}
      </ol>
      <p className="m-0 mt-2 text-[16px] text-ink/60">More chapters on the way.</p>
      <h3 className="m-0 mt-7 text-[15px] font-medium text-ink/60">AI Storyteller</h3>
      <p className="m-0 mt-2 text-[17px] leading-relaxed text-ink/80">
        {library.storyteller.sessions.length > 0 ? `Your stories: ${library.storyteller.sessions.map((s) => s.title).join(' · ')}` : 'New stories, made up with you, out loud.'}
      </p>
    </Sheet>
  );
}
