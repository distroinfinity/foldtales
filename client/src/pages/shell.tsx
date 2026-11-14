/** The 2D pages that never load the book: About, Privacy, the phone's sign-in, and Google's return. */
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/cormorant-garamond/600-italic.css';
import '@fontsource/atkinson-hyperlegible-next/400.css';
import '@fontsource/atkinson-hyperlegible-next/500.css';
import '../landing/page.css';
import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';

/** Pages live one folder down (about/) or two (auth/return/); home is that many folders up. */
export const homeUrl = (depth: number): string => new URL('../'.repeat(depth), location.href).href;

export function Shell({ title, children, depth = 1, narrow = true }: { title: string; children: ReactNode; depth?: number; narrow?: boolean }) {
  return (
    <>
      <header className="flex items-center justify-between px-4 py-4 md:px-10">
        <a href={homeUrl(depth)} className="display text-[21px] text-page no-underline">
          Tabletop Theater
        </a>
      </header>
      <main className={`mx-auto px-4 pb-20 pt-[6vh] md:px-10 ${narrow ? 'max-w-[720px]' : 'max-w-[1100px]'}`}>
        <h1 className="display m-0 text-[clamp(36px,5vw,60px)] leading-[1.02]">{title}</h1>
        <div className="prose-page mt-8">{children}</div>
      </main>
      <style>{`
        .prose-page { font-size: 19px; line-height: 1.6; color: color-mix(in srgb, var(--color-page) 82%, transparent); }
        .prose-page h2 { font-family: var(--font-display); font-variation-settings: 'opsz' 144; font-weight: 500; color: var(--color-page); font-size: 28px; line-height: 1.15; margin: 2.2em 0 .5em; }
        .prose-page p, .prose-page ul { margin: 0 0 1em; max-width: 62ch; }
        .prose-page li { margin: .3em 0; }
        .prose-page a:not(.button) { color: var(--color-gold); text-underline-offset: 4px; }
        .prose-page strong { color: var(--color-page); font-weight: 500; }
      `}</style>
    </>
  );
}

export function mount(node: ReactNode): void {
  createRoot(document.getElementById('page')!).render(<StrictMode>{node}</StrictMode>);
}
