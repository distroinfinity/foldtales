import { lineIdOf } from '@tabletop/contracts';

/**
 * The Storyteller's recorded lines (art run 023): failure, limit and redirect moments, voiced ahead
 * of time in the live voices, so they play with no network. The run's job id is the runtime id.
 * Who says each and its words are this book's data, in `public/show/storyteller.json` (`recorded`),
 * so the engine knows no character's name.
 *
 * Served from `./art/sound/storyteller/<id>.mp3` (the folder is in `manifest.artFolders`) and
 * decoded into the sound engine at story start under the same line id a live line with the same
 * speaker and words would have. A beat that speaks one of these texts plays its recording. Until
 * the run is recorded, or if a clip can't load, the line still shows as a caption.
 */

export const RECORDED_IDS = [
  'welcome-fallback',
  'finder-picks',
  'slow',
  'offline',
  'online',
  'redirect-a',
  'redirect-b',
  'finder-empty',
  'finder-tired',
  'resting',
  'close-fallback',
  'close-time',
  'ears-down',
] as const;

export type RecordedId = (typeof RECORDED_IDS)[number];

export interface RecordedLine {
  /** A cast id, or "narrator". */
  speaker: string;
  text: string;
}

export type RecordedLines = Partial<Record<RecordedId, RecordedLine>>;

/** Where a recorded line is served, relative to the page. */
export const recordedUrl = (id: RecordedId): string => `./art/sound/storyteller/${id}.mp3`;

/** The sound engine's line id for a recorded line: the same as a live line with these words. */
export const recordedLineId = (line: RecordedLine): string => lineIdOf(line.speaker, line.text);

/** Decodes every recorded line into the sound engine. Resolves with the ids that loaded; never throws. */
export async function preloadRecorded(lines: RecordedLines, addLine: (lineId: string, url: string, durationMs: number) => Promise<boolean>): Promise<RecordedId[]> {
  const loaded = await Promise.all(
    RECORDED_IDS.map(async (id) => {
      const line = lines[id];
      if (!line) return null;
      return (await addLine(recordedLineId(line), recordedUrl(id), estimateMs(line.text)).catch(() => false)) ? id : null;
    }),
  );
  return loaded.filter((id): id is RecordedId => id !== null);
}

/** About how long a line takes to say, for its beat's timing until the clip's real length is known. */
const estimateMs = (text: string): number => Math.max(1200, Math.round((text.length / 14) * 1000));
