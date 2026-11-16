import type { EnterTarget } from '../show/progress.ts';

/**
 * Where the reader asked to go, kept across putting the book away, a reload and a sign-in round trip
 * in the same tab. Chosen inside the book (or on the page); prepared once this page has loaded the book
 * for it (an XR refusal leaves it prepared, so the retry opens the same thing); consumed once that mode
 * has started inside XR. `back` is where they were, read before anything clears it.
 */
export interface Entry {
  target: EnterTarget;
  back: EnterTarget | null;
  at: string;
  state: 'chosen' | 'prepared';
}

const KEY = 'tt.enter';
/** Untouched this long, the choice lapses and the page shows where you were. */
export const ENTRY_TTL_MS = 30 * 60_000;

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const store = (s?: Store): Store | null => {
  try {
    return s ?? sessionStorage;
  } catch {
    return null;
  }
};

function read(s: Store | null): Entry | null {
  try {
    const raw = s?.getItem(KEY);
    if (!raw) return null;
    const e = JSON.parse(raw) as Entry;
    return e && e.target && (e.target.kind === 'chapter' || e.target.kind === 'storyteller') ? e : null;
  } catch {
    return null;
  }
}

function write(s: Store | null, e: Entry | null): void {
  try {
    if (e) s?.setItem(KEY, JSON.stringify(e));
    else s?.removeItem(KEY);
  } catch {
    // Without storage the page simply shows where you were.
  }
}

export function chooseEntry(target: EnterTarget, back: EnterTarget | null, now = Date.now(), s?: Store): void {
  write(store(s), { target, back, at: new Date(now).toISOString(), state: 'chosen' });
}

/** The waiting choice, or null once it has lapsed (a lapsed one is cleared). */
export function pendingEntry(now = Date.now(), s?: Store): Entry | null {
  const st = store(s);
  const e = read(st);
  if (!e) return null;
  if (now - Date.parse(e.at) > ENTRY_TTL_MS) {
    write(st, null);
    return null;
  }
  return e;
}

/** This page has loaded the book for it: one tap opens it now, and a refused XR retries the same. */
export function prepareEntry(s?: Store): void {
  const st = store(s);
  const e = read(st);
  if (e) write(st, { ...e, state: 'prepared' });
}

/** The mode it asked for has started inside XR. */
export function consumeEntry(s?: Store): void {
  write(store(s), null);
}

/** The reader chose "Back to …" (or loading failed): returns where they were, and forgets the choice. */
export function cancelEntry(s?: Store): EnterTarget | null {
  const st = store(s);
  const back = read(st)?.back ?? null;
  write(st, null);
  return back;
}

/**
 * Whether going to `target` needs a fresh page load: each load prepares one chapter, and runs one mode.
 * A chapter other than the prepared one, or the other mode once one has run, means reloading.
 */
export function needsReload(target: EnterTarget, prepared: { chapter: number; ran: 'chapter' | 'story' | null }): boolean {
  if (target.kind === 'chapter') return target.n !== prepared.chapter || prepared.ran === 'story';
  return prepared.ran === 'chapter';
}
