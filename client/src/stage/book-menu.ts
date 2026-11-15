/**
 * The book's menu: what the pop-up card shows, and where every choice, Back and the ribbon lead.
 * Pure, so every path can be tested without a headset. The host (index.ts) turns its effects into
 * the story's pause, the card, and leaving.
 *
 * The root is where you return to: the story (playing) or, once it has ended, its end card. A finished
 * story never offers Carry on. Cards reached from the root stack up; Back pops one; the ribbon returns
 * to the root (or, from the end card, opens the contents).
 */
import { paginate } from '../book/card-layout.ts';
import type { CardSpec } from '../book/card-view.ts';

export type ModeKind = 'chapter' | 'storyteller';

export type Page =
  | { kind: 'pause' }
  | { kind: 'contents' }
  | { kind: 'chapters'; page: number }
  | { kind: 'chapter'; n: number }
  | { kind: 'storyteller' }
  | { kind: 'stories'; index: number }
  | { kind: 'settings' };

export interface MenuState {
  root: 'playing' | 'ending';
  stack: Page[];
  /** Bumped on every change, so a pinch or a gaze that started on an older card never lands on a newer one. */
  generation: number;
  leaving: boolean;
}

export const initialMenu = (): MenuState => ({ root: 'playing', stack: [], generation: 0, leaving: false });

/** What the menu asks of the host. */
export type MenuEffect =
  | { kind: 'carry-on' }
  | { kind: 'again' }
  | { kind: 'put-away' }
  /** Open a chapter or the Storyteller: in place when it's the one running, otherwise through the page. */
  | { kind: 'open'; target: { kind: 'chapter'; n: number; from: 'resume' | 'start' } | { kind: 'storyteller' } }
  | { kind: 'next-chapter' }
  | { kind: 'tell-another' }
  | { kind: 'toggle-sound' }
  | { kind: 'cycle-light' };

const bump = (s: MenuState, next: Partial<MenuState>): MenuState => ({ ...s, ...next, generation: s.generation + 1 });

/** Is a card showing? */
export const cardShowing = (s: MenuState): boolean => s.stack.length > 0 || s.root === 'ending';
/** Is the story held by the menu? (Only while it's playing: an ended story has nothing to hold.) */
export const holdsStory = (s: MenuState): boolean => s.root === 'playing' && s.stack.length > 0;

export function ribbon(s: MenuState): MenuState {
  if (s.leaving) return s;
  if (s.root === 'playing') return bump(s, { stack: s.stack.length ? [] : [{ kind: 'pause' }] });
  return bump(s, { stack: s.stack.length ? [] : [{ kind: 'contents' }] });
}

export function back(s: MenuState): MenuState {
  if (s.leaving || !s.stack.length) return s;
  return bump(s, { stack: s.stack.slice(0, -1) });
}

export function push(s: MenuState, page: Page): MenuState {
  if (s.leaving) return s;
  return bump(s, { stack: [...s.stack, page] });
}

/** Replaces the top card (paging through a list). */
export function replace(s: MenuState, page: Page): MenuState {
  if (s.leaving || !s.stack.length) return s;
  return bump(s, { stack: [...s.stack.slice(0, -1), page] });
}

/** The mode ended: its end card is the root now, and whatever was open closes. */
export function ended(s: MenuState): MenuState {
  return bump(s, { root: 'ending', stack: [] });
}

/** A fresh start in the same mode (Start again, Tell another): back to playing, nothing open. */
export function restarted(s: MenuState): MenuState {
  return bump(s, { root: 'playing', stack: [], leaving: false });
}

/** Back in the book after putting it away (same page load): nothing open, and the menu answers again. */
export function returned(s: MenuState): MenuState {
  return s.leaving || s.stack.length ? bump(s, { leaving: false, stack: [] }) : s;
}

export function leaving(s: MenuState): MenuState {
  return bump(s, { leaving: true, stack: [] });
}

