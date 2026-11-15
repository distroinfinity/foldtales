# Finish sprint: API shapes and ownership (lane A's proposal)

Nov 16, 2026. For the sprint master's approval, then forwarded to lanes B, D and E. Follows the stage 2 rulings (`docs/plans/2026-11-15-finish-product-overhaul.md`). All of this is client-side: **no contracts change**.

## The principle

**Lane A's host runs every mode; lanes B and D supply data and sessions, not menus or lifecycle wiring.** Each page load runs exactly one mode (one chapter, or the Storyteller), chosen by the entry target before the book is prepared. So nothing has to be swapped in place inside XR, and "load chapter n" is just "prepare chapter n for this page load".

## Ownership

| Area | Owner | Files |
|---|---|---|
| The host: `run()`'s lifecycle, the host generation and its invalidation, the menu and its cards, the entry target, applying paintings and keepsakes to the stage, the microphone's on/off, the sound settings call | **A** | `client/src/index.ts`, `client/src/stage/book-menu.ts`, `client/src/stage/host.ts`, `client/src/book/card*.ts`, `client/src/landing/entry.ts` |
| The page, Your book, the door's layout, the bookplate's layout, `/link/` and `/auth/return/` layouts | **A** | `client/src/landing/`, `client/src/pages/` |
| The collection read adapter | **A** | `client/src/landing/collection.ts` |
| Chapters: `CHAPTERS`, `libraryState()`, progress per chapter, loading chapter n, chapter-end memory, and any `show/runtime.ts` patches chapters need | **B** | `client/src/show/progress.ts`, `client/src/show/chapters.ts` (new), `client/src/show/runtime.ts`, `client/src/memory/` |
| The Storyteller session (its suspend, queue, end and dispose), its provider (door state and finished stories), its keepsake store's read, auth behaviour | **D** | `client/src/storyteller/`, `client/src/account/` |
| Sound engine mute, the offline cache check | **E** (A calls them) | `client/src/sound/engine.ts`, the PWA cache module |

Edits to another lane's file go through that lane. Where A needs a one-line call site in B's or D's file (or they in `index.ts`), it's named below and agreed here.

## 1. Lane B: chapters

```ts
// client/src/show/chapters.ts (B)
export interface ChapterData {
  n: number;
  title: string;                 // from the episode's own data
  episodeId: string;
  /** What the host needs to stage it: the episode, its canon, its spine. Same types index.ts reads today. */
  episode: unknown;              // B narrows this to today's types
  canon: unknown | null;
  /** The next chapter's number, or null for the last one in this build. */
  next: number | null;
  /** Where the reader is, for "Stopped on the shore." From a beat id; null when unknown. */
  where(beatId: string): string | null;
}
/** Prepares chapter n for this page load. Rejects if it can't (missing data, art failed). */
export function loadChapter(n: number): Promise<ChapterData>;
```

```ts
// client/src/show/progress.ts (B): the shape stays; two additions
export interface LibraryState {
  chapters: Array<{ n: number; title: string; state: 'unread' | 'started' | 'finished'; canResume: boolean; where?: string }>;
  next: { kind: 'chapter'; n: number; resume: boolean };
  storyteller: StorytellerSnapshot;        // from lane D's provider (section 2)
}
export function libraryState(store, now, seriesId?): LibraryState;
/** Called whenever progress or the Storyteller provider changes, so both doors update live. */
export function subscribeLibrary(listener: () => void): () => void;
/** Per chapter, for the host to call when a chapter starts and ends. */
export function writeProgress(store, progress: { seriesId: string; chapter: number; state: 'started' | 'finished' }): void;
```

- **The host calls:** `loadChapter(target.n)` while the page prepares the book; `writeProgress()` at start and end (today's calls, with `n`); the recorded page at the end (`page.composed`, today's event) for the end card.
- **B makes sure:** the recorded page's `text` is up to three reader-facing lines ("You gave Pip his lantern.") and its `keepsakes` are object ids with names in the library; a checkpoint is per chapter, so `readCheckpoint(store, now, { seriesId, episodeId })` finds chapter n's place.
- **Not this sprint:** loading a second chapter inside a running XR session.

## 2. Lane D: the Storyteller

```ts
// client/src/storyteller/provider.ts (D)
export type DoorState =
  | { kind: 'signed-out' } | { kind: 'auth-loading' } | { kind: 'auth-failed' } | { kind: 'session-expired' }
  | { kind: 'mic-not-asked' } | { kind: 'mic-refused' }
  | { kind: 'unavailable'; why: 'offline' | 'service' } | { kind: 'limit-reached'; until: string | null }
  | { kind: 'ready' };
export interface FinishedStory { id: string; title: string; endedAt: string; lines: string[]; things: string[] }
export interface StorytellerSnapshot { door: DoorState; finished: FinishedStory[] }
export function storytellerSnapshot(): StorytellerSnapshot;      // sync, from what's cached
export function subscribeStoryteller(listener: () => void): () => void;
export function refreshStoryteller(): Promise<void>;              // re-check auth, mic, connection, limits
export function askMicrophone(): Promise<'granted' | 'denied'>;   // today's askForMicrophone, moved
```

