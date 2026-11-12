import { Vector3, type Object3D } from '@iwsdk/core';
import type { LightMood } from '@tabletop/contracts';
import type { BookView } from '../book/book-view.ts';
import { layerRotationX } from '../book/fold.ts';
import { combineUnfold } from '../stage/book-control.ts';
import type { CaptionView } from '../book/text.ts';
import type { DimView } from '../light/dim.ts';
import { stageLook } from '../paint/card-material.ts';
import { actingPose, POSES_PER_SECOND, type ActingInput } from '../puppet/acting.ts';
import { yawToward } from '../puppet/facing.ts';
import type { PuppetView } from '../puppet/puppet.ts';
import type { SoundEngine } from '../sound/engine.ts';
import type { ShowClock } from './clock.ts';
import { beamAt, gustAt, lightOutAt, unfoldAt, type Unfold } from './cues.ts';
import type { LeavesView } from './leaves.ts';
import { voiceMsOf, type CastEntry, type ShowManifest } from './manifest.ts';
import { actionDuration, scheduleBeat, type Schedule } from './schedule.ts';
import { crossed, soundMarks, type SoundMark } from './sound-marks.ts';
import { stageAt, type Rgb, type StageState } from './state.ts';

export interface ShowViews {
  stageRoot: Object3D;
  book: BookView;
  puppets: Map<string, PuppetView>;
  heads: Map<string, string[]>;
  dim: DimView | null;
  leaves: LeavesView;
  caption: CaptionView;
  sound: SoundEngine;
}

/** Dev only: drives every character through the acting list, for the cast review. */
export type ActingOverride = (castId: string, ms: number) => { acting: ActingInput; talking: boolean };

export interface ShowRuntime {
  schedule: Schedule;
  readonly started: boolean;
  /** Begins the opening. Before this the book lies closed on the table. */
  start(): void;
  /** Jumps to a moment without replaying any sound on the way. For resuming. */
  seek(ms: number): void;
  /** `hands` is how open the reader's hands have the book; the show is never more open than that. */
  frame(deltaMs: number, head: Vector3 | null, hands?: { fold: Unfold; ribbon: number }): { state: StageState; unfold: Unfold };
  setOverride(override: ActingOverride | null): void;
  /** Dev only: plays a library cue from a moment, on top of the beat (the beam review). */
  addCue(id: string, atMs: number): void;
}

const POOL_STRENGTH = 0.65;
const POOL_RADIUS_M = 0.085;
const CAPTION_FADE_MS = 250;
const YAW_EASE = 0.35;
const closed = (cards: number): Unfold => ({ dim: 0, cover: 0, layers: Array.from({ length: cards }, () => 0) });