/** What the host knows when it draws a card. */
export interface MenuContext {
  mode: ModeKind;
  heading: { over: string | null; title: string };
  where: string | null;
  /** The chapter this page load is running, if it's a chapter. */
  current: number | null;
  chapters: Array<{ n: number; title: string; state: 'unread' | 'started' | 'finished'; canResume: boolean }>;
  stories: Array<{ title: string; lines: string[] }>;
  satchelCount: number | null;
  soundOn: boolean;
  /** The room's light while the story plays: the full theatre dim, or lighter. */
  light: 'dark' | 'lighter';
  /** The end card's contents, once the mode has ended. */
  ending: { heading: string; lines: string[]; things: string[]; next: string | null } | null;
}

const PER_CARD = 4;
const STATE_WORD = { unread: 'Not read yet', started: 'Started', finished: 'Read' } as const;

/** The card for the menu's top page (or the end card at an ending root). Null when nothing shows. */
export function cardFor(s: MenuState, ctx: MenuContext): CardSpec | null {
  const page = s.stack[s.stack.length - 1];
  if (!page) {
    if (s.root !== 'ending' || !ctx.ending) return null;
    const e = ctx.ending;
    const note = e.things.length ? `${ctx.mode === 'storyteller' ? 'Painted for you' : 'Kept'}: ${e.things.join(', ')}` : null;
    const choices =
      ctx.mode === 'chapter'
        ? [...(e.next ? [{ id: 'next-chapter', label: e.next }] : []), { id: 'again', label: 'Read again' }, { id: 'put-away', label: 'Put the book away' }]
        : [{ id: 'tell-another', label: 'Tell another' }, { id: 'stories', label: 'Your stories' }, { id: 'put-away', label: 'Put the book away' }];
    return { title: e.heading, lines: e.lines.slice(0, 3), note, choices };
  }
  switch (page.kind) {
    case 'pause':
      return {
        over: ctx.heading.over,
        title: ctx.heading.title,
        note: ctx.where,
        choices: [
          { id: 'carry-on', label: 'Carry on' },
          { id: 'again', label: ctx.mode === 'chapter' ? 'Start again' : 'End the story here' },
          { id: 'contents', label: 'Contents' },
          { id: 'put-away', label: 'Put the book away' },
        ],
      };
    case 'contents':
      return {
        title: 'Contents',
        note: ctx.satchelCount === null ? null : ctx.satchelCount === 1 ? 'Your satchel: 1 thing' : `Your satchel: ${ctx.satchelCount} things`,
        choices: [
          { id: 'chapters', label: 'Chapters' },
          { id: 'storyteller', label: 'The AI Storyteller' },
          { id: 'settings', label: 'Settings' },
          { id: 'back', label: 'Back' },
        ],
      };
    case 'chapters': {
      const pages = paginate(
        ctx.chapters.map((c) => ({ id: `chapter:${c.n}`, label: `${c.n}. ${c.title}` })),
        PER_CARD,
        { id: 'more', label: 'More' },
        { id: 'back', label: 'Back' },
      );
      const i = Math.min(page.page, pages.length - 1);
      return { title: 'Chapters', note: i === pages.length - 1 ? 'More chapters on the way.' : null, choices: pages[i]! };
    }
    case 'chapter': {
      const c = ctx.chapters.find((x) => x.n === page.n);
      if (!c) return { title: 'Chapters', choices: [{ id: 'back', label: 'Back' }] };
      const running = ctx.mode === 'chapter' && ctx.current === c.n;
      const choices = running
        ? [{ id: 'carry-on', label: 'Carry on' }, { id: 'again', label: 'Start again' }]
        : c.state === 'started' && c.canResume
          ? [{ id: `open:${c.n}:resume`, label: 'Continue' }, { id: `open:${c.n}:start`, label: 'Start again' }]
          : [{ id: `open:${c.n}:start`, label: c.state === 'finished' ? 'Read again' : 'Start' }];
      const away = running ? null : 'The book is put away, then it opens there from the page.';
      return { over: `Chapter ${c.n}`, title: c.title, note: [STATE_WORD[c.state], away].filter(Boolean).join('. '), choices: [...choices, { id: 'back', label: 'Back' }] };
    }
    case 'storyteller':
      return {
        title: 'The AI Storyteller',
        note: ctx.mode === 'storyteller' ? null : 'The book is put away, then it opens from the page.',
        choices: [{ id: 'tell-another', label: 'Start a new story' }, { id: 'stories', label: 'Your stories' }, { id: 'back', label: 'Back' }],
      };
    case 'stories': {
      if (!ctx.stories.length) return { title: 'Your stories', note: 'Stories you finish with the AI Storyteller are kept here.', choices: [{ id: 'back', label: 'Back' }] };
      const i = Math.min(page.index, ctx.stories.length - 1);
      const story = ctx.stories[i]!;
      const more = i < ctx.stories.length - 1;
      return { over: `Your stories · ${i + 1} of ${ctx.stories.length}`, title: story.title, lines: story.lines.slice(0, 3), choices: [...(more ? [{ id: 'more', label: 'Next story' }] : []), { id: 'back', label: 'Back' }] };
    }
    case 'settings':
      return {
        title: 'Settings',
        choices: [
          { id: 'sound', label: ctx.soundOn ? 'Sound: on' : 'Sound: off' },
          { id: 'light', label: ctx.light === 'dark' ? 'Room: dark' : 'Room: lighter' },
          { id: 'back', label: 'Back' },
        ],
      };
  }
}

