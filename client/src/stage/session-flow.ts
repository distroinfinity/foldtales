/**
 * What happens across XR sessions. The first time, the book is found, lands and opens the story.
 * Leaving mid-story pauses it. Coming back (or reloading after a crash), the book arrives again at the
 * new spot, shut, then reopens, and the story carries on where it was.
 */
export function createSessionFlow() {
  let reArriving = false;
  return {
    /** A new XR session. `storyStarted` is whether the show has begun (or was resumed from a checkpoint). */
    begin(storyStarted: boolean): { shut: boolean } {
      reArriving = storyStarted;
      return { shut: storyStarted };
    },
    /** The session ended. */
    end(storyStarted: boolean): { pause: boolean } {
      return { pause: storyStarted };
    },
    /** Whether a placement may move the stage now: always before the story, and once more on returning. */
    canPlace(storyStarted: boolean): boolean {
      return !storyStarted || reArriving;
    },
    /** The book has landed and the arrival is over. */
    landed(storyStarted: boolean): { reopen: boolean } {
      const reopen = storyStarted && reArriving;
      reArriving = false;
      return { reopen };
    },
  };
}
export type SessionFlow = ReturnType<typeof createSessionFlow>;