export function createShowRuntime(manifest: ShowManifest, moods: Record<LightMood, Rgb>, views: ShowViews, clock: ShowClock): ShowRuntime {
  const cueMs = Object.fromEntries(manifest.cues.map((cue) => [cue.id, cue.nominalMs]));
  const kinds = new Map(manifest.cues.map((cue) => [cue.id, cue.kind]));
  const schedule = scheduleBeat(manifest.opening, actionDuration({ cueMs, voiceMs: voiceMsOf(manifest) }));
  const cards = views.book.cards.length;
  const marks: SoundMark[] = soundMarks(schedule, kinds, cards);
  const entries = new Map<string, CastEntry>(manifest.cast.map((entry) => [entry.member.id, entry]));
  const cueOf = (state: StageState, kind: string) => {
    for (const [id, cue] of state.cues) if (kinds.get(id) === kind) return cue;
    return null;
  };

  let started = false;
  let lastMs = 0;
  let override: ActingOverride | null = null;
  const extraCues: Array<{ id: string; atMs: number }> = [];
  const lamp = new Vector3();
  const yaws = new Map<string, { value: number; step: number }>();
  const scratch = new Vector3();
  const bookCentre = new Vector3();
  const worldScale = new Vector3();

  return {
    schedule,
    get started() {
      return started;
    },
    start() {
      started = true;
      views.sound.roomTone(true);
    },
    addCue(id, atMs) {
      extraCues.push({ id, atMs });
    },
    setOverride(next) {
      override = next;
    },
    seek(ms) {
      clock.seek(ms);
      lastMs = ms;
      started = true;
    },
    frame(deltaMs, head, hands) {
      if (started) clock.advance(deltaMs);
      const ms = started ? clock.ms : -1;
      const state = stageAt(schedule, ms, moods);
      for (const extra of extraCues) if (ms >= extra.atMs) state.cues.set(extra.id, { localMs: ms - extra.atMs, target: null });
      const openCue = cueOf(state, 'unfold');
      const showUnfold = openCue ? unfoldAt(openCue.localMs, cards) : closed(cards);
      const combined = hands ? combineUnfold(showUnfold, hands.fold) : showUnfold;
      // While the ribbon holds the show, the house lights come partway up, so a pause is never silent.
      const unfold = hands ? { ...combined, dim: combined.dim * (1 - 0.45 * hands.ribbon) } : combined;
      const gustCue = cueOf(state, 'gust');
      const gust = gustCue ? gustAt(gustCue.localMs) : null;
      const seconds = Math.max(0, ms) / 1000;

      views.book.update(unfold, gust?.strength ?? 0, seconds);
      views.book.setRibbon(hands?.ribbon ?? 0);
      stageLook.tint.value.setRGB(...state.moodRgb);
      views.stageRoot.getWorldScale(worldScale);

      // A light that went out stays out. Its smoke rises once.
      const outs = new Map<string, number>();
      for (const [id, cue] of state.cues) {
        if (kinds.get(id) !== 'light-out' || !cue.target?.startsWith('cast:')) continue;
        outs.set(cue.target.slice(5), lightOutAt(cue.localMs).smoke);
      }

      let pool = 0;
      let index = 0;
      for (const [id, puppet] of views.puppets) {
        const entry = entries.get(id)!;
        const forced = override?.(id, Math.max(0, ms)) ?? null;
        const acting = forced?.acting ?? state.acting.get(id) ?? null;
        const stand = views.book.standOf(id);
        const out = outs.has(id);
        const gustHere = gust && gustCue?.target === `cast:${id}` ? gust.strength : 0;
        const pose = actingPose(entry.member, acting ?? { acting: null, localMs: 0, target: null }, Math.max(0, ms), {
          gust: gustHere,
          seed: index++,
          heads: views.heads.get(id) ?? [],
          talking: forced?.talking ?? false,
        });
        if (entry.light) puppet.setVariant(entry.light.part, out ? entry.light.outVariant : 'base');
        puppet.apply(pose, { stand, glow: out || !entry.light ? 0 : 1, smoke: outs.get(id) ?? 0 });
        puppet.fold.rotation.x = layerRotationX(stand);

        // Turn toward you at twelve poses a second, easing, and only as far as the pose allows.
        const yaw = yaws.get(id) ?? { value: 0, step: -1 };
        const step = Math.floor((Math.max(0, ms) / 1000) * POSES_PER_SECOND);
        if (head && step !== yaw.step) {
          scratch.copy(head);
          puppet.root.worldToLocal(scratch);
          const target = yawToward(scratch.x, scratch.z, pose.yawLimitDeg) * Math.max(0, Math.min(1, stand));
          yaw.value += (target - yaw.value) * YAW_EASE;
          yaw.step = step;
        }
        yaws.set(id, yaw);
        puppet.yaw.rotation.y = yaw.value;

        if (entry.light && !out && stand > 0.5 && puppet.lightWorldPosition(stageLook.poolPos.value)) {
          pool = POOL_STRENGTH * Math.min(1, (stand - 0.5) * 2) * pose.glow;
        }
      }
      stageLook.poolStrength.value = pool;
      stageLook.poolRadius.value = POOL_RADIUS_M * worldScale.x;

      const beamCue = cueOf(state, 'beam');
      const beam = beamCue ? beamAt(beamCue.localMs) : null;
      views.book.setBeam(beam?.azimuth ?? 0, beam?.strength ?? 0);
      if (views.dim && head) {
        views.book.root.getWorldPosition(bookCentre);
        const lampAt = beam ? views.book.lampWorld(lamp) : null;
        views.dim.update(head, bookCentre, 0.42 * worldScale.x, unfold.dim, beam && lampAt ? { lamp: lampAt, azimuth: beam.azimuth + views.stageRoot.rotation.y, strength: beam.strength } : null);
      }
      views.leaves.update(gust, views.book.pageY, 0.21);

      const caption = state.caption;
      if (caption) {
        const fade = Math.min(1, caption.localMs / CAPTION_FADE_MS, (caption.durationMs - caption.localMs) / CAPTION_FADE_MS + 0.0001);
        views.caption.show(caption.text, Math.max(0, fade));
      } else {
        views.caption.show(null, 0);
      }

      if (started) {
        for (const mark of crossed(marks, lastMs, ms)) {
          const source = mark.from ? views.puppets.get(mark.from)?.root : views.book.root;
          views.sound.play(mark.sound, mark.sound === 'narration' ? undefined : source?.getWorldPosition(new Vector3()), mark.text);
        }
        lastMs = ms;
      }
      return { state, unfold };
    },
  };
}
