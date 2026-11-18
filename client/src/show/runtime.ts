import { Mesh, Vector3, type Object3D, type Sprite } from '@iwsdk/core';
import { NARRATOR, type ActingId, type LightMood, type ObjectDef, type Spine } from '@tabletop/contracts';
import type { BookView } from '../book/book-view.ts';
import type { DrawerView } from '../book/drawer-view.ts';
import type { SatchelView } from '../book/satchel-view.ts';
import { layerRotationX } from '../book/fold.ts';
import type { CaptionView } from '../book/text.ts';
import { chunkAt } from '../book/caption-fit.ts';
import { answerTags, cued, cueStrength, deviceStore, noteHandover, readHandovers } from '../objects/hand-over-cue.ts';
import type { DimView } from '../light/dim.ts';
import type { HandSide, ObjectsView, Receiver, V3 } from '../objects/objects.ts';
import { stageLook } from '../paint/card-material.ts';
import { actingPose, POSES_PER_SECOND, type ActingInput } from '../puppet/acting.ts';
import { yawToward } from '../puppet/facing.ts';
import type { PuppetView } from '../puppet/puppet.ts';
import type { SoundEngine, Speech } from '../sound/engine.ts';
import { combineUnfold } from '../stage/book-control.ts';
import { castAt, type CastPlace } from './cast-state.ts';
import { frontSpot } from '../storyteller/steady.ts';
import type { ShowClock } from './clock.ts';
import { beamAt, gustAt, lightOutAt, unfoldAt, type Unfold } from './cues.ts';
import { beamReach } from '../light/beam-reach.ts';
import { HUNT_FADE_MS, HUNT_RETURN_MS, HUNT_REVEAL_MS, huntAt, huntPlace } from '../room-fx/hunt.ts';
import type { RoomMap } from '../room-fx/room-map.ts';
import { roomAt, type RoomNow } from '../room-fx/state.ts';
import type { LeavesView } from './leaves.ts';
import { markOf, voiceMsOf, type CastEntry, type CueKind, type ShowManifest } from './manifest.ts';
import { actionDuration } from './schedule.ts';
import { createScheduler, type GiftOutcome, type Scheduler, type SchedulerEvent, type SchedulerSnapshot } from './scheduler.ts';
import { soundMarks, type SoundMark } from './sound-marks.ts';
import { stageAt, type Rgb, type StageState } from './state.ts';

export interface ShowViews {
  stageRoot: Object3D;
  book: BookView;
  /** Every character, each standing on its own mount in the book's actors' layer. */
  puppets: Map<string, PuppetView>;
  actors: Map<string, Object3D>;
  heads: Map<string, string[]>;
  dim: DimView | null;
  leaves: LeavesView;
  caption: CaptionView;
  /** The end of the chapter, printed on the caption band, and its "Read it again". */
  endPage: { show(on: boolean, opacity: number): void; readAgain: Object3D };
  sound: SoundEngine;
  objects: ObjectsView;
  drawer: DrawerView;
  satchel: SatchelView;
  spark: Sprite;
  spans: Map<string, Mesh>;
  /** The reader's real room, for room effects. Null where there's none to act on. */
  room: RoomMap | null;
}

/** Dev only: drives every character through the acting list, for the cast review. */
export type ActingOverride = (castId: string, ms: number) => { acting: ActingInput; talking: boolean };

export interface RuntimeSnapshot {
  v: 2;
  scheduler: SchedulerSnapshot;
  objects: ReturnType<ObjectsView['snapshot']>;
  overlays: Overlay[];
  drawerWanted: boolean;
  satchelOpen: boolean;
}

interface Overlay {
  who: string;
  kind: 'aside' | 'repeat';
  objectId: string;
  startMs: number;
}

export interface GiftResult {
  outcome: GiftOutcome;
  events: SchedulerEvent[];
}

/** What the runtime reports each frame: the scheduler's events, plus the reader's own doings. */
export type RuntimeEvent =
  | SchedulerEvent
  | { type: 'gift'; objectId: string; castId: string; outcome: GiftOutcome; atMs: number }
  | { type: 'cast.held' | 'cast.dropped'; castId: string; atMs: number };

export interface ShowRuntime {
  scheduler: Scheduler;
  readonly started: boolean;
  readonly ended: boolean;
  /** When the end-of-chapter page printed, or null. */
  readonly endedAtMs: number | null;
  start(): void;
  /** Back to the very start of the episode, as if the book had just been opened. */
  reset(objects: RuntimeSnapshot['objects'], keepScheduler?: boolean): void;
  /** A quiet line printed on the caption band when nobody is speaking (the Storyteller's "… is listening"). Null clears it. */
  setHint(text: string | null): void;
  /** The Storyteller's free spot on the page's floor for a thing to land, in front of the cast (`steady.ts`). */
  frontSpot(exceptId?: string): V3;
  /** Plays a different show on the same stage: the AI Storyteller's live scheduler and its growing spine. */
  useScheduler(scheduler: Scheduler, spine: Spine, objects: RuntimeSnapshot['objects']): void;
  /** Rebuilds from a checkpoint, at its show time, without replaying any sound. */
  restore(snapshot: RuntimeSnapshot, ms: number): void;
  snapshot(): RuntimeSnapshot;
  frame(deltaMs: number, nowMs: number, head: Vector3 | null, hands: { fold: Unfold; ribbon: number }, handPoints: Record<HandSide, Vector3 | null>): { state: StageState; unfold: Unfold; room: RoomNow };
  setOverride(override: ActingOverride | null): void;
  addCue(id: string, atMs: number): void;
  /** Review builds: forget the room effects added with `addRoom`. */
  clearReviewRoom(): void;
  /** Review builds: a room effect at a show time, outside the story's timeline. */
  addRoom(action: Extract<import('@tabletop/contracts').StageAction, { do: 'room' }>, atMs: number): void;
  /** The reader let go of an object near a character. */
  gift(objectId: string, castId: string): GiftResult | null;
  /** Can this character take something now? */
  canReceive(castId: string): boolean;
  /** The reader pulled the drawer, or pushed it shut. */
  toggleDrawer(): void;
  toggleSatchel(): void;
  /** The reader turned the page early. */
  turnPage(): void;
  /** Your hand on the page's corner: the leaf follows it round the spine. Null `point` keeps the last. */
  holdPage(point: Vector3 | null): void;
  /** Let go of the page: past the tipping point it turns, short of it it falls back. */
  releasePage(cancel?: boolean): void;
  /** Is the page's edge inviting a turn? */
  readonly pageInviting: boolean;
  /** Something in hand: the show's timeouts wait (within their grace). */
  setHolding(on: boolean): void;
  /** A character picked up by the reader: the show holds still while you have them. */
  setHeld(castId: string | null): void;
  readonly drawerAmount: number;
  /** Events for the log, the director and telemetry, drained each frame. */
  drain(): RuntimeEvent[];
  /** How long each action holds, as the scheduler times it. */
  readonly durationOf: (action: import('@tabletop/contracts').StageAction) => number;
  /** The noticing character for a held object, if any. */
  notice(castId: string | null, objectId: string | null): void;
  /** Characters you could pick up now, with the top of each head in world space. */
  castTargets(): Array<{ id: string; top: Vector3 }>;
  /** Picks a character up: it follows `point` (world) while held. */
  holdCast(id: string, point: Vector3 | null): void;
  /** Lets go of whoever is held: they hop back to their place. */
  dropCast(): void;
}

const POOL_STRENGTH = 0.65;
const POOL_RADIUS_M = 0.085;
const CAPTION_FADE_MS = 250;
const YAW_EASE = 0.35;
const POP_MS = 450;
const TAKE_FLIGHT_MS = 180;
const DRAWER_MS = 1700;
const PAGE = { foldEnd: 800, leafEnd: 1800, riseEnd: 2600 };
/** A hint too long for the band shows its chunks in turn, each about this long per letter (and at least HINT_CHUNK_MIN_MS). */
const HINT_MS_PER_CHAR = 70;
const HINT_CHUNK_MIN_MS = 2800;

