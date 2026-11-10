import { z } from 'zod';

export interface ActingDef {
  /** Goes straight into the director's prompt. */
  summary: string;
  takesTarget: boolean;
  /** How long the scheduler and the simulator hold a group for this acting. */
  nominalMs: number;
}

/** Closed, because each one is puppet code. Which character can do which is `CastMember.acting`. */
export const ACTING = {
  idle: { summary: 'waits, breathing and blinking', takesTarget: false, nominalMs: 1000 },
  look: { summary: 'looks up at someone or something', takesTarget: true, nominalMs: 900 },
  scared: { summary: 'flinches, frightened', takesTarget: false, nominalMs: 1400 },
  raise: { summary: 'raises what it is holding', takesTarget: false, nominalMs: 1200 },
  hop: { summary: 'a small hop of relief', takesTarget: false, nominalMs: 800 },
  turn: { summary: 'turns toward someone or something', takesTarget: true, nominalMs: 700 },
  grumble: { summary: 'grumbles under its breath', takesTarget: false, nominalMs: 1500 },
  examine: { summary: 'turns an object over, puzzling at it', takesTarget: true, nominalMs: 2000 },
  reach: { summary: 'reaches for something close by', takesTarget: true, nominalMs: 800 },
  take: { summary: 'takes something it is offered', takesTarget: true, nominalMs: 800 },
  flutter: { summary: 'flutters on the spot', takesTarget: false, nominalMs: 1200 },
  seek_light: { summary: 'flies straight at the nearest light', takesTarget: true, nominalMs: 1600 },
} as const satisfies Record<string, ActingDef>;

export const ACTING_IDS = Object.keys(ACTING) as [keyof typeof ACTING, ...(keyof typeof ACTING)[]];

export const ActingId = z.enum(ACTING_IDS);
export type ActingId = z.infer<typeof ActingId>;
