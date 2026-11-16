/**
 * Lanes B and D's seams, as the host reads them (approved by the sprint master, Nov 16). Both are
 * on main and re-exported as they are: lane B's chapters, and lane D's Storyteller provider and
 * session. Shapes: `docs/plans/2026-11-16-finish-api-shapes.md` §1 and §2.
 */

// ---- lane B: chapters (on main since PR #24) -----------------------------------------------

export { loadChapter, whereIn, type ChapterData } from '../show/chapters.ts';

// ---- lane D: the AI Storyteller (landed with #30: re-exports of the real modules) ----------------

export {
  askMicrophone,
  listKeepsakes,
  recordFinished,
  refreshStoryteller,
  storytellerSnapshot,
  subscribeStoryteller,
  type DoorState,
  type FinishedStory,
  type StorytellerSnapshot,
} from '../storyteller/provider.ts';
export type { StoryEnding } from '../storyteller/session.ts';