**The door's states and actions** (A draws them; D's words in `page-content.json`'s `storyteller` block):

| State | Button | Live? | Beside it |
|---|---|---|---|
| signed-out | Sign in to start → the bookplate | yes | — |
| auth-loading | Checking your sign-in… | no (transient) | — |
| auth-failed | Try again → `refreshStoryteller()` | yes | — |
| session-expired | Sign in again → the bookplate | yes | — |
| mic-not-asked | Let them hear you → `askMicrophone()` | yes | — |
| mic-refused | Try again → `askMicrophone()` | yes | how to allow it in the browser |
| unavailable | (greyed) the reason | no | **Open the book** (chapters) |
| limit-reached | (greyed) the reason, and when it's back | no | **Open the book** (chapters) |
| ready | Start a new story → entry target `storyteller` | yes | **Your stories** when `finished` isn't empty |

```ts
// client/src/storyteller/session.ts (D): additions to StorySession
interface StorySession {
  // today: open(), heard(), gift(), interrupt(), arrived(), frame(), dispose(), state
  /** A page is open, the cover is shut, or the headset is off: hold everything (turn events, beats, voice, paint jobs) in order. */
  suspend(): void;
  /** Play what was held, in order. */
  resume(): void;
  /** "End the story here": end locally (no network needed) and resolve with its ending. */
  end(): Promise<StoryEnding>;
  /** The story's title once it has one (for the pause card), or null. */
  title(): string | null;
}
export interface StoryEnding { title: string; lines: string[]; things: string[] }   // lines: 2–3
// SessionDeps addition: the session ends itself (lost connection, tonight's limit) through this.
onEnded?(ending: StoryEnding): void;
```

- **The host (A) does:** starts the session; owns a **host generation** that bumps on leave, switch, restart and reader change, and drops any painting, keepsake or turn result from an older generation; applies paintings and kept things to the stage (`collectPainting`, `bringKeepsakes`, today in `index.ts`); stops the microphone at once on any pause, page, leave and XR end; calls `suspend()`/`resume()`; shows the story's end card from `StoryEnding`; records the finished story through D's provider (below).
- **D does:** the queue inside `suspend()`/`resume()`; the local ending; `title()`; the provider, including writing a finished story when the host calls `recordFinished(ending)`.

```ts
// client/src/storyteller/provider.ts (D)
export function recordFinished(story: { id: string } & StoryEnding): Promise<void>;
/** Things painted for you, names only. Tagged so "nothing yet" and "couldn't read" differ. */
export function listKeepsakes(): Promise<{ ok: true; items: Array<{ id: string; name: string }> } | { ok: false }>;
```

**Sign-in behaviour** (D), rendered by A's bookplate, `/link/` and `/auth/return/`:

```ts
// client/src/account/ (D)
export function startPhoneSignIn(): Promise<DeviceCode | null>;                       // today
export function watchPhoneSignIn(cb: (s: 'pending' | 'approved' | 'denied' | 'expired') => void): () => void;  // today
export function providerSignInUrl(provider: 'google' | 'facebook', returnTo: string): string | null;  // null: provider off
export const FACEBOOK_ON: boolean;   // TT_PUBLIC_FACEBOOK === 'on'
export function finishSignIn(): Promise<'ok' | 'failed'>;   // no reload of its own: the page decides (keeps tt.enter)
```

## 3. Lane E

```ts
// client/src/sound/engine.ts (E): addition
setMuted(on: boolean): void;   // ramps both buses' masters (show and UI) to silence and back; music joins the show bus
// the cache module (E)
export function bookCached(): Promise<boolean>;   // whether a chapter can start offline from this browser
```

## 4. Lane A provides

```ts
// client/src/landing/entry.ts (A)
export type Entry = { target: EnterTarget; back: EnterTarget | null; at: string; state: 'chosen' | 'prepared' };
export function chooseEntry(target: EnterTarget, back: EnterTarget | null): void;   // sets tt.enter
export function pendingEntry(now?: number): Entry | null;                            // null when expired (30 min)
export function consumeEntry(): void;    // only after the mode has loaded inside XR
export function cancelEntry(): EnterTarget | null;   // returns back, which the page then shows
```

- **Kept across** XR exit, a reload and a sign-in round trip in the same tab. **Prepared** once the book for it has loaded on this page; an XR refusal leaves it prepared, so the retry tap opens the same thing. **Consumed** once the mode has started inside XR. **Back** is read before anything clears it.
- Lanes B and D don't call `book-menu.ts`; the host feeds it from `ChapterData`, `StorySession` and `StoryEnding`.

## Checks each lane can run against these

- B: `loadChapter(1)` returns today's chapter; `libraryState()` with `subscribeLibrary` fires on `writeProgress`.
- D: a session with a controlled stream: `suspend()` during a turn holds its beats; `resume()` plays them in order; `dispose()` after `suspend()` drops them; `end()` with the network off resolves a local ending.
- A: the host's generation test: a painting, a keepsake and a turn resolved after leave, switch, restart or reader change write nothing to the stage.
