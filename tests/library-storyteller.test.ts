import { describe, expect, test } from 'vitest';
import { libraryState, subscribeLibrary } from '../client/src/show/progress.ts';
import { refreshStoryteller, storytellerSnapshot } from '../client/src/storyteller/provider.ts';

/** The seam with lane B (agreed, Nov 16): the library carries lane D's provider's snapshot, and re-fires when it changes. */

const memory = () => {
  const map = new Map<string, string>();
  return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v), removeItem: (k: string) => void map.delete(k) };
};

describe("the library's Storyteller", () => {
  test("carries the provider's snapshot: the door's state and the finished stories", () => {
    const state = libraryState(memory(), Date.now());
    const snapshot = storytellerSnapshot();
    expect(state.storyteller.door).toEqual(snapshot.door);
    expect(state.storyteller.finished).toEqual(snapshot.finished);
    expect(state.storyteller).toEqual(snapshot);
  });

  test('a library subscriber hears the Storyteller change, and stops hearing it once unsubscribed', async () => {
    let heard = 0;
    const stop = subscribeLibrary(() => (heard += 1));
    await refreshStoryteller();
    expect(heard).toBeGreaterThan(0);
    // This build has sign-in off, so the door rests: the library says so too.
    expect(libraryState(memory(), Date.now()).storyteller.door).toEqual({ kind: 'unavailable', why: 'service' });
    stop();
    const before = heard;
    await refreshStoryteller();
    expect(heard).toBe(before);
  });
});
