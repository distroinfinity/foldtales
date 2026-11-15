import { lineIdOf } from '@tabletop/contracts';

/**
 * The Storyteller's recorded lines (art run 023): failure, limit and redirect moments, voiced ahead
 * of time in the live voices, so they play with no network. The run's job id is the runtime id.
 *
 * Served from `./art/sound/storyteller/<id>.mp3` (the folder is in `manifest.artFolders`) and
 * decoded into the sound engine at story start under the same line id a live line with the same
 * speaker and words would have. A beat that speaks one of these texts plays its recording. Until
 * the run is recorded, or if a clip can't load, the line still shows as a caption.
 */

export type RecordedId =
  | 'welcome-fallback'
  | 'moth-picks'
  | 'slow'
  | 'offline'
  | 'online'
  | 'redirect-a'
  | 'redirect-b'
  | 'moth-empty'
  | 'moth-tired'
  | 'resting'
  | 'close-fallback'
  | 'close-time'
  | 'ears-down';

export interface RecordedLine {
  id: RecordedId;
  /** A cast id, or "narrator". */
  speaker: string;
  text: string;
}

export const RECORDED: Record<RecordedId, RecordedLine> = {
  'welcome-fallback': { id: 'welcome-fallback', speaker: 'pip', text: "Oh! It's you. Tell us what tonight's story is about, or hand us something from the drawer." },
  'moth-picks': { id: 'moth-picks', speaker: 'moth', text: "This one's been rattling all night!" },
  slow: { id: 'slow', speaker: 'narrator', text: 'The lamp flickers… now, where were we?' },
  offline: { id: 'offline', speaker: 'narrator', text: 'The lamp has gone quiet. The story will wait right here.' },
  online: { id: 'online', speaker: 'narrator', text: "Ah, there's the light again." },
  'redirect-a': { id: 'redirect-a', speaker: 'narrator', text: 'And just then, the page turned all by itself, to somewhere cozier.' },
  'redirect-b': { id: 'redirect-b', speaker: 'narrator', text: 'A gentle wind turned the page, and the story found a kinder path.' },
  'moth-empty': { id: 'moth-empty', speaker: 'moth', text: "Couldn't find it anywhere! Maybe it's still lost." },
  'moth-tired': { id: 'moth-tired', speaker: 'moth', text: "My wings are tired, but your satchel's full of treasures." },
  resting: { id: 'resting', speaker: 'narrator', text: "That's all the story the lamp has oil for tonight." },
  'close-fallback': { id: 'close-fallback', speaker: 'narrator', text: 'And so the story was gathered up, and tucked into the book for another night.' },
  'close-time': { id: 'close-time', speaker: 'narrator', text: "The lamp burns low, and tonight's story comes to rest." },
  'ears-down': { id: 'ears-down', speaker: 'pip', text: "I couldn't hear you just then. Show me instead?" },
};

/** Where a recorded line is served, relative to the page. */
export const recordedUrl = (id: RecordedId): string => `./art/sound/storyteller/${id}.mp3`;

/** The sound engine's line id for a recorded line: the same as a live line with these words. */
export const recordedLineId = (line: RecordedLine): string => lineIdOf(line.speaker, line.text);

/** Decodes every recorded line into the sound engine. Resolves with the ids that loaded; never throws. */
export async function preloadRecorded(addLine: (lineId: string, url: string, durationMs: number) => Promise<boolean>): Promise<RecordedId[]> {
  const loaded = await Promise.all(
    Object.values(RECORDED).map(async (line) => ((await addLine(recordedLineId(line), recordedUrl(line.id), estimateMs(line.text)).catch(() => false)) ? line.id : null)),
  );
  return loaded.filter((id): id is RecordedId => id !== null);
}

/** About how long a line takes to say, for its beat's timing until the clip's real length is known. */
const estimateMs = (text: string): number => Math.max(1200, Math.round((text.length / 14) * 1000));