/** A choice on the current card: the new state, and anything the host must do. */
export function choose(s: MenuState, id: string, ctx: MenuContext): { state: MenuState; effect: MenuEffect | null } {
  const page = s.stack[s.stack.length - 1];
  const none = (state: MenuState) => ({ state, effect: null });
  if (s.leaving) return none(s);
  if (id === 'back') return none(back(s));
  if (id === 'contents') return none(push(s, { kind: 'contents' }));
  if (id === 'chapters') return none(push(s, { kind: 'chapters', page: 0 }));
  if (id === 'storyteller') return none(push(s, { kind: 'storyteller' }));
  if (id === 'settings') return none(push(s, { kind: 'settings' }));
  if (id === 'stories') return none(push(s, { kind: 'stories', index: 0 }));
  if (id === 'more' && page?.kind === 'chapters') return none(replace(s, { kind: 'chapters', page: page.page + 1 }));
  if (id === 'more' && page?.kind === 'stories') return none(replace(s, { kind: 'stories', index: page.index + 1 }));
  if (id.startsWith('chapter:')) return none(push(s, { kind: 'chapter', n: Number(id.slice(8)) }));
  if (id === 'carry-on') return s.root === 'playing' ? { state: bump(s, { stack: [] }), effect: { kind: 'carry-on' } } : none(s);
  if (id === 'again') {
    if (ctx.mode === 'storyteller' && s.root === 'playing') return { state: bump(s, { stack: [] }), effect: { kind: 'again' } };
    return { state: restarted(s), effect: { kind: 'again' } };
  }
  if (id === 'put-away') return { state: leaving(s), effect: { kind: 'put-away' } };
  if (id === 'next-chapter') return { state: leaving(s), effect: { kind: 'next-chapter' } };
  if (id === 'tell-another') {
    if (ctx.mode === 'storyteller') return { state: restarted(s), effect: { kind: 'tell-another' } };
    return { state: leaving(s), effect: { kind: 'open', target: { kind: 'storyteller' } } };
  }
  if (id.startsWith('open:')) {
    const [, n, from] = id.split(':');
    return { state: leaving(s), effect: { kind: 'open', target: { kind: 'chapter', n: Number(n), from: from === 'resume' ? 'resume' : 'start' } } };
  }
  if (id === 'sound') return { state: bump(s, {}), effect: { kind: 'toggle-sound' } };
  if (id === 'light') return { state: bump(s, {}), effect: { kind: 'cycle-light' } };
  return none(s);
}
