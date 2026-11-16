import { z } from 'zod';
import { Id, type Spine } from '@tabletop/contracts';

/**
 * What a chapter carries from the ones before: `episode-N.carry.json` beside its episode. Each slot
 * is a beat (`after`) whose `next` is chosen when the chapter starts: the first pick whose fact
 * matches (and, if it names one, whose object is in the satchel carried in), else `otherwise`. The
 * authored spine already points `after` at `otherwise`, so a chapter with no carry file, or played
 * without the one before, is whole.
 */
export const CarryFile = z.strictObject({
  episodeId: Id.optional(),
  slots: z.array(
    z.strictObject({
      after: Id,
      otherwise: Id,
      pick: z.array(z.strictObject({ when: z.strictObject({ fact: Id, is: Id, has: Id.optional() }), beat: Id })),
    }),
  ),
});
export type CarryFile = z.infer<typeof CarryFile>;

/** Slot by slot, the beat that follows it. Pure. A pick naming a beat the spine lacks is skipped. */
export function chooseCarries(carry: CarryFile, spine: Spine, facts: ReadonlyMap<string, string>, satchel: ReadonlySet<string>): Record<string, string> {
  const beats = new Set(spine.scenes.flatMap((scene) => scene.beats.map((beat) => beat.id)));
  const choice: Record<string, string> = {};
  for (const slot of carry.slots) {
    if (!beats.has(slot.after)) continue;
    const pick = slot.pick.find((p) => beats.has(p.beat) && facts.get(p.when.fact) === p.when.is && (!p.when.has || satchel.has(p.when.has)));
    choice[slot.after] = pick?.beat ?? slot.otherwise;
  }
  return choice;
}

/** The spine as it will play: each slot's beat pointed at its chosen next. A copy; the input is untouched. */
export function applyCarries(spine: Spine, choice: Readonly<Record<string, string>>): Spine {
  return {
    ...spine,
    scenes: spine.scenes.map((scene) => ({ ...scene, beats: scene.beats.map((beat) => (beat.id in choice ? { ...beat, next: choice[beat.id]! } : beat)) })),
  };
}

const ChoiceRecord = z.record(Id, Id);
const choiceKey = (episodeId: string) => `tt.carry.${episodeId}`;

/** The choice a chapter started with, kept so a resumed chapter plays the same path even if a fact changed since. */
export function readCarryChoice(store: Pick<Storage, 'getItem'>, episodeId: string): Record<string, string> | null {
  try {
    const parsed = ChoiceRecord.safeParse(JSON.parse(store.getItem(choiceKey(episodeId)) ?? 'null'));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function writeCarryChoice(store: Pick<Storage, 'setItem'>, episodeId: string, choice: Record<string, string>): void {
  try {
    store.setItem(choiceKey(episodeId), JSON.stringify(choice));
  } catch {
    // Without storage, a resume chooses again from the same facts.
  }
}
