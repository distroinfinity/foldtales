import { mkdtempSync, rmSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NO_STORY, PAINTINGS_USED, STORIES_TODAY_USED, STORY_OVER, STORYTELLER_RESTING } from '@tabletop/contracts';
import { afterEach, describe, expect, test } from 'vitest';
import { openStories, readStoryLimits, type StoryLimits } from '../src/storyteller/stories.ts';

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function fileDb(): { path: string; open: () => DatabaseSync } {
  const dir = mkdtempSync(join(tmpdir(), 'tt-stories-'));
  dirs.push(dir);
  const path = join(dir, 'backend.db');
  return { path, open: () => new DatabaseSync(path) };
}

const page = (title = 'The odd sock', things: string[] = []) => ({ title, summary: 'It found its pair.', things });

function setup(over: Partial<StoryLimits> = {}, at = new Date('2026-11-16T20:00:00Z')) {
  const clock = { at };
  const limits = { ...readStoryLimits({}), ...over };
  const db = new DatabaseSync(':memory:');
  let off = false;
  const stories = openStories(db, limits, () => clock.at, () => off);
  return { stories, clock, db, kill: (v: boolean) => (off = v), limits };
}

describe('stories', () => {
  test('the owner numbers are the defaults, and every ceiling is finite', () => {
    const l = readStoryLimits({});
    expect([l.storiesPerReaderDay, l.storiesPerDay, l.turnsPerStory, l.paintsPerStory, l.paintsPerReaderDay, l.paintCreditCap]).toEqual([3, 150, 40, 6, 12, 100]);
    for (const v of Object.values(l.spend)) expect(Number.isFinite(v) && v > 0).toBe(true);
    expect(() => readStoryLimits({ STORIES_PER_DAY: '-1' })).toThrow();
  });

  test('three stories a reader a day, then a refusal; the next day it resets', () => {
    const { stories, clock } = setup();
    for (const r of ['a', 'b', 'c']) stories.start('ann', r);
    expect(stories.availability('ann')).toMatchObject({ status: 'used-today', storiesLeftToday: 0, resetsAt: '2026-11-17T00:00:00.000Z' });
    expect(() => stories.start('ann', 'd')).toThrow(STORIES_TODAY_USED);
    expect(stories.availability('bob').status).toBe('ready');
    clock.at = new Date('2026-11-17T00:00:01Z');
    expect(stories.start('ann', 'd').storyId).toMatch(/^st-/);
  });

  test('a start id is scoped to the reader: the same id returns the same story, another reader gets their own', () => {
    const { stories } = setup();
    const a = stories.start('ann', 'r1');
    expect(stories.start('ann', 'r1').storyId).toBe(a.storyId);
    expect(stories.start('bob', 'r1').storyId).not.toBe(a.storyId);
    expect(stories.availability('ann').storiesLeftToday).toBe(2);
  });

  test("everyone's daily count and the kill switch both make it rest", () => {
    const { stories, kill } = setup({ storiesPerDay: 2 });
    stories.start('ann', 'a');
    stories.start('bob', 'a');
    expect(stories.availability('cat').status).toBe('resting');
    expect(() => stories.start('cat', 'a')).toThrow(STORYTELLER_RESTING);
    const other = setup();
    other.kill(true);
    expect(other.stories.availability('ann').status).toBe('resting');
    expect(() => other.stories.start('ann', 'a')).toThrow(STORYTELLER_RESTING);
  });

  test('a turn id runs once; a repeat recovers; past the limit a new turn is refused, a repeat still recovers', () => {
    const { stories } = setup({ turnsPerStory: 2 });
    const { storyId } = stories.start('ann', 'a');
    expect(stories.claimTurn('ann', storyId, 't1')).toBe('run');
    expect(stories.claimTurn('ann', storyId, 't1')).toBe('recover');
    expect(stories.claimTurn('ann', storyId, 't2')).toBe('run');
    expect(() => stories.claimTurn('ann', storyId, 't3')).toThrow(STORY_OVER);
    expect(stories.claimTurn('ann', storyId, 't2')).toBe('recover');
    expect(stories.get('ann', storyId)?.turns).toBe(2);
  });

  test("another reader's story is refused, and an ended story takes no turns", () => {
    const { stories } = setup();
    const { storyId } = stories.start('ann', 'a');
    expect(() => stories.claimTurn('bob', storyId, 't1')).toThrow(NO_STORY);
    stories.end('ann', storyId, 'time', page());
    expect(() => stories.claimTurn('ann', storyId, 't1')).toThrow(STORY_OVER);
  });

  test('ending is idempotent, keeps the first page, and names only things that arrived', () => {
    const { stories } = setup();
    const { storyId } = stories.start('ann', 'a');
    const { jobId } = stories.claimPaint('ann', storyId, 'teapot');
    stories.paintArrived(jobId, 'Chipped Blue Teapot');
    const first = stories.end('ann', storyId, 'time', page('The odd sock', ['Chipped Blue Teapot', 'A thing never painted']));
    expect(first).toMatchObject({ title: 'The odd sock', things: ['Chipped Blue Teapot'] });
    expect(first.endedAt).not.toBeNull();
    expect(stories.end('ann', storyId, 'left', page('Other')).title).toBe('The odd sock');
    expect(stories.list('ann').map((r) => r.id)).toEqual([storyId]);
    expect(stories.list('bob')).toEqual([]);
    expect(stories.recent('ann', 3)).toEqual([{ title: 'The odd sock', summary: 'It found its pair.' }]);
  });

  test('a story left active for an hour ends by itself; a titled one stays on the shelf', () => {
    const { stories, clock } = setup();
    const { storyId } = stories.start('ann', 'a');
    stories.setTitle(storyId, 'The paper boat', 'plan');
    stories.start('ann', 'b');
    clock.at = new Date(clock.at.getTime() + 61 * 60_000);
    const shelf = stories.list('ann');
    expect(shelf.map((r) => r.title)).toEqual(['The paper boat']);
    expect(shelf[0]!.endedAt).not.toBeNull();
  });

  test('a painting is one job per (story, object); its limits and the lifetime pool hold; a refund gives it back', () => {
    const { stories } = setup({ paintsPerStory: 2, paintCreditCap: 6 });
    const { storyId } = stories.start('ann', 'a');
    const a = stories.claimPaint('ann', storyId, 'teapot');
    expect(stories.claimPaint('ann', storyId, 'teapot')).toEqual({ jobId: a.jobId, fresh: false });
    stories.claimPaint('ann', storyId, 'kite');
    expect(() => stories.claimPaint('ann', storyId, 'hat')).toThrow(PAINTINGS_USED);
    stories.refundPaint(a.jobId);
    expect(stories.claimPaint('ann', storyId, 'hat').fresh).toBe(true);
    // The pool: 3 jobs live (kite, hat, plus one more) hit 6 credits.
    const other = stories.start('bob', 'a').storyId;
    stories.claimPaint('bob', other, 'boat');
    expect(() => stories.claimPaint('bob', other, 'shell')).toThrow(PAINTINGS_USED);
    expect(stories.paintOwner(a.jobId)).toBe('ann');
    expect(() => stories.claimPaint('bob', storyId, 'x')).toThrow(NO_STORY);
  });

  test('twelve paintings a reader a day, across stories', () => {
    const { stories } = setup({ paintsPerReaderDay: 3 });
    const s1 = stories.start('ann', 'a').storyId;
    const s2 = stories.start('ann', 'b').storyId;
    stories.claimPaint('ann', s1, 'a');
    stories.claimPaint('ann', s1, 'b');
    stories.claimPaint('ann', s2, 'c');
    expect(() => stories.claimPaint('ann', s2, 'd')).toThrow(PAINTINGS_USED);
  });

  test('a speech token needs a story in progress, and is capped per reader a day', () => {
    const { stories } = setup({ speechTokensPerReaderDay: 2 });
    expect(() => stories.claimSpeechToken('ann')).toThrow(NO_STORY);
    const { storyId } = stories.start('ann', 'a');
    stories.claimSpeechToken('ann');
    stories.claimSpeechToken('ann');
    expect(() => stories.claimSpeechToken('ann')).toThrow(/daily limit/);
    stories.end('ann', storyId, 'time', page());
  });

  test('spend: reserve before, refuse at the ceiling, settle to the real usage, keep it when unknown', () => {
    const { stories } = setup({ spend: { claude: 25_000, tts: 1_000, stt: 1 } });
    const a = stories.reserveSpend('claude', 10_000)!;
    const b = stories.reserveSpend('claude', 10_000)!;
    expect(stories.reserveSpend('claude', 10_000)).toBeNull();
    stories.settleSpend(a, 4_000);
    expect(stories.reserveSpend('claude', 10_000)).not.toBeNull();
    stories.settleSpend(b, null);
    expect(stories.reserveSpend('claude', 2_000)).toBeNull();
    // Exhausted spend makes the door rest, so new stories finish before they start.
    expect(stories.availability('ann').status).toBe('resting');
  });

  test('deleting a reader removes their stories, turns, jobs and tokens; the pool and spend stay', () => {
    const { stories, db } = setup({ paintCreditCap: 4 });
    const { storyId } = stories.start('ann', 'a');
    stories.claimTurn('ann', storyId, 't1');
    stories.claimPaint('ann', storyId, 'teapot');
    stories.claimSpeechToken('ann');
    stories.reserveSpend('claude', 100);
    stories.forget('ann');
    for (const table of ['stories', 'story_turns', 'paint_jobs', 'speech_tokens']) {
      expect((db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n).toBe(0);
    }
    expect((db.prepare("SELECT reserved FROM credit_pool WHERE pool = 'live'").get() as { reserved: number }).reserved).toBe(2);
    expect((db.prepare('SELECT SUM(reserved) AS n FROM spend').get() as { n: number }).n).toBe(100);
    // The pool's evidence survives the deletion: the next painting still counts it.
    const bob = stories.start('bob', 'a').storyId;
    stories.claimPaint('bob', bob, 'kite');
    expect(() => stories.claimPaint('bob', bob, 'boat')).toThrow(PAINTINGS_USED);
  });

  test('counts survive closing and reopening the file', () => {
    const file = fileDb();
    const limits = { ...readStoryLimits({}), turnsPerStory: 1, paintCreditCap: 2 };
    const at = () => new Date('2026-11-16T20:00:00Z');
    let db = file.open();
    let stories = openStories(db, limits, at);
    const { storyId } = stories.start('ann', 'a');
    stories.claimTurn('ann', storyId, 't1');
    stories.claimPaint('ann', storyId, 'teapot');
    stories.reserveSpend('claude', 500);
    db.close();
    db = file.open();
    stories = openStories(db, limits, at);
    expect(stories.claimTurn('ann', storyId, 't1')).toBe('recover');
    expect(() => stories.claimTurn('ann', storyId, 't2')).toThrow(STORY_OVER);
    const other = stories.start('bob', 'a').storyId;
    expect(() => stories.claimPaint('bob', other, 'kite')).toThrow(PAINTINGS_USED);
    expect(stories.start('ann', 'a').storyId).toBe(storyId);
    db.close();
  });
});

test("a story's own spend is measured, and voices fall back to captions at the ceiling, said in the log", async () => {
  const { spendingVoices } = await import('../src/storyteller/routes.ts');
  const { stories } = setup({ spend: { claude: 100_000, tts: 1_000, stt: 1 } });
  const { storyId } = stories.start('ann', 'a');
  stories.reserveSpend('tts', 970);
  const logs: string[] = [];
  const voices = spendingVoices({ characters: 0, sound: async () => null, speak: async () => ({ url: 'data:x', durationMs: 1 }) }, stories, storyId, (m) => logs.push(m));
  expect(await voices.speak('narrator', 'Twenty characters!!')).not.toBeNull();
  expect(await voices.speak('narrator', 'Twenty characters!!')).toBeNull();
  expect(logs).toEqual(["voices: captions only (the day's voice ceiling is reached)"]);
  stories.addStorySpend(storyId, 'claude', 4200);
  expect(stories.storySpend(storyId)).toEqual({ tts: 19, claude: 4200 });
});
