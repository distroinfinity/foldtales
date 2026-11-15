import { describe, expect, it } from 'vitest';
import { back, cardFor, cardShowing, choose, ended, holdsStory, initialMenu, returned, ribbon, type MenuContext } from '../client/src/stage/book-menu.ts';

const ctx = (over: Partial<MenuContext> = {}): MenuContext => ({
  mode: 'chapter',
  heading: { over: 'Chapter 1', title: 'The night the light went out' },
  where: null,
  current: 1,
  chapters: [
    { n: 1, title: 'The night the light went out', state: 'started', canResume: true },
    { n: 2, title: 'Two', state: 'unread', canResume: false },
    { n: 3, title: 'Three', state: 'unread', canResume: false },
    { n: 4, title: 'Four', state: 'unread', canResume: false },
  ],
  stories: [],
  satchelCount: 2,
  soundOn: true,
  light: 'dimmer',
  ending: { heading: 'The end of chapter 1', lines: ['You gave him his lantern.'], things: ['kite'], next: 'Continue to chapter 2' },
  ...over,
});
const ids = (s: ReturnType<typeof initialMenu>, c = ctx()) => cardFor(s, c)?.choices.map((x) => x.id) ?? null;

describe('the book menu', () => {
  it('the ribbon opens the pause card and holds the story; again, it carries on', () => {
    let s = ribbon(initialMenu());
    expect(holdsStory(s)).toBe(true);
    expect(ids(s)).toEqual(['carry-on', 'again', 'contents', 'put-away']);
    s = ribbon(s);
    expect(cardShowing(s)).toBe(false);
    expect(holdsStory(s)).toBe(false);
  });

  it('from deep in the menu the ribbon returns to the story, and Back goes one card up', () => {
    let s = ribbon(initialMenu());
    s = choose(s, 'contents', ctx()).state;
    s = choose(s, 'settings', ctx()).state;
    expect(ids(s)).toEqual(['sound', 'back']);
    expect(ids(back(s))).toEqual(['chapters', 'storyteller', 'settings', 'back']);
    expect(cardShowing(ribbon(s))).toBe(false);
  });

  it('Carry on leaves every card and asks the host to carry on', () => {
    const r = choose(ribbon(initialMenu()), 'carry-on', ctx());
    expect(r.effect).toEqual({ kind: 'carry-on' });
    expect(cardShowing(r.state)).toBe(false);
  });

  it('an ended story shows its end card, never Carry on, and the ribbon opens the contents', () => {
    let s = ended(ribbon(initialMenu()));
    expect(holdsStory(s)).toBe(false);
    expect(ids(s)).toEqual(['next-chapter', 'again', 'put-away']);
    s = ribbon(s);
    expect(ids(s)).toEqual(['chapters', 'storyteller', 'settings', 'back']);
    expect(choose(s, 'carry-on', ctx()).effect).toBeNull();
    // Back, or the ribbon, returns to the end card.
    expect(ids(back(s))).toEqual(['next-chapter', 'again', 'put-away']);
    expect(ids(ribbon(s))).toEqual(['next-chapter', 'again', 'put-away']);
  });

  it('the running chapter offers Carry on; another chapter is opened through the page', () => {
    let s = choose(choose(ribbon(initialMenu()), 'contents', ctx()).state, 'chapters', ctx()).state;
    expect(ids(s)).toEqual(['chapter:1', 'chapter:2', 'more', 'back']);
    s = choose(s, 'more', ctx()).state;
    expect(ids(s)).toEqual(['chapter:3', 'chapter:4', 'back']);
    const one = choose(s, 'chapter:1', ctx()).state;
    expect(ids(one)).toEqual(['carry-on', 'again', 'back']);
    const two = choose(s, 'chapter:3', ctx()).state;
    expect(ids(two)).toEqual(['open:3:start', 'back']);
    const r = choose(two, 'open:3:start', ctx());
    expect(r.effect).toEqual({ kind: 'open', target: { kind: 'chapter', n: 3, from: 'start' } });
    expect(r.state.leaving).toBe(true);
    // Leaving: nothing else can be chosen.
    expect(choose(r.state, 'back', ctx()).state).toBe(r.state);
  });

  it('in the Storyteller, the pause card ends the story here; the end card tells another or lists your stories', () => {
    const c = ctx({ mode: 'storyteller', current: null, heading: { over: null, title: 'A key for the cellar' }, ending: { heading: 'A key for the cellar', lines: ['a', 'b'], things: ['teapot'], next: null }, stories: [{ title: 'A key', lines: ['x'] }, { title: 'B', lines: ['y'] }] });
    const s = ribbon(initialMenu());
    expect(cardFor(s, c)!.choices.find((x) => x.id === 'again')!.label).toBe('End the story here');
    const e = ended(initialMenu());
    expect(ids(e, c)).toEqual(['tell-another', 'stories', 'put-away']);
    const list = choose(e, 'stories', c).state;
    expect(ids(list, c)).toEqual(['more', 'back']);
    expect(ids(choose(list, 'more', c).state, c)).toEqual(['back']);
    expect(ids(back(list), c)).toEqual(['tell-another', 'stories', 'put-away']);
  });

  it('after putting the book away and coming back, the ribbon answers again; an ending stays an ending', () => {
    const away = choose(ribbon(initialMenu()), 'put-away', ctx()).state;
    expect(ribbon(away)).toBe(away);
    const back1 = returned(away);
    expect(back1.leaving).toBe(false);
    expect(ids(ribbon(back1))).toEqual(['carry-on', 'again', 'contents', 'put-away']);
    const endedAway = choose(ended(initialMenu()), 'put-away', ctx()).state;
    expect(returned(endedAway).root).toBe('ending');
  });

  it('every change bumps the generation', () => {
    const s = initialMenu();
    const a = ribbon(s);
    expect(a.generation).toBe(s.generation + 1);
    expect(choose(a, 'contents', ctx()).state.generation).toBe(a.generation + 1);
  });

  it('no card holds more than four choices', () => {
    let s = ribbon(initialMenu());
    for (const id of ['contents', 'chapters']) s = choose(s, id, ctx()).state;
    expect(cardFor(s, ctx())!.choices.length).toBeLessThanOrEqual(4);
  });
});
