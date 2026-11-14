import { useState } from 'react';
import type { Device } from './device.ts';
import { openingTap, type PageState } from './landing.ts';
import { primaryLabel, type LibraryState } from './library.ts';
import { ShimmerButton } from './ui/shimmer-button.tsx';

/** This page, as a link to send to a headset. */
export function pageLink(): string {
  return `${location.origin}${location.pathname}`;
}

/** Meta's own "send this page to your Quest" (developers.meta.com, Web Launch). */
export function sendToQuestUrl(): string {
  return `https://www.oculus.com/open_url/?url=${encodeURIComponent(pageLink())}`;
}

const quiet = 'text-gold underline decoration-1 underline-offset-[5px] hover:text-[#e6b85a] cursor-pointer bg-transparent border-0 p-0 font-[inherit]';

export function SendToQuest({ compact = false }: { compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator.share === 'function';
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(pageLink());
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    } catch {
      prompt('Copy this link, then open it in your Quest’s browser:', pageLink());
    }
  };
  return (
    <div className="flex flex-col items-start gap-4">
      <a href={sendToQuestUrl()} target="_blank" rel="noopener">
        <ShimmerButton tabIndex={-1}>Send to your Quest</ShimmerButton>
      </a>
      <p className="m-0 flex flex-wrap items-center gap-x-5 gap-y-2 text-[17px]">
        <button type="button" className={quiet} onClick={copy}>
          {copied ? 'Link copied' : 'Copy the link'}
        </button>
        {canShare && (
          <button type="button" className={quiet} onClick={() => void navigator.share({ title: 'Tabletop Theater', url: pageLink() }).catch(() => undefined)}>
            Share the link
          </button>
        )}
      </p>
      {!compact && <p className="m-0 max-w-[38ch] text-[16px] leading-relaxed text-page/70">Opens in your Meta Quest’s browser. Just your hands, about 6 minutes.</p>}
    </div>
  );
}

export function OpenTheBook({ state, library, onSignIn, signedIn }: { state: PageState; library: LibraryState; onSignIn: () => void; signedIn: string | null }) {
  const choice = primaryLabel(library);
  const ready = state.kind === 'ready' ? state : state.kind === 'refused' ? state.last : null;
  const label =
    state.kind === 'loading' ? 'Getting the book ready' : state.kind === 'opening' ? 'Opening the book…' : state.kind === 'failed' ? 'The book didn’t load' : (ready?.label ?? choice.label);
  return (
    <div className="flex flex-col items-start gap-3.5">
      <ShimmerButton
        type="button"
        disabled={!ready}
        gleam={state.kind === 'ready'}
        onClick={() => ready && openingTap(ready.open)}
        aria-describedby="open-detail"
      >
        {label}
        {state.kind === 'loading' && (
          <span aria-hidden className="absolute bottom-0 left-0 h-1 bg-gold transition-[width] duration-200" style={{ width: `${Math.round(state.share * 100)}%` }} />
        )}
      </ShimmerButton>
      {state.kind === 'refused' && <p className="m-0 text-[17px] text-page" role="status">Your browser didn’t open the book. Tap to try again.</p>}
      {state.kind === 'failed' ? (
        <p className="m-0 text-[17px] text-page" role="alert">
          Check your connection, then{' '}
          <button type="button" className={quiet} onClick={() => location.reload()}>
            reload the page
          </button>
          .
        </p>
      ) : (
        <p id="open-detail" className="m-0 text-[17px] text-page/75">
          {choice.detail}
        </p>
      )}
      {ready?.restart && (
        <button type="button" className={`${quiet} text-[17px]`} onClick={() => openingTap(ready.restart!.run)}>
          {ready.restart.label}
        </button>
      )}
      <p className="m-0 mt-1 text-[16px] text-page/65">
        {signedIn ? (
          <>
            This book belongs to {signedIn}.{' '}
            <button type="button" className={quiet} onClick={onSignIn}>
              Your book
            </button>
          </>
        ) : (
          <>
            No account needed.{' '}
            <button type="button" className={quiet} onClick={onSignIn}>
              Sign in to keep your book
            </button>
            .
          </>
        )}
      </p>
    </div>
  );
}

export function PaintedRoomLink({ state, device }: { state: PageState; device: Device }) {
  const ready = state.kind === 'ready' ? state : null;
  if (device !== 'headset' || !ready?.openRoom) return null;
  return (
    <button type="button" className={quiet} onClick={() => openingTap(ready.openRoom!)}>
      No table? Read in the painted room
    </button>
  );
}