const closed = (cards: number): Unfold => ({ dim: 0, cover: 0, layers: Array.from({ length: cards }, () => 0) });
const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
const ease = (t: number): number => t * t * (3 - 2 * t);
/** The `t` whose ease is `y` (by halving: it's only needed once per turn). */
const unease = (y: number): number => {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (ease(mid) < y) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
};
/** How much of a hand-turned page's travel folds the pop-ups down before the leaf lifts. */
const DRAG_FOLD = 0.08;
/** Let go of a page past this and it turns; short of it, it falls back. */
const PAGE_COMMIT = 0.35;
const PAGE_FALL_MS = 380;
type PageTurn = { layers: number | null; leaf: number | null; rightNew: boolean; leftNew: boolean; stackNew: boolean; dragged: boolean };
const lerp3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

export interface RuntimeDeps {
  manifest: ShowManifest;
  spine: Spine;
  defs: Map<string, ObjectDef>;
  moods: Record<LightMood, Rgb>;
  views: ShowViews;
  clock: ShowClock;
}

/** How long a washed-up bottle waits at your feet before it floats up within reach. */
export const BOTTLE_UP_MS = 12_000;
/** A raised light's beam fades this long once it comes down. */
export const LANTERN_BEAM_FADE_MS = 700;

export function createShowRuntime({ manifest, spine: authoredSpine, defs, moods, views, clock }: RuntimeDeps): ShowRuntime {
  /** The spine showing: the authored chapter, or a live one whose spreads are added as the story visits them. */
  let spine = authoredSpine;
  const cueMs = Object.fromEntries(manifest.cues.map((cue) => [cue.id, cue.nominalMs]));
  const kinds = new Map<string, CueKind>(manifest.cues.map((cue) => [cue.id, cue.kind]));
  const cueDef = new Map(manifest.cues.map((cue) => [cue.id, cue]));
  const voiceMs = voiceMsOf(manifest);
  const durationOf = actionDuration({ cueMs, voiceMs });
  let scheduler = createScheduler(spine, durationOf);
  const cards = views.book.cards.length;
  const entries = new Map<string, CastEntry>(manifest.cast.map((entry) => [entry.member.id, entry]));
  const lightObjects = new Map<string, string>();
  for (const entry of manifest.cast) if (entry.light?.object) lightObjects.set(entry.light.object, entry.member.id);
  const setOfScene = (i: number) => spine.scenes[i]?.setId ?? spine.scenes[0]!.setId;

  let started = false;
  let lastMs = -1;
  let override: ActingOverride | null = null;
  const extraCues: Array<{ id: string; atMs: number }> = [];
  const extraRoom: Array<{ action: Extract<import('@tabletop/contracts').StageAction, { do: 'room' }>; startMs: number; key: string }> = [];
  /** The hunt's lost thing while it's out in the room, and when (wall time) it was found, for the beam's fade. */
  let huntHidden: string | null = null;
  let huntFoundAt: number | null = null;
  const huntTarget = new Vector3();
  /** Your head, as of the last frame, for things that come to you (the bottle washes up at your feet). */
  const lastHead = new Vector3(0, 1.2, 0);
  const lampProbe = new Vector3();
  const lantern = new Vector3();
  let overlays: Overlay[] = [];
  let drawerWanted = false;
  let drawerAmount = 0;
  let satchelOpen = false;
  /** How many things this reader has handed over, on this device: the ask's cue settles as it grows. */
  let handovers = readHandovers(deviceStore());
  let satchelFlap = 0;
  let holding = false;
  let heldCast: string | null = null;
  /** The page in your hand: how far round the spine you've lifted it (0 flat on the right, 1 over on the left). */
  let pageHold: { progress: number } | null = null;
  /** A page let go of too soon, falling back to where it was. */
  let pageFall: { from: number; startMs: number } | null = null;
  /** A turn you started by hand carries on from where you let go, not from the top. */
  let turnShiftMs = 0;
  /** Whether the show sound is held still because you have a character in your hand. */
  let soundHeld = false;
  let noticing: { cast: string; object: string; sinceMs: number } | null = null;
  /** A character in your hand, and where your pinch is. */
  let carried: { cast: string; point: Vector3 } | null = null;
  /** A character hopping back to its place after you let go: from where, and since when (wall time). */
  const hopping = new Map<string, { from: V3; startMs: number }>();
  let wallMs = 0;
  const HOP_MS = 650;
  let endedAtMs: number | null = null;
  let hint: string | null = null;
  /** When the hint showing now was set, so a long one starts from its first chunk. */
  let hintSinceMs = 0;
  const pending: RuntimeEvent[] = [];
  const speeches: Array<{ speech: Speech; atMs: number; text: string; endMs: number }> = [];
  let marks: SoundMark[] = [];
  /** Effects and sounds already applied, by key. Anything at or before a restored moment counts as done. */
  const applied = new Set<string>();
  const playedMarks = new Set<string>();
  let lastPlaces = new Map<string, CastPlace>();
  let lastTurn = false;
  let marksKey = '';

  const lamp = new Vector3();
  const yaws = new Map<string, { value: number; step: number }>();
  const scratch = new Vector3();
  const bookCentre = new Vector3();
  const worldScale = new Vector3();
  const sparkFrom = new Vector3();
  const sparkTo = new Vector3();

  const cueOf = (state: StageState, kind: CueKind) => {
    let best: { localMs: number; target: string | null } | null = null;
    for (const [id, cue] of state.cues) if (kinds.get(id) === kind && (!best || cue.localMs < best.localMs)) best = cue;
    return best;
  };
  const objectOf = (target: string | null) => (target?.startsWith('object:') ? target.slice(7) : null);
  const castOfTarget = (target: string | null) => (target?.startsWith('cast:') ? target.slice(5) : null);

  /** Where a character stands, in the book's frame: its mount plus the page. */
  const footOf = (id: string): V3 => {
    const a = views.actors.get(id)!;
    return [a.position.x, 0, a.position.z];
  };

  const receivers = (): Map<string, Receiver> => {
    const out = new Map<string, Receiver>();
    for (const [id, puppet] of views.puppets) {
      if (!puppet.grip) continue;
      puppet.body.userData.heightM = entries.get(id)!.member.heightM;
      out.set(id, { id, grip: puppet.grip, body: puppet.body });
    }
    return out;
  };

  /** A keeper's light set up high by light-up (on the page, above it), while its keeper's light is lit. */
  function raisedLit(objectId: string, cast: string, state: { lights: Map<string, { lit: boolean }> }): boolean {
    const home = views.objects.get(objectId)?.home;
    return home?.kind === 'page' && home.at[1] > 0.01 && (state.lights.get(cast)?.lit ?? true);
  }

  /** The once-only effects of an action starting: things moving between homes. */
  function applyStart(item: { action: import('@tabletop/contracts').StageAction; startMs: number }, nowMs: number): void {
    const a = item.action;
    if (a.do === 'cue') {
      const kind = kinds.get(a.cue);
      const def = cueDef.get(a.cue);
      if (kind === 'drop-held') {
        const who = castOfTarget(a.target);
        const objectId = [...lightObjects].find(([, c]) => c === who)?.[0];
        const at = def?.at ? markOf(manifest, setOfScene(scheduler.scene()), def.at) : null;
        if (objectId && at && who) {
          // It leaves the paw where the paw is, and tumbles to its rest.
          const from = views.puppets.get(who)?.lightWorldPosition(new Vector3()) ?? undefined;
          views.objects.send(objectId, { kind: 'page', at }, nowMs, 1300, 0.03, from);
        }
      } else if (kind === 'relight') {
        const who = castOfTarget(a.target);
        const objectId = [...lightObjects].find(([, c]) => c === who)?.[0];
        if (objectId && who) views.objects.send(objectId, { kind: 'carried', cast: who }, nowMs, 0);
      } else if (kind === 'light-up') {
        // The keeper's light rises to the set's light-high mark. A thing that flies holds it from above;
        // anything else (a ladder) stands under it. A flier who carries it is walked up there by the beat itself.
        const hi = markOf(manifest, setOfScene(scheduler.scene()), 'light-high');
        const entry = [...lightObjects].find(([id]) => views.objects.get(id)?.home.kind === 'carried');
        if (hi && entry) {
          const [lightId, keeper] = entry;
          const from = views.puppets.get(keeper)?.lightWorldPosition(new Vector3()) ?? undefined;
          views.objects.send(lightId, { kind: 'page', at: [hi[0], hi[1], hi[2]] }, nowMs, 1500, 0.03, from);
          const id = objectOf(a.target);
          if (id && views.objects.get(id)) {
            const flies = defs.get(id)?.tags.includes('flies') ?? false;
            views.objects.send(id, { kind: 'page', at: flies ? [hi[0] + 0.006, hi[1] + 0.04, hi[2] - 0.004] : [hi[0], 0, hi[2] - 0.004] }, nowMs, 1500, flies ? 0.05 : 0.02);
          }
        }
      } else if (kind === 'light-down') {
        const hi = markOf(manifest, setOfScene(scheduler.scene()), 'light-high');
        for (const [lightId, keeper] of lightObjects) {
          const s = views.objects.get(lightId);
          if (s?.home.kind !== 'page' || !hi || Math.hypot(s.home.at[0] - hi[0], s.home.at[2] - hi[2]) > 0.001) continue;
          views.objects.send(lightId, { kind: 'carried', cast: keeper }, nowMs, 900, 0.02);
          // Whatever held it up comes down to the keeper's feet, still given (kept at the end).
          const [x, , z] = footOf(keeper);
          for (const o of views.objects.states()) {
            if (o.id === lightId || o.home.kind !== 'page' || Math.hypot(o.home.at[0] - hi[0], o.home.at[2] - hi[2]) > 0.012) continue;
            views.objects.send(o.id, { kind: 'page', at: [x + 0.035, 0, Math.min(z + 0.02, views.book.frontHingeZ - 0.006)] }, nowMs, 900, 0.03);
          }
        }
      } else if (kind === 'set-down') {
        const id = objectOf(a.target);
        const holder = id ? [...views.puppets.keys()].find((c) => { const s = views.objects.get(id)?.home; return s?.kind === 'paw' && s.cast === c; }) : null;
        if (id && holder) {
          const [x, , z] = footOf(holder);
          views.objects.send(id, { kind: 'page', at: [x + 0.03, 0, Math.min(z + 0.022, views.book.frontHingeZ - 0.006)] }, nowMs, 450, 0.02);
        }
      } else if (kind === 'wear') {
        const id = objectOf(a.target);
        const s = id ? views.objects.get(id)?.home : null;
        if (id && s?.kind === 'paw') views.objects.send(id, { kind: 'worn', cast: s.cast }, nowMs, 400, 0.01);
      } else if (kind === 'pocket') {
        const id = objectOf(a.target);
        const s = id ? views.objects.get(id)?.home : null;
        if (id && s?.kind === 'paw') views.objects.send(id, { kind: 'pocket', cast: s.cast }, nowMs, 0);
      } else if (kind === 'keep') {
        satchelOpen = true;
        for (const s of views.objects.states()) {
          // Something tucked in a character's coat was theirs to use up in the story: it stays with them.
          if (!s.given || lightObjects.has(s.id) || s.home.kind === 'satchel' || s.home.kind === 'pocket') continue;
          views.objects.send(s.id, { kind: 'satchel' }, nowMs, 1300, 0.09);
        }
      } else if (kind === 'chapter-end') {
        endedAtMs = item.startMs;
      } else if (kind && kind.startsWith('cross-')) {
        const id = objectOf(a.target);
        if (id) views.objects.send(id, { kind: 'posed' }, nowMs, 0);
      }
    } else if (a.do === 'use') {
      const id = a.object;
      if (lightObjects.get(id) === a.who) views.objects.send(id, { kind: 'carried', cast: a.who }, nowMs, 600, 0.03);
      else views.objects.send(id, { kind: 'paw', cast: a.who }, nowMs, 600, 0.03);
    } else if (a.do === 'give') {
      // One paw to another: it flies across, as a hand-over does.
      if (views.objects.get(a.object)) views.objects.send(a.object, { kind: 'paw', cast: a.to }, nowMs, 500, 0.03);
    } else if (a.do === 'place' && a.what.startsWith('object:')) {
      const at = markOf(manifest, setOfScene(scheduler.scene()), a.at);
      const id = a.what.slice(7);
      // A find the set lays out is the page's own copy: if you carried yours in from an earlier chapter, it stays in your satchel.
      const setFind = spine.scenes[scheduler.scene()]?.objects.some((o) => o.id === id && o.origin === 'set') ?? false;
      // The Storyteller's things land on the floor in front of the cast, at a free spot, never at a
      // mark meant for a character or up by the railing (owner, live test; `steady.ts`). Chapters keep their marks.
      const spot = spine.source === 'generated' ? (at ? frontSpotFor(id) : null) : at;
      if (spot && !(setFind && views.objects.get(id)?.home.kind === 'satchel')) views.objects.send(id, { kind: 'page', at: spot }, nowMs, 400, 0.02);
    } else if (a.do === 'room' && a.effect === 'bottle') {
      // It washes up at your feet: just in front of you, toward the book, sliding in from further out.
      const id = objectOf(a.what);
      if (id && views.objects.get(id) && views.room) {
        const book = views.book.root.getWorldPosition(new Vector3());
        const toward = book.clone().sub(lastHead).setY(0);
        if (toward.lengthSq() < 1e-4) toward.set(0, 0, -1);
        toward.normalize();
        const side = new Vector3(-toward.z, 0, toward.x);
        // By your feet, to one side: not under the table the book stands on.
        const spot = lastHead.clone().addScaledVector(toward, 0.3).addScaledVector(side, 0.35);
        spot.y = views.room.floorY() + 0.05;
        const place = views.room.below(spot);
        if (place) {
          const from = spot.clone().addScaledVector(toward, 1.6).addScaledVector(side, 0.6).setY(views.room.floorY() + 0.03);
          views.objects.setVisible(id, true);
          // Washed up for you: yours to pick up and hand over, like anything on the page.
          const state = views.objects.get(id);
          if (state) state.grabbable = true;
          views.sound.play('wash', spot);
          views.objects.send(id, { kind: 'room', place: place.id, offset: [spot.x - place.centre.x, spot.z - place.centre.z] }, nowMs, 3200, 0.04, from);
        }
      }
    } else if (a.do === 'room' && a.effect === 'hunt') {
      // The lost thing slips off to a place in your room, unseen until the beam finds it: in front of
      // you, toward the book, never behind you or on the seat you're in (huntPlace).
      const id = objectOf(a.what);
      const spot = views.room ? huntPlace(views.room, a.at, lastHead, views.book.root.getWorldPosition(new Vector3())) : null;
      if (id && spot && views.objects.get(id)) {
        views.objects.setVisible(id, false);
        views.objects.send(id, { kind: 'room', place: spot.place.id, offset: spot.offset }, nowMs, 0);
      }
    }
  }

  /** A free spot on the page's floor, in front of the cast, for the Storyteller's things. */
  function frontSpotFor(exceptId?: string): V3 {
    const things = views.objects.states().flatMap((o) => (o.id !== exceptId && o.home.kind === 'page' ? [o.home.at as V3] : []));
    return frontSpot(things, [...lastPlaces.values()].map((p) => p.at));
  }

  function handleEvents(events: SchedulerEvent[]): void {
    for (const e of events) {
      if (e.type === 'problem.opened' && e.opensDrawer) {
        drawerWanted = true;
        // Your finds are help too: the satchel opens with the drawer when there's something in it.
        if (views.objects.states().some((s) => s.home.kind === 'satchel')) satchelOpen = true;
      }
      if ((e.type === 'problem.ignored' || e.type === 'episode.ended') && drawerWanted) drawerWanted = false;
      pending.push(e);
    }
  }

  /** The page turn: fold down, the leaf passes, rise again. Null when no turn is playing. */
  function pageTurnAt(state: StageState): PageTurn | null {
    const cue = cueOf(state, 'page-turn');
    if (!cue) turnShiftMs = 0;
    if (!cue || cue.localMs + turnShiftMs > PAGE.riseEnd) return null;
    const t = cue.localMs + turnShiftMs;
    const fold = t < PAGE.foldEnd ? 1 - ease(t / PAGE.foldEnd) : t < PAGE.leafEnd ? 0 : null;
    const leaf = t >= PAGE.foldEnd && t < PAGE.leafEnd ? ease((t - PAGE.foldEnd) / (PAGE.leafEnd - PAGE.foldEnd)) : null;
    return { layers: fold, leaf, rightNew: t >= PAGE.foldEnd, leftNew: t >= PAGE.leafEnd, stackNew: t >= PAGE.leafEnd, dragged: false };
  }

  /** The page while your hand has it (or as it falls back): the first bit of the lift folds the pop-ups flat, then the leaf follows. */
  function draggedTurn(nowMs: number): PageTurn | null {
    let p: number | null = pageHold?.progress ?? null;
    if (p === null && pageFall) {
      const k = clamp01((nowMs - pageFall.startMs) / PAGE_FALL_MS);
      p = pageFall.from * (1 - ease(k));
      if (k >= 1) pageFall = null;
    }
    if (p === null || p <= 0) return null;
    const leaf = p < DRAG_FOLD ? null : (p - DRAG_FOLD) / (1 - DRAG_FOLD);
    return { layers: p < DRAG_FOLD ? 1 - p / DRAG_FOLD : 0, leaf, rightNew: p >= DRAG_FOLD, leftNew: false, stackNew: false, dragged: true };
  }

  /** Where each crossing puts the traveller and its gift, from the cue's progress. */
  function crossingPose(id: string, place: CastPlace, state: StageState): { at: V3; lift: number; tilt: number } {
    const c = place.crossing!;
    const t = c.progress;
    const kind = c.kind as CueKind;
    const objectId = (() => {
      for (const [cue, s] of state.cues) if (kinds.get(cue) === kind) return objectOf(s.target);
      return null;
    })();
    const from = c.from;
    const to = c.to;
    const mid: V3 = [(from[0] + to[0]) / 2, 0, from[2]];
    const pageY = views.book.pageY;
    if (kind === 'cross-kite') {
      const p = ease(clamp01((t - 0.15) / 0.75));
      const at = lerp3(from, to, p);
      const lift = 0.075 * Math.sin(Math.PI * p) + (t < 0.15 ? 0.01 * (t / 0.15) : 0);
      if (objectId) views.objects.pose(objectId, [at[0] + 0.01, pageY + lift + 0.15, at[2] - 0.004], 0.25 * Math.sin(c.localMs / 260), false, 1);
      return { at, lift, tilt: 0.12 * Math.sin(c.localMs / 300) };
    }
    if (kind === 'cross-ladder') {
      // Laid across first, then crawled over.
      const lay = ease(clamp01(t / 0.25));
      if (objectId) {
        const start: V3 = [from[0] - 0.01, pageY + 0.06, from[2] + 0.004];
        const end: V3 = [mid[0], pageY + 0.004, from[2] + 0.004];
        views.objects.pose(objectId, lerp3(start, end, lay), (Math.PI / 2) * lay, lay > 0.6, 1);
      }
      const p = ease(clamp01((t - 0.3) / 0.7));
      return { at: lerp3(from, to, p), lift: p > 0 && p < 1 ? 0.006 + 0.003 * Math.abs(Math.sin(c.localMs / 160)) : 0, tilt: 0 };
    }
    if (kind === 'cross-thread' || kind === 'cross-rope') {
      const span = views.spans.get(kind === 'cross-thread' ? 'thread-span' : 'rope-span');
      const reach = ease(clamp01(t / 0.42));
      if (span) {
        const len = Math.abs(to[0] - from[0]) + 0.04;
        const startX = kind === 'cross-thread' ? from[0] + 0.02 : to[0] - 0.02;
        const dir = kind === 'cross-thread' ? -1 : 1;
        span.visible = true;
        span.scale.set(len * reach, 1, 1);
        span.position.set(startX + (dir * len * reach) / 2, pageY + 0.004, from[2] + 0.003);
      }
      if (objectId && kind === 'cross-thread') views.objects.pose(objectId, [from[0] + 0.022, pageY, from[2] + 0.012], 0, false, 1);
      const p = ease(clamp01((t - 0.45) / 0.55));
      return { at: lerp3(from, to, p), lift: p > 0 && p < 1 ? 0.004 : 0, tilt: p > 0 && p < 1 ? 0.09 * Math.sin(c.localMs / 210) : 0 };
    }
    void id;
    return { at: place.at, lift: 0, tilt: 0 };
  }

  const runtime: ShowRuntime = {
    get scheduler() {
      return scheduler;
    },
    get started() {
      return started;
    },
    get ended() {
      return endedAtMs !== null;
    },
    get endedAtMs() {
      return endedAtMs;
    },
    get drawerAmount() {
      return drawerAmount;
    },
    durationOf,
    get pageInviting() {
      const e = scheduler.current();
      return scheduler.beat(e.beatId).actions.some((a) => a.do === 'cue' && kinds.get(a.cue) === 'page-invite') && clock.ms >= e.startMs + 400;
    },
    start() {
      started = true;
      views.sound.roomTone(true);
    },
    frontSpot: (exceptId) => frontSpotFor(exceptId),
    setHint(text) {
      if (text !== hint) hintSinceMs = -1;
      hint = text;
    },
    useScheduler(next, nextSpine, initialObjects) {
      spine = nextSpine;
      scheduler = next;
      runtime.reset(initialObjects, true);
    },
    reset(initialObjects, keepScheduler = false) {
      if (!keepScheduler) {
        spine = authoredSpine;
        scheduler = createScheduler(spine, durationOf);
      }
      views.objects.restore(initialObjects);
      overlays = [];
      drawerWanted = false;
      drawerAmount = 0;
      satchelOpen = false;
      endedAtMs = null;
      noticing = null;
      pageHold = null;
      pageFall = null;
      turnShiftMs = 0;
      for (const s of speeches) s.speech.stop(100);
      speeches.length = 0;
      marksKey = '';
      applied.clear();
      playedMarks.clear();
      clock.seek(0);
      lastMs = -1;
    },
    restore(snapshot, ms) {
      scheduler = createScheduler(spine, durationOf, snapshot.scheduler);
      views.objects.restore(snapshot.objects);
      overlays = snapshot.overlays;
      drawerWanted = snapshot.drawerWanted;
      drawerAmount = drawerWanted ? 1 : 0;
      satchelOpen = snapshot.satchelOpen;
      clock.seek(ms);
      pageHold = null;
      pageFall = null;
      turnShiftMs = 0;
      lastMs = ms;
      started = true;
      // Nothing that already happened happens again: its effects are in the snapshot, and its sounds are over.
      applied.clear();
      playedMarks.clear();
      const items = scheduler.timeline();
      for (const item of items) if (item.startMs <= ms) applied.add(item.key ?? String(item.index));
      for (const mark of soundMarks({ items }, kinds, cards)) if (mark.atMs <= ms) playedMarks.add(mark.key);
      // A finished chapter's end page comes back too.
      for (const item of scheduler.timeline()) if (item.startMs <= ms && item.action.do === 'cue' && kinds.get(item.action.cue) === 'chapter-end') endedAtMs = item.startMs;
    },
    snapshot: () => ({ v: 2, scheduler: scheduler.snapshot(), objects: views.objects.snapshot(), overlays: structuredClone(overlays), drawerWanted, satchelOpen }),
    addCue(id, atMs) {
      extraCues.push({ id, atMs });
    },
    clearReviewRoom() {
      extraRoom.length = 0;
    },
    addRoom(action, atMs) {
      extraRoom.push({ action, startMs: atMs, key: `room-review-${extraRoom.length}` });
    },
    setOverride(next) {
      override = next;
    },
    setHolding(on) {
      holding = on;
    },
    setHeld(castId) {
      heldCast = castId;
    },
    notice(castId, objectId) {
      if (!castId || !objectId) noticing = null;
      else if (noticing?.cast !== castId || noticing.object !== objectId) {
        noticing = { cast: castId, object: objectId, sinceMs: clock.ms };
        views.sound.play('interested', views.puppets.get(castId)?.root.getWorldPosition(new Vector3()));
      }
    },
    drain() {
      return pending.splice(0);
    },
    castTargets() {
      if (!started) return [];
      const out: Array<{ id: string; top: Vector3 }> = [];
      if (lastTurn) return out;
      for (const [id, puppet] of views.puppets) {
        const place = lastPlaces.get(id);
        if (!place || place.crossing || place.walk || !views.actors.get(id)?.visible) continue;
        const h = entries.get(id)!.member.heightM;
        out.push({ id, top: puppet.root.localToWorld(new Vector3(0, h * 0.86, 0)) });
      }
      return out;
    },
    holdCast(id, point) {
      if (!carried || carried.cast !== id) {
        heldCast = id;
        hopping.delete(id);
        pending.push({ type: 'cast.held', castId: id, atMs: clock.ms });
        views.sound.play('gasp', views.puppets.get(id)?.root.getWorldPosition(new Vector3()), undefined, 'ui');
      }
      carried = { cast: id, point: (point ?? carried?.point ?? new Vector3()).clone() };
    },
    dropCast() {
      if (!carried) return;
      const actor = views.actors.get(carried.cast);
      if (actor) hopping.set(carried.cast, { from: [actor.position.x, actor.position.y - views.book.pageY, actor.position.z], startMs: wallMs });
      views.sound.play('hop', actor?.getWorldPosition(new Vector3()), undefined, 'ui');
      pending.push({ type: 'cast.dropped', castId: carried.cast, atMs: clock.ms });
      carried = null;
      heldCast = null;
    },
    canReceive(castId) {
      if (!started) return false;
      const puppet = views.puppets.get(castId);
      if (!puppet?.grip || !views.actors.get(castId)?.visible) return false;
      const place = lastPlaces.get(castId);
      if (!place || place.crossing || place.walk) return false;
      // Busy hands: a character already holding something you gave doesn't take another until it's set down.
      return !views.objects.states().some((s) => s.home.kind === 'paw' && s.home.cast === castId);
    },
    gift(objectId, castId) {
      if (!runtime.canReceive(castId)) return null;
      const def = defs.get(objectId);
      const ms = clock.ms;
      const { outcome, events } = scheduler.gift(ms, objectId, def?.tags ?? [], castId);
      handleEvents(events);
      handovers = noteHandover(deviceStore());
      pending.push({ type: 'gift', objectId, castId, outcome, atMs: ms });
      const light = lightObjects.get(objectId) === castId;
      const at = views.puppets.get(castId)!.root.getWorldPosition(new Vector3());
      if (light && (outcome.kind === 'rule' || outcome.kind === 'fallback')) {
        views.objects.send(objectId, { kind: 'paw', cast: castId }, ms, TAKE_FLIGHT_MS);
      } else {
        views.objects.send(objectId, { kind: 'paw', cast: castId }, ms, TAKE_FLIGHT_MS);
        const s = views.objects.get(objectId);
        if (s && !light) s.given = true;
      }
      // Solved: the Lost and Found tucks itself away while the crossing plays.
      if (outcome.kind === 'rule' && outcome.outcome === 'solved') drawerWanted = false;
      if (outcome.kind === 'aside' || outcome.kind === 'repeat') {
        overlays.push({ who: castId, kind: outcome.kind, objectId, startMs: ms });
        views.sound.play(outcome.kind === 'repeat' ? 'felt' : 'puzzled', at);
      } else views.sound.play(outcome.kind === 'rule' && outcome.outcome === 'solved' ? 'pleased' : 'puzzled', at);
      noticing = null;
      return { outcome, events };
    },
    toggleDrawer() {
      drawerWanted = !drawerWanted;
      views.sound.play('drawer', views.drawer.pull.getWorldPosition(new Vector3()), undefined, 'ui');
    },
    toggleSatchel() {
      satchelOpen = !satchelOpen;
      views.sound.play('satchel', views.satchel.root.getWorldPosition(new Vector3()), undefined, 'ui');
    },
    turnPage() {
      handleEvents(scheduler.skip(clock.ms));
    },
    holdPage(point) {
      if (!pageHold) {
        pageHold = { progress: pageFall ? pageFall.from : 0 };
        pageFall = null;
        views.sound.play('page', point ?? undefined, undefined, 'ui');
      }
      if (!point) return;
      // The leaf turns round the spine: it points at your hand.
      const local = views.book.root.worldToLocal(point.clone());
      const angle = Math.atan2(local.y - views.book.pageY, local.x);
      pageHold.progress = clamp01(angle / Math.PI);
    },
    releasePage(cancel = false) {
      if (!pageHold) return;
      const p = pageHold.progress;
      pageHold = null;
      if (cancel || p < PAGE_COMMIT) {
        pageFall = { from: p, startMs: wallMs };
        return;
      }
      // Over the top: it turns, carrying on from where your hand left the leaf.
      const leaf = p < DRAG_FOLD ? 0 : (p - DRAG_FOLD) / (1 - DRAG_FOLD);
      turnShiftMs = PAGE.foldEnd + unease(leaf) * (PAGE.leafEnd - PAGE.foldEnd);
      handleEvents(scheduler.skip(clock.ms));
    },
    frame(deltaMs, nowMs, head, hands, handPoints) {
      wallMs = nowMs;
      if (head) lastHead.copy(head);
      if (started && !heldCast && !pageHold) clock.advance(deltaMs);
      // Picked up mid-line, a character stops talking with the story, and picks up the line where it left off.
      const handsHold = heldCast !== null || pageHold !== null;
      if (handsHold !== soundHeld) {
        soundHeld = handsHold;
        if (soundHeld) views.sound.suspend();
        else if (!clock.paused) views.sound.resume();
      }
      const ms = started ? clock.ms : -1;
      if (started) handleEvents(scheduler.tick(ms, holding));
      const timeline = scheduler.timeline();
      const state = stageAt({ items: timeline }, ms, moods, { speechMs: voiceMs, cueKind: (id) => kinds.get(id) });
      for (const extra of extraCues) if (ms >= extra.atMs) state.cues.set(extra.id, { localMs: ms - extra.atMs, target: null });

      // Effects that happen once, as their action starts. A gift starts its beat at this very moment, so
      // keys, not times, decide what has already happened.
      if (started) {
        for (const item of [...timeline, ...extraRoom]) {
          const key = item.key ?? String((item as { index: number }).index);
          if (item.startMs <= ms && !applied.has(key)) {
            applied.add(key);
            applyStart(item, ms);
          }
        }
      }
      const room = roomAt([...timeline, ...extraRoom], ms);
      // Seated, the floor is out of reach: a washed-up thing still lying at your feet floats up onto the
      // table beside the book (as looking at it and pinching would bring it), so anyone can pass it up.
      if (started && room.bottle && room.bottle.sinceMs > BOTTLE_UP_MS && views.objects.get(room.bottle.what)?.home.kind === 'room') {
        views.objects.send(room.bottle.what, { kind: 'table', at: [0.26, 0, 0.1] }, nowMs, 1400, 0.25 * (views.stageRoot.scale.x || 1));
      }

      // The book: opening, the page turn, and your hands on it.
      const openCue = cueOf(state, 'unfold');
      let showUnfold = openCue ? unfoldAt(openCue.localMs, cards) : closed(cards);
      const playing = pageTurnAt(state);
      const turn = playing ?? draggedTurn(nowMs);
      const scene = scheduler.scene();
      // A turn by hand goes from this spread to the next; one that's playing, from the last spread to this one.
      const nowSet = setOfScene(playing || !turn ? scene : scene + 1);
      const prevSet = playing || !turn ? setOfScene(Math.max(0, scene - 1)) : setOfScene(scene);
      if (turn) {
        if (turn.layers !== null) showUnfold = { ...showUnfold, layers: showUnfold.layers.map(() => turn.layers!) };
        else if (turn.leaf === null) {
          const rise = unfoldAt(2500 + (cueOf(state, 'page-turn')!.localMs + turnShiftMs - PAGE.leafEnd) * 2.2, cards);
          showUnfold = { ...showUnfold, layers: rise.layers };
        } else showUnfold = { ...showUnfold, layers: showUnfold.layers.map(() => 0) };
        views.book.setSets(turn.leftNew ? nowSet : prevSet, turn.rightNew ? nowSet : prevSet);
        views.book.setStack(turn.stackNew ? nowSet : prevSet);
        views.book.setLeaf(turn.leaf, prevSet, nowSet);
      } else {
        views.book.setSets(nowSet, nowSet);
        views.book.setStack(nowSet);
        views.book.setLeaf(null, nowSet, nowSet);
      }
      const combined = combineUnfold(showUnfold, hands.fold);
      // While the ribbon holds the show, the house lights come partway up, so a pause is never silent.
      const unfold = { ...combined, dim: combined.dim * (1 - 0.45 * hands.ribbon) };
      const gustCue = cueOf(state, 'gust');
      const gust = gustCue ? gustAt(gustCue.localMs) : null;
      const seconds = Math.max(0, ms) / 1000;
      views.book.update(unfold, gust?.strength ?? 0, seconds, turn !== null);
      views.book.setRibbon(hands.ribbon);
      stageLook.tint.value.setRGB(...state.moodRgb);
      views.stageRoot.getWorldScale(worldScale);
      const bookOpen = unfold.cover > 0.98;

      // The page's edge, inviting a turn.
      const invite = cueOf(state, 'page-invite');
      const inviting = invite !== null && invite.localMs < (cueMs['page-invite'] ?? 6000) && !turn;
      const lip = inviting ? ease(clamp01((invite!.localMs - 300) / 700)) * (0.75 + 0.25 * Math.sin(nowMs / 380)) : 0;
      views.book.setCorner(lip, inviting ? 0.6 + 0.4 * Math.sin(nowMs / 380) : 0);

      lastTurn = turn !== null;
      // Who stands where on this spread.
      const sceneStart = scheduler.sceneStartMs();
      const initial = new Map<string, V3>();
      if (scene === 0) for (const { cast, mark } of manifest.onStage) {
        const at = markOf(manifest, nowSet, mark);
        if (at) initial.set(cast, at);
      }
      const places = castAt({
        timeline,
        ms,
        sceneStartMs: scene === 0 ? 0 : sceneStart,
        initial,
        mark: (id) => markOf(manifest, nowSet, id),
        crossing: (cue) => {
          const def = cueDef.get(cue);
          return def?.travels ? { kind: def.kind, to: def.travels.to, who: def.travels.who, durationMs: def.nominalMs } : null;
        },
      });
      // During a page turn the cast of the old spread folds with it; the new one pops up once the leaf has passed.
      lastPlaces = turn && !turn.stackNew ? lastPlaces : places;
      for (const span of views.spans.values()) span.visible = false;
      // A crossing that's finished leaves its line strung across the gap, and what it used settles for good:
      // the ladder lying across, the spool on the near rim, the kite laid down beside the traveller.
      for (const item of timeline) {
        if (item.startMs > ms || item.action.do !== 'cue') continue;
        const kind = kinds.get(item.action.cue);
        if (!kind?.startsWith('cross-')) continue;
        const doneKey = `${item.key}:settled`;
        if (applied.has(doneKey) || ms - item.startMs < (cueMs[item.action.cue] ?? 0)) continue;
        applied.add(doneKey);
        const id = objectOf(item.action.target);
        const near = markOf(manifest, nowSet, 'near-edge');
        const far = markOf(manifest, nowSet, cueDef.get(item.action.cue)?.travels?.to ?? 'far-side');
        if (!id || !near || !far || views.objects.get(id)?.home.kind !== 'posed') continue;
        const mid = (near[0] + far[0]) / 2;
        const home =
          kind === 'cross-ladder'
            ? { kind: 'page' as const, at: [mid, 0, near[2] + 0.004] as V3, lie: Math.PI / 2 }
            : kind === 'cross-thread'
              ? { kind: 'page' as const, at: [near[0] + 0.022, 0, near[2] + 0.012] as V3 }
              : { kind: 'page' as const, at: [far[0] + 0.035, 0, Math.min(far[2] + 0.02, views.book.frontHingeZ - 0.006)] as V3, lie: 0.4 };
        views.objects.send(id, home, ms, kind === 'cross-kite' ? 600 : 0, 0.02);
      }
      for (const item of timeline) {
        if (item.startMs < sceneStart || item.startMs > ms || item.action.do !== 'cue') continue;
        const kind = kinds.get(item.action.cue);
        const span = kind === 'cross-thread' ? views.spans.get('thread-span') : kind === 'cross-rope' ? views.spans.get('rope-span') : null;
        if (span && ms - item.startMs >= (cueMs[item.action.cue] ?? 0)) {
          const near = markOf(manifest, nowSet, 'near-edge');
          const far = markOf(manifest, nowSet, 'far-side');
          if (near && far) {
            span.visible = true;
            span.scale.set(Math.abs(near[0] - far[0]) + 0.04, 1, 1);
            span.position.set((near[0] + far[0]) / 2, views.book.pageY + 0.004, near[2] + 0.003);
          }
        }
      }

      // The carried lights: out since a light-out cue, lit again since a relight.
      let pool = 0;
      let index = 0;
      const stackStand = views.book.standOf('actors');
      for (const [id, puppet] of views.puppets) {
        const entry = entries.get(id)!;
        const actor = views.actors.get(id)!;
        const place = (turn && !turn.stackNew ? lastPlaces : places).get(id);
        const onSpread = !!place;
        actor.visible = onSpread;
        if (!place) continue;
        const crossing = place.crossing ? crossingPose(id, place, state) : null;
        let at = crossing?.at ?? place.at;
        let handLift = 0;
        if (carried?.cast === id) {
          // In your hand: it dangles from your pinch, its head just below your fingers.
          const local = views.book.root.worldToLocal(carried.point.clone());
          const h = entries.get(id)!.member.heightM;
          at = [local.x, 0, local.z];
          handLift = Math.max(0, local.y - views.book.pageY - h * 0.86);
        } else {
          const hop = hopping.get(id);
          if (hop) {
            const t = clamp01((nowMs - hop.startMs) / HOP_MS);
            const e = ease(t);
            at = [hop.from[0] + (at[0] - hop.from[0]) * e, 0, hop.from[2] + (at[2] - hop.from[2]) * e];
            handLift = Math.max(0, hop.from[1] * (1 - e)) + 0.03 * Math.sin(Math.PI * t);
            if (t >= 1) hopping.delete(id);
          }
        }
        actor.position.set(at[0], views.book.pageY + 0.0006 + handLift, at[2]);
        puppet.lift.position.y = at[1] + (crossing?.lift ?? 0);
        puppet.lift.rotation.z = crossing?.tilt ?? 0;
        const layer = at[2] > views.book.frontHingeZ ? views.book.frontLayer : views.book.actorLayer;
        if (actor.parent !== layer) layer.add(actor);
        const pop = Number.isFinite(place.since) ? ease(clamp01((ms - place.since) / POP_MS)) : 1;
        const stand = Math.min(stackStand, pop);
        // Folded flat, a character is part of the page: it hides while the leaf passes over it.
        if (turn && stand < 0.02) actor.visible = false;

        // What the character is doing: a reaction to your gift first, then noticing what you hold, then the beat.
        const forced = override?.(id, Math.max(0, ms)) ?? null;
        let acting: ActingInput | null = forced?.acting ?? null;
        const overlay = overlays.find((o) => o.who === id && ms - o.startMs < (o.kind === 'aside' ? 3000 : 1600));
        if (!acting && overlay) {
          const local = ms - overlay.startMs;
          if (overlay.kind === 'aside') acting = local < 800 ? { acting: 'take', localMs: local, target: `object:${overlay.objectId}` } : { acting: 'examine', localMs: local - 800, target: `object:${overlay.objectId}` };
          else acting = { acting: 'examine', localMs: local, target: null };
        }
        if (!acting && carried?.cast === id) acting = { acting: entry.member.acting.includes('scared') ? 'scared' : entry.member.acting.includes('flutter') ? 'flutter' : 'idle', localMs: 200, target: null };
        if (!acting && noticing?.cast === id) acting = { acting: 'reach', localMs: ms - noticing.sinceMs, target: `object:${noticing.object}` };
        if (!acting) acting = state.acting.get(id) ?? null;
        const light = entry.light;
        const lightState = state.lights.get(id);
        const lit = lightState?.lit ?? true;
        const lightObject = light?.object ? views.objects.get(light.object) : undefined;
        const carrying = !lightObject || lightObject.home.kind === 'carried';
        const gustHere = gust && gustCue?.target === `cast:${id}` ? gust.strength : 0;
        const pose = actingPose(entry.member, acting ?? { acting: null, localMs: 0, target: null }, Math.max(0, ms), {
          gust: gustHere,
          seed: index++,
          heads: views.heads.get(id) ?? [],
          talking: forced?.talking ?? state.talking.has(id),
        });
        // Walking: the legs swap at twelve poses a second and the body bobs.
        const walking = place.walk !== null || (crossing && crossing.lift > 0 && place.crossing?.kind !== 'cross-kite');
        const step = Math.floor((Math.max(0, ms) / 1000) * POSES_PER_SECOND);
        if (walking) pose.bodyPx = [pose.bodyPx[0], pose.bodyPx[1] - (step % 2 === 0 ? 6 : 0)];
        puppet.setVariant('legs', walking && step % 4 < 2 ? 'walk' : 'base');
        if (light) {
          puppet.setVariant(light.part, lit ? 'base' : light.outVariant);
          puppet.setPartVisible(light.part, carrying);
        }
        // A part that is also an object (a logbook) shows only while the object is out of play.
        if (entry.linkedPart) puppet.setPartVisible(entry.linkedPart.part, (views.objects.get(entry.linkedPart.object)?.home.kind ?? 'posed') === 'posed');
        const smoke = lightState && !lightState.lit ? lightOutAt(lightState.localMs).smoke : 0;
        const flare = lightState?.lit ? 1 + 0.8 * Math.max(0, 1 - lightState.localMs / 900) : 1;
        puppet.apply(pose, { stand, glow: lit && carrying && light ? flare : 0, smoke: carrying ? smoke : 0 });
        puppet.fold.rotation.x = layerRotationX(stand);
        const shadow = puppet.root.getObjectByName('contact-shadow');
        if (shadow) {
          // The shadow stays on the page, wider and softer the higher the character is.
          shadow.position.y = 0.0008 - at[1] - handLift;
          shadow.scale.setScalar(1 + (at[1] + handLift + (crossing?.lift ?? 0)) * 6);
        }

        // Turn toward you at twelve poses a second, easing, and only as far as the pose allows.
        const yaw = yaws.get(id) ?? { value: 0, step: -1 };
        if (head && step !== yaw.step) {
          scratch.copy(head);
          puppet.root.worldToLocal(scratch);
          const target = yawToward(scratch.x, scratch.z, pose.yawLimitDeg) * Math.max(0, Math.min(1, stand));
          yaw.value += (target - yaw.value) * YAW_EASE;
          yaw.step = step;
        }
        yaws.set(id, yaw);
        puppet.yaw.rotation.y = yaw.value;

        if (light && lit && carrying && stand > 0.5 && puppet.lightWorldPosition(stageLook.poolPos.value)) {
          pool = POOL_STRENGTH * Math.min(1, (stand - 0.5) * 2) * pose.glow;
        }
      }
      // A keeper's light held up high (light-up) stays lit as its keeper's light is: its pool goes with it.
      if (pool === 0) {
        for (const [objectId, cast] of lightObjects) {
          if (!raisedLit(objectId, cast, state)) continue;
          views.objects.worldOf(objectId, stageLook.poolPos.value);
          pool = POOL_STRENGTH;
          break;
        }
      }
      stageLook.poolStrength.value = pool;
      stageLook.poolRadius.value = POOL_RADIUS_M * worldScale.x;

      // Overlays finish: what was given aside is set down at the feet.
      for (const o of overlays) {
        const end = o.kind === 'aside' ? 2800 : 1200;
        const s = views.objects.get(o.objectId);
        if (ms - o.startMs >= end && s?.home.kind === 'paw' && s.home.cast === o.who) {
          const [x, , z] = footOf(o.who);
          views.objects.send(o.objectId, { kind: 'page', at: [x + 0.032, 0, Math.min(z + 0.022, views.book.frontHingeZ - 0.006)] }, ms, 420, 0.02);
          views.sound.play('setdown', views.puppets.get(o.who)?.root.getWorldPosition(new Vector3()));
        }
      }
      overlays = overlays.filter((o) => ms - o.startMs < 3200);

      // A page turn sweeps anything left lying on the old spread into your satchel, so nothing is lost.
      if (turn?.layers !== null && turn && !turn.dragged) {
        for (const s of views.objects.states()) if (s.home.kind === 'page' && !lightObjects.has(s.id)) {
          // What you handled comes with you in your satchel; what you never touched stays on its page.
          if (s.touched || s.given) {
            s.given = true;
            views.objects.send(s.id, { kind: 'satchel' }, ms, 900, 0.07);
          } else views.objects.send(s.id, { kind: 'away' }, ms, 0);
        }
      }

      // The drawer: out when the story asks or you pull it; always stowed before the book shuts.
      const drawerTarget = drawerWanted && bookOpen ? 1 : 0;
      const step = Math.min(1, deltaMs / DRAWER_MS);
      drawerAmount += Math.sign(drawerTarget - drawerAmount) * Math.min(step, Math.abs(drawerTarget - drawerAmount));
      views.drawer.set(drawerAmount);
      const keeping = cueOf(state, 'keep');
      const flapTarget = satchelOpen || (keeping !== null && keeping.localMs < 2200) ? 1 : 0;
      satchelFlap += (flapTarget - satchelFlap) * Math.min(1, deltaMs / 160);
      views.satchel.setFlap(satchelFlap);
      if (keeping && keeping.localMs >= 2200 && satchelOpen && endedAtMs !== null) satchelOpen = false;

      // Objects: on the page they fold away with it; in your hand a carried light wakes up as it nears its keeper.
      views.objects.setPageShown(stackStand > 0.05 && !(turn && turn.layers !== null && turn.layers < 0.05));
      for (const [objectId, cast] of lightObjects) {
        const s = views.objects.get(objectId);
        if (raisedLit(objectId, cast, state)) {
          views.objects.setGlow(objectId, 1);
          continue;
        }
        if (s?.home.kind !== 'hand') {
          views.objects.setGlow(objectId, 0);
          continue;
        }
        const grip = views.puppets.get(cast)?.grip;
        if (!grip) continue;
        const d = views.objects.worldOf(objectId, scratch).distanceTo(grip.getWorldPosition(new Vector3())) / Math.max(0.3, worldScale.x);
        views.objects.setGlow(objectId, 0.22 + 0.78 * clamp01(1 - (d - 0.05) / 0.32));
      }
      // The ask's cue: while a character waits for something, everything that answers it wears the
      // same soft gold rim (never just the "right" one), a moment after the ask, and not while you hold one.
      const asked = started && bookOpen ? scheduler.openProblem(ms) : null;
      const askedProblem = asked ? (spine.scenes[asked.scene]?.problem ?? null) : null;
      const wanted = askedProblem ? answerTags(askedProblem) : null;
      const cueNow = asked && wanted && !holding ? cueStrength(handovers) * clamp01((ms - asked.openedAtMs - 600) / 700) : 0;
      const open = { drawer: drawerAmount > 0.99, satchel: satchelOpen };
      for (const o of views.objects.states()) views.objects.setCue(o.id, asked && wanted && cued(o, defs.get(o.id), { tags: wanted, tried: asked.tried }, open) ? cueNow : 0);
      views.objects.frame(nowMs, head ?? new Vector3(), receivers(), handPoints, {
        bookOpen,
        drawerOpen: drawerAmount > 0.99,
        table: (world) => {
          const local = views.book.root.worldToLocal(world.clone());
          local.y = 0;
          return views.book.root.localToWorld(local);
        },
      });

      // The spark: from the carried light up to the lamp, then the lamp is lit.
      const sparkCue = cueOf(state, 'spark');
      views.spark.visible = false;
      if (sparkCue && sparkCue.localMs < (cueMs.spark ?? 2600)) {
        const who = castOfTarget(sparkCue.target);
        const p = views.puppets.get(who ?? '');
        if (p?.lightWorldPosition(sparkFrom) && views.book.lampWorld(sparkTo)) {
          const t = ease(clamp01(sparkCue.localMs / (cueMs.spark ?? 2600)));
          views.spark.position.copy(sparkFrom).lerp(sparkTo, t);
          views.spark.position.y += 0.06 * worldScale.x * Math.sin(Math.PI * t);
          views.spark.parent?.worldToLocal(views.spark.position);
          views.spark.visible = true;
          views.spark.scale.setScalar(0.03 * worldScale.x * (1 + 0.25 * Math.sin(nowMs / 60)));
        }
      }
      // The lamp is lit since its latest lamp-lit cue, unless a lamp-out came after; the beam fades as it dies.
      const litCue = cueOf(state, 'lamp-lit');
      const outCue = cueOf(state, 'lamp-out');
      const lampLit = litCue !== null && (outCue === null || litCue.localMs < outCue.localMs);
      views.book.setLamp(lampLit);
      const beamCue = cueOf(state, 'beam');
      let beam = beamCue ? beamAt(beamCue.localMs) : null;
      if (beam && beamCue && outCue && outCue.localMs < beamCue.localMs) beam = { ...beam, strength: beam.strength * clamp01(1 - outCue.localMs / 700) };
      views.book.root.getWorldPosition(bookCentre);
      // A set without a lighthouse lamp sends the hunt's beam from just above the book.
      const lampAt = views.book.lampWorld(lamp) ?? lamp.copy(bookCentre).add(scratch.set(0, 0.15 * worldScale.y, 0));
      let worldBeam = beam && bookOpen && views.book.lampWorld(lampProbe) ? { lamp: lampAt, azimuth: beam.azimuth + views.stageRoot.rotation.y, strength: beam.strength } : null;
      // A keeper's light held up high (light-up) is the lamp now: its beam turns round your room from where it
      // shines, as the lighthouse's does, and fades as it comes down (light-down). From the cues and the
      // light's home, so a restored place has it too.
      let beamFromLight = false;
      const upCue = cueOf(state, 'light-up');
      if (upCue && bookOpen) {
        const downCue = cueOf(state, 'light-down');
        const down = downCue && downCue.localMs < upCue.localMs ? downCue.localMs : null;
        const raised = [...lightObjects].find(([id, cast]) => raisedLit(id, cast, state));
        const held = raised ?? (down !== null && down < LANTERN_BEAM_FADE_MS ? [...lightObjects][0] : undefined);
        if (held) {
          const turning = beamAt(upCue.localMs);
          const strength = turning.strength * (down === null ? 1 : clamp01(1 - down / LANTERN_BEAM_FADE_MS));
          if (strength > 0.001) {
            worldBeam = { lamp: views.objects.worldOf(held[0], lantern), azimuth: turning.azimuth + views.stageRoot.rotation.y, strength };
            beamFromLight = true;
          }
        }
      }
      // The ray you can see leave the lamp (or the raised light) and cross the room to your wall, turning with the
      // light it casts there. M1's cone; b323be9 dropped it outside the hunt, so only the wall light turned.
      const walls = views.room?.places() ?? [];
      if (worldBeam) views.book.setBeam(worldBeam.azimuth - views.stageRoot.rotation.y, worldBeam.strength, { reachM: beamReach(worldBeam.lamp, worldBeam.azimuth, walls, head), from: beamFromLight ? worldBeam.lamp : null });
      else views.book.setBeam(0, 0);
      let spot: { at: Vector3; radiusM: number; strength: number } | null = null;

      // The treasure hunt: the beam sweeps your room and stops where the lost thing waits.
      const hunt = room.hunt;
      const hidden = hunt ? views.objects.get(hunt.what) : undefined;
      if (hunt && hidden?.home.kind === 'room') {
        huntHidden = hunt.what;
        huntFoundAt = null;
      } else if (hunt && huntHidden === hunt.what) {
        huntHidden = null;
        huntFoundAt = nowMs;
        views.objects.setVisible(hunt.what, true);
      }
      const huntFound = hidden?.home.kind === 'room' ? null : huntFoundAt !== null ? nowMs - huntFoundAt : null;
      if (hunt && hidden && views.room && (hidden.home.kind === 'room' || (huntFound !== null && huntFound < HUNT_FADE_MS))) {
        const place = hidden.home.kind === 'room' ? views.room.byId(hidden.home.place) : null;
        if (place && hidden.home.kind === 'room') huntTarget.set(place.centre.x + hidden.home.offset[0], place.centre.y, place.centre.z + hidden.home.offset[1]);
        const look = huntAt(hunt.sinceMs, Math.atan2(huntTarget.x - lampAt.x, huntTarget.z - lampAt.z), huntFound);
        if (hidden.home.kind === 'room') {
          views.objects.setVisible(hunt.what, look.revealed);
          // The lamp finds it: a small bright sound from where it waits.
          if (lastMs >= 0 && hunt.sinceMs - (ms - lastMs) < HUNT_REVEAL_MS && hunt.sinceMs >= HUNT_REVEAL_MS) views.sound.play('spark', huntTarget);
          // Nobody fetched it: it drifts back to the book along the beam.
          if (hunt.sinceMs >= HUNT_RETURN_MS) {
            views.objects.setVisible(hunt.what, true);
            views.objects.send(hunt.what, { kind: 'page', at: [0.05, 0, 0.08] }, nowMs, 2600, 0.35 * worldScale.y);
            views.sound.play('whoosh', huntTarget);
          }
        }
        views.book.setLamp(true);
        views.book.setBeam(look.azimuth - views.stageRoot.rotation.y, look.strength * (bookOpen ? 1 : 0), { reachM: beamReach(lampAt, look.azimuth, walls, head) });
        if (bookOpen) {
          worldBeam = { lamp: lampAt, azimuth: look.azimuth, strength: look.strength };
          spot = { at: huntTarget, radiusM: 0.45, strength: look.spot };
        }
      }
      if (views.dim && head) views.dim.update(head, bookCentre, 0.42 * worldScale.x, unfold.dim, worldBeam, spot);
      views.leaves.update(gust, views.book.pageY, 0.21);

      // Captions on the band, and at the end, the chapter's last words with "Read it again".
      const caption = state.caption;
      const end = endedAtMs !== null && ms >= endedAtMs;
      if (caption) {
        // A long line shows in chunks that each fit the band, in order, each for its share of the voice.
        const chunk = chunkAt(views.caption.chunks(caption.text), caption.durationMs, caption.localMs);
        const page = chunk.text;
        const pageStart = chunk.startMs;
        const pageEnd = chunk.endMs;
        const local = caption.localMs - pageStart;
        const fade = Math.min(1, local / CAPTION_FADE_MS, (pageEnd - pageStart - local) / CAPTION_FADE_MS + 0.0001);
        views.caption.show(page, Math.max(0, fade));
      } else if (inviting && invite) {
        // A first-timer's hint, printed on the page like the rest: it fades in once the edge has lifted.
        views.caption.show('Turn the page', clamp01((invite.localMs - 700) / 500) * 0.85);
      } else if (hint) {
        // A hint longer than the band holds shows its chunks in turn, round again, each fading in.
        if (hintSinceMs < 0) hintSinceMs = nowMs;
        const chunks = views.caption.chunks(hint);
        const spans = chunks.map((c) => Math.max(HINT_CHUNK_MIN_MS, c.length * HINT_MS_PER_CHAR));
        const cycle = spans.reduce((a, b) => a + b, 0);
        let t = chunks.length > 1 ? (nowMs - hintSinceMs) % cycle : 0;
        let i = 0;
        while (i < spans.length - 1 && t >= spans[i]!) t -= spans[i++]!;
        const fade = chunks.length > 1 ? clamp01(Math.min(t / CAPTION_FADE_MS, (spans[i]! - t) / CAPTION_FADE_MS)) : 1;
        views.caption.show(chunks[i] ?? hint, (0.6 + 0.15 * Math.sin(nowMs / 600)) * fade);
      }
      else views.caption.show(null, 0);
      views.endPage.show(end && !caption && bookOpen, end ? clamp01((ms - endedAtMs!) / 900) : 0);

      if (started) {
        const key = `${timeline.length}:${timeline[timeline.length - 1]?.startMs}:${timeline[timeline.length - 1]?.endMs}`;
        if (key !== marksKey) {
          marks = soundMarks({ items: timeline }, kinds, cards);
          marksKey = key;
        }
        for (const mark of marks) {
          if (mark.atMs > ms || playedMarks.has(mark.key)) continue;
          playedMarks.add(mark.key);
          const source = mark.from ? views.puppets.get(mark.from)?.root : views.book.root;
          const at = source?.getWorldPosition(new Vector3());
          if (mark.sound === 'narration' || mark.sound === 'speech') {
            const speaker = mark.sound === 'narration' ? NARRATOR : mark.from!;
            const speech = views.sound.speak(speaker, mark.text!, speaker === NARRATOR ? undefined : at);
            if (speech) speeches.push({ speech, atMs: mark.atMs, text: mark.text!, endMs: mark.endMs ?? Infinity });
            // A line with no voice yet (the director's, until live voices): a soft murmur from the speaker under the caption.
            else if (speaker !== NARRATOR) views.sound.play('interested', at);
          } else views.sound.play(mark.sound, at);
        }
        // A line cut short by your gift stops at once, so the reaction isn't talked over.
        for (const s of speeches) {
          const item = timeline.find((i) => i.startMs === s.atMs && 'text' in i.action && i.action.text === s.text);
          if (item && item.endMs < s.endMs - 1 && ms >= item.endMs) s.speech.stop(150);
        }
        for (let i = speeches.length - 1; i >= 0; i--) if (!speeches[i]!.speech.playing) speeches.splice(i, 1);
        lastMs = ms;
      }
      return { state, unfold, room };
    },
  };
  return runtime;
}

export type { ActingId };
