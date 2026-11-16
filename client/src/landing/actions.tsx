import { useState } from 'react';
import type { Device } from './device.ts';
import { openingTap, type PageState } from './landing.ts';
import { primaryLabel, type LibraryState } from './library.ts';
import { ACCOUNTS_ON } from './flags.ts';
import { ShimmerButton } from './ui/shimmer-button.tsx';

/** This page, as a link to send to a headset. */
export function pageLink(): string {
  return `${location.origin}${location.pathname}`;
}

/** Meta's own "send this page to your Quest" (developers.meta.com, Web Launch). */
export function sendToQuestUrl(): string {
  return `https://www.oculus.com/open_url/?url=${encodeURIComponent(pageLink())}`;
}

const quiet = 'text-page/80 underline decoration-page/30 decoration-1 underline-offset-[5px] hover:text-page hover:decoration-page/60 cursor-pointer bg-transparent border-0 p-0 font-[inherit]';

export function SendToQuest({ compact = false, buttonOnly = false }: { compact?: boolean; buttonOnly?: boolean }) {
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
  const button = (
    <a href={sendToQuestUrl()} target="_blank" rel="noopener" className="rounded-[12px]">
      <ShimmerButton tabIndex={-1} gleam={false}>Send to your Quest</ShimmerButton>
    </a>
  );
  if (buttonOnly) return button;
  return (
    <div className="flex flex-col items-center gap-4">
      {button}
      <p className="m-0 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[16px]">
        <button type="button" className={quiet} onClick={copy}>
          {copied ? 'Link copied' : 'Copy the link'}
        </button>
        {canShare && (
          <button type="button" className={quiet} onClick={() => void navigator.share({ title: 'Foldtales', url: pageLink() }).catch(() => undefined)}>
            Share the link
          </button>
        )}
      </p>
      {!compact && <p className="m-0 max-w-[40ch] text-[15px] leading-relaxed text-page/55">It opens in your Meta Quest’s browser.</p>}
    </div>
  );
}

export function OpenTheBook({ state, library, onSignIn, signedIn, compact = false }: { state: PageState; library: LibraryState; onSignIn: () => void; signedIn: string | null; compact?: boolean }) {
  const choice = primaryLabel(library);
  const ready = state.kind === 'ready' ? state : state.kind === 'refused' ? state.last : null;
  const label =
    state.kind === 'loading' ? 'Getting the book ready' : state.kind === 'opening' ? 'Opening the book…' : state.kind === 'failed' ? 'The book didn’t load' : (ready?.label ?? choice.label);
  return (
    <div className="flex flex-col items-center gap-3">
      <ShimmerButton
        type="button"
        disabled={!ready}
        gleam={false}
        onClick={() => ready && openingTap(ready.open)}
        data-action="open"
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
        <p id="open-detail" className="m-0 text-[15px] text-page/55">
          {ready?.detail ?? choice.detail}
        </p>
      )}
      {ready?.restart && (
        <button type="button" className={`${quiet} text-[16px]`} onClick={() => openingTap(ready.restart!.run)}>
          {ready.restart.label}
        </button>
      )}
      {!compact && ACCOUNTS_ON && (<p className="m-0 mt-1 text-[15px] text-page/55">
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
      </p>)}
    </div>
  );
}

export function PaintedRoomLink({ state, device, className }: { state: PageState; device: Device; className?: string }) {
  const ready = state.kind === 'ready' ? state : null;
  if (device !== 'headset' || !ready?.openRoom) return null;
  return (
    <button type="button" className={className ?? quiet} onClick={() => openingTap(ready.openRoom!)}>
      No table? Read in the painted room
    </button>
  );
}
