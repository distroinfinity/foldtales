import { DepthOccludable, DepthSensingSystem, Group, SessionMode, SRGBColorSpace, TextureLoader, Vector3, VisibilityState, World } from '@iwsdk/core';
import { wholeRef } from './paint/texref.ts';
import { roomLight, tableSpot } from './room/room.ts';
import { buildRoom, roomLook } from './room/room-view.ts';
import { REVIEW_HOOKS, reviewQuery } from './dev.ts';
import { useMaterialConfig } from './paint/card-material.ts';
import { CONTRACT_VERSION } from '@tabletop/contracts/version';
import projectOptions from 'virtual:iwsdk-project';
import { createBackendAccess, withDeadline } from './backend.ts';
import { OVER_STACK } from './book/book-view.ts';
import { preloadFonts } from './book/text.ts';
import { setLandingState, type LandingState } from './landing/landing.ts';
import { askForMicrophone } from './landing/microphone.ts';
import { buildDim } from './light/dim.ts';
import { loadStageAssets, uploadAll } from './paint/assets.ts';
import { makeSoftPieces } from './paint/soft.ts';
import { CHECKPOINT_VERSION, clearCheckpoint, readCheckpoint, writeCheckpoint, type Checkpoint } from './show/checkpoint.ts';
import { CHAPTERS, landingChoice, libraryState, readProgress, STORYTELLER_AVAILABLE, writeProgress, type EnterTarget } from './show/progress.ts';
import { RIBBON_X_SHARE } from './book/book-view.ts';
import { createObjectHands } from './objects/hands.ts';
import type { RuntimeSnapshot } from './show/runtime.ts';
import { createShowClock } from './show/clock.ts';
import { createShowLog, indexedDbLogStore } from './show/log.ts';
import { libraryOf, ShowManifest } from './show/manifest.ts';
import { BackendError, SIGN_IN_REQUIRED, estimateSpeechMs, linesOf, type ReadyBeat, type ShowObject } from '@tabletop/contracts';
import { createDirector } from './director/director.ts';
import { ChapterCanon, recordChapterEnd } from './memory/memory.ts';
import { createPauseControl } from './show/pause.ts';
import { createShowRuntime } from './show/runtime.ts';
import { createRoomMap } from './room-fx/room-map.ts';
import { effectsOn } from './room-fx/state.ts';
import { castShadows, createShadowPlay } from './room-fx/shadows.ts';
import { createFireflies } from './room-fx/fireflies.ts';
import { createWindowView, WINDOW_ART } from './room-fx/window.ts';
import { createWeather, RAIN_ART } from './room-fx/weather.ts';
import { createRoomDepth } from './room-fx/occluders.ts';
import { createNightSky, SKY_ART } from './room-fx/sky.ts';
import { createSnow, SNOW_ART } from './room-fx/snow.ts';
import { createSea, SEA_ART } from './room-fx/sea.ts';
import { createGulls, GULL_ART } from './room-fx/gulls.ts';
import { createSoundEngine } from './sound/engine.ts';
import narratorVoice from '../../art/voice/narrator.json';
import { arrivalAt, OPEN_AT_MS } from './stage/arrival.ts';
import { buildStage } from './stage/build.ts';
import { createBookControls } from './stage/controls.ts';
import { reviewOverride } from './stage/review.ts';
import { createFrameGuard } from './stage/frame-guard.ts';
import { startPlacement } from './stage/placement-runtime.ts';
import { createSessionFlow } from './stage/session-flow.ts';
import { cardFor, cardShowing, choose, ended, holdsStory, initialMenu, restarted, returned, ribbon as ribbonPinched, type MenuContext, type MenuEffect, type MenuState } from './stage/book-menu.ts';
import { chapterEnding } from './book/end-sheet.ts';
import { cancelEntry, chooseEntry, consumeEntry, pendingEntry, prepareEntry, type Entry } from './landing/entry.ts';
import { primaryLabel, readLibrary } from './landing/library.ts';
import { recordFinished, storytellerSnapshot, whereIn, type StoryEnding } from './stage/seams.ts';
import type { ExtraTarget as CardExtra } from './stage/controls.ts';
import { createLiveScheduler } from './storyteller/live.ts';
import { createStorySession, type StorySession } from './storyteller/session.ts';
import { createEars } from './storyteller/ears.ts';
import { createTalkTab } from './stage/talk.ts';
import { createKeepsakes } from './storyteller/keepsakes.ts';
import type { ExtraTarget } from './stage/controls.ts';
import { presentCast } from './director/director.ts';
import { minTextSizeM, settleOnTable } from './stage/sizing.ts';
import { warmUp } from './stage/warm-up.ts';
import { createCardView, type CardSpec } from './book/card-view.ts';
import { buildEmber, buildWash } from './stage/wash.ts';
import { createTelemetry } from './telemetry.ts';

/** Room effects this build can show. Each joins as it's built, and the storyteller hears of only these. */
const ROOM_EFFECTS_BUILT: import('@tabletop/contracts').RoomEffect[] = ['hunt', 'shadows', 'shadows-off', 'fireflies', 'fireflies-off', 'rain', 'thunder', 'clear', 'night-sky', 'stars-lantern', 'stars-kite', 'stars-fox', 'shooting-star', 'day', 'snow', 'sea', 'tide-in', 'tide-out', 'boat', 'sea-off', 'gulls', 'gulls-off', 'bottle'];

const FLUSH_EVERY_MS = 10_000;
const FRAMEBUFFER_SCALE = 1.4;
const MAX_ERROR_LENGTH = 500;
/** The book drops its last centimetre onto the wash. */
const SETTLE_DROP_M = 0.012;
const CHECKPOINT_EVERY_MS = 1000;

/** In dev, `/api` is proxied to this workspace's own backend. */
const backendAccess = createBackendAccess({
  baseUrl: import.meta.env.TT_PUBLIC_BACKEND_URL ?? '/api',
  fetch: withDeadline((input, init) => fetch(input, init)),
  storage: localStorage,
  now: () => Date.now(),
});

/** The AI Storyteller's turns stream for several seconds: the same access, with a longer deadline. */
const storyAccess = createBackendAccess({
  baseUrl: import.meta.env.TT_PUBLIC_BACKEND_URL ?? '/api',
  fetch: withDeadline((input, init) => fetch(input, init), 30_000),
  storage: localStorage,
  now: () => Date.now(),
});

const telemetry = createTelemetry(
  (batch) => backendAccess.withBackend((api) => api.sendTelemetry(batch)),
  { nowIso: () => new Date().toISOString() },
  { buildId: import.meta.env.TT_PUBLIC_BUILD_ID ?? 'dev', sessionId: crypto.randomUUID() },
);

function reportError(where: string, cause: unknown): void {
  console.error(where, cause);
  telemetry.record({ kind: 'error', where, message: String(cause).slice(0, MAX_ERROR_LENGTH) || 'unknown' });
}

const guard = createFrameGuard(reportError);

/** Which moment the show is in, for naming hitches. Set by the show's frame work. */
let momentForTelemetry = 'landing';

function reportTelemetry(world: World): void {
  addEventListener('error', (event) => reportError('window', event.message));
  addEventListener('unhandledrejection', (event) => reportError('promise', event.reason));
  setInterval(() => void telemetry.flush(), FLUSH_EVERY_MS);
  document.addEventListener('visibilitychange', () => void telemetry.flush());

  let session: XRSession | undefined;
  world.onXRFrame(
    guard('telemetry', (frame: XRFrame, delta: number) => {
      if (frame.session !== session) {
        session = frame.session;
        telemetry.record({ kind: 'session', xrMode: session.environmentBlendMode === 'opaque' ? 'vr' : 'ar', device: navigator.userAgent.slice(0, 120), passthrough: session.environmentBlendMode === 'alpha-blend' });
      }
      telemetry.frame(delta * 1000, world.renderer.info.render, momentForTelemetry);
    }),
  );
}

async function fetchManifest(): Promise<ShowManifest> {
  const response = await fetch('./show/manifest.json');
  if (!response.ok) throw new Error(`manifest answered ${response.status}`);
  return ShowManifest.parse(await response.json());
}

/** Stage one of preloading: fetch, decode and upload everything before the button is offered. */
async function prepare(world: World) {
  const manifest = await fetchManifest();
  const [assets] = await Promise.all([
    // Review builds can ask for `?art=png`, and the coverage material needs straight-alpha PNG.
    loadStageAssets(manifest, './art', world.renderer, {
      allowKtx2: reviewQuery('art') !== 'png' && reviewQuery('material') !== 'coverage',
      onProgress: (done, total) => setLandingState({ kind: 'loading', share: done / total }),
    }),
    preloadFonts(),
  ]);
  // What this chapter records when it ends, beside its episode data.
  const canonData = await fetch(`./${manifest.episode.replace(/\.json$/, '.canon.json')}`)
    .then((r) => (r.ok ? r.json() : null))
    .then((raw) => (raw ? ChapterCanon.parse(raw) : null))
    .catch(() => null);
  const storyConfig = await fetch('./show/storyteller.json')
    .then((r) => (r.ok ? (r.json() as Promise<{ firstSet: string; entrances: Record<string, Record<string, string>> }>) : null))
    .catch(() => null);
  const soft = makeSoftPieces();
  // Review builds only: `?review=cast` stands the whole cast on the open book, cycling every acting.
  const review = reviewQuery('review') === 'cast';
  const stage = buildStage(manifest, assets, soft, review);
  stage.root.visible = false;
  world.scene.add(stage.root);
  // Built before the upload, so every texture goes up with the settings its material gave it.
  const room = assets.room ? buildRoom(assets.room.spec, assets.textures, assets.room.base, soft.shadow) : null;
  if (room) {
    room.root.visible = false;
    world.scene.add(room.root);
  }
  uploadAll(world.renderer, [...[...assets.textures.values()].map((ref) => ref.texture), ...Object.values(soft)]);
  document.documentElement.dataset.art = assets.format;

  const dim = buildDim();
  world.scene.add(dim.mesh);
  // Each character's own voice settings, from the art's voice.json beside its rig.
  const voices: Record<string, { chain: typeof narratorVoice.chain; trimDb: number }> = {};
  await Promise.all(
    manifest.cast.map(async (entry) => {
      if (!entry.member.voice) return;
      try {
        const response = await fetch(`./art/${entry.member.rig}/voice.json`);
        if (response.ok) {
          const v = (await response.json()) as { chain: typeof narratorVoice.chain; trimDb: number };
          voices[entry.member.id] = { chain: v.chain, trimDb: v.trimDb };
        }
      } catch {
        // That character falls back to the narrator's chain.
      }
    }),
  );
  const sound = createSoundEngine({
    sounds: manifest.sounds,
    voiceLines: manifest.voiceLines,
    artBase: './art',
    voice: { chain: narratorVoice.chain, trimDb: narratorVoice.trimDb, roomTone: narratorVoice.roomTone },
    voices,
  });
  await sound.load();
  const clock = createShowClock();
  const defs = new Map(assets.objects.map((o) => [o.id, o]));
  // Your real room, from Space Setup, for room effects and the storyteller.
  const roomMap = createRoomMap();
  stage.objects.setRoom((place) => roomMap.byId(place)?.centre.clone() ?? null);
  // Shadow play: the cast's own cards make their shadows on your wall.
  const shadowPlay = createShadowPlay();
  world.scene.add(shadowPlay.mesh);
  for (const puppet of stage.puppets.values()) castShadows(puppet.root);
  // Fireflies: the lantern's own glow, off the page and round your hand.
  const fireflies = createFireflies();
  world.scene.add(fireflies.mesh);
  // Your window: the shore at night, with the lamp's beam turning out there.
  const windowArt = assets.textures.get(WINDOW_ART);
  const windowView = windowArt ? createWindowView(windowArt) : null;
  if (windowView) world.scene.add(windowView.mesh);
  // Weather: painted rain all round you, the room greying, and thunder on your walls.
  const weather = createWeather(assets.textures.get(RAIN_ART) ?? null);
  world.scene.add(weather.rain);
  // Your real walls and furniture, invisibly, so room effects hide behind them.
  const roomDepth = createRoomDepth();
  world.scene.add(roomDepth.root);
  // The night sky on your ceiling: paper stars, the moon, a constellation, a shooting star.
  const skyArt = { stars: assets.textures.get(SKY_ART.stars), moon: assets.textures.get(SKY_ART.moon), shooting: assets.textures.get(SKY_ART.shooting) };
  const nightSky = skyArt.stars && skyArt.moon && skyArt.shooting ? createNightSky({ stars: skyArt.stars, moon: skyArt.moon, shooting: skyArt.shooting }) : null;
  if (nightSky) for (const mesh of nightSky.meshes) world.scene.add(mesh);
  // Snow that falls and settles on your table and couch.
  const snowArt = { flakes: assets.textures.get(SNOW_ART.flakes), cover: assets.textures.get(SNOW_ART.cover) };
  const snow = snowArt.flakes && snowArt.cover ? createSnow({ flakes: snowArt.flakes, cover: snowArt.cover }) : null;
  if (snow) world.scene.add(snow.root);
  // The sea in a ring round you on the floor, its tide, and the paper boat.
  const seaWater = assets.textures.get(SEA_ART.water);
  const sea = seaWater ? createSea({ water: seaWater, boat: assets.textures.get(SEA_ART.boat) ?? null }) : null;
  if (sea) for (const mesh of sea.meshes) world.scene.add(mesh);
  // Gulls that fly in and perch on a shelf or the couch.
  const gullArt = { perched: assets.textures.get(GULL_ART.perched), up: assets.textures.get(GULL_ART.up), down: assets.textures.get(GULL_ART.down) };
  const gulls = gullArt.perched && gullArt.up && gullArt.down ? createGulls({ perched: gullArt.perched, up: gullArt.up, down: gullArt.down }) : null;
  if (gulls) for (const mesh of gulls.meshes) world.scene.add(mesh);
  const runtime = createShowRuntime({
    manifest,
    spine: assets.spine,
    defs,
    moods: assets.set.moods,
    views: { stageRoot: stage.root, book: stage.book, puppets: stage.puppets, actors: stage.actors, heads: stage.heads, dim, leaves: stage.leaves, caption: stage.caption, endPage: stage.endPage, sound, objects: stage.objects, drawer: stage.drawer, satchel: stage.satchel, spark: stage.spark, spans: stage.spans, room: roomMap },
    clock,
  });
  const initialObjects = stage.objects.snapshot();
  const wash = buildWash();
  stage.root.add(wash.root);

  const ember = buildEmber(soft.ember);
  // Over the stack, so the ember lands on the book rather than behind its cards.
  const emberLayer = new Group();
  emberLayer.renderOrder = OVER_STACK;
  emberLayer.add(ember.sprite);
  world.scene.add(emberLayer);
  const log = createShowLog(indexedDbLogStore(), { seriesId: manifest.libraryVersion, episodeId: assets.spine.id }, { nowIso: () => new Date().toISOString(), showMs: () => clock.ms });
  const pause = createPauseControl(clock, {
    suspend: () => sound.suspend(),
    resume: () => sound.resume(),
    log: (event) => {
      const [type, reason] = event.split(':');
      if (type === 'session.paused') log.append('session.paused', { reason: reason as 'ribbon' });
      else log.append('session.resumed', {});
    },
  });
  /** A size chosen by hand, or restored after a crash. */
  // Review builds: `?bookscale=0.6` starts the book at that size (the card proof checks the smallest).
  const reviewScale = Number(reviewQuery('bookscale'));
  const sizing: { userScale: number | null } = { userScale: reviewScale > 0 ? reviewScale : null };
  /** The scanned table under the book, for settling things you let go of. */
  const tableTop: { outline: Array<{ x: number; z: number }> | null } = { outline: null };
  const readAgain = { requested: false };
  /** Other things the hands can take, added by a mode (the Storyteller's "Hold to talk"). */
  const moreTargets: Array<() => ExtraTarget[]> = [];
  /** "Put the book away": the book closes, then the session ends. */
  const away = { requested: false };
  const hands = createObjectHands({
    roomBelow: (world) => {
      const place = roomMap.below(world);
      return place ? { kind: 'room', place: place.id, offset: [world.x - place.centre.x, world.z - place.centre.z] } : null;
    },
    objects: stage.objects,
    runtime,
    book: stage.book,
    drawer: stage.drawer,
    satchel: stage.satchel,
    stageRoot: stage.root,
    sound,
    grips: () => new Map([...stage.puppets].flatMap(([id, p]) => (p.grip ? [[id, p.grip] as const] : []))),
    table: () => tableTop.outline,
    onReadAgain: () => {
      readAgain.requested = true;
    },
    endPage: stage.endPage,
  });
  /** The book's menu, set up by run(): the ribbon, the card's targets, and the look-and-pinch on the card. */
  const menuHooks = {
    onRibbon: (): void => undefined,
    showing: (): boolean => false,
    cardTargets: (): CardExtra[] => [],
    pick: (_origin: Vector3, _direction: Vector3): { id: string; generation: number } | null => null,
    commit: (_choice: { id: string; generation: number }): void => undefined,
    generation: (): number => 0,
  };
  const controls = createBookControls({
    world,
    stageRoot: stage.root,
    book: stage.book,
    sound,
    pause,
    glow: soft.glow,
    cards: stage.book.cards.length,
    onMoved: () => undefined,
    // While a card stands, its choices are the only things the hands can take (with the cover and the ribbon).
    extras: () => (menuHooks.showing() ? menuHooks.cardTargets() : [...hands.targets(), ...moreTargets.flatMap((f) => f())]),
    onGazeSelect: (origin, direction) => hands.gazeSelect(origin, direction),
    onHeadSelect: (origin, direction) => hands.headSelect(origin, direction),
    onRibbon: () => menuHooks.onRibbon(),
    limited: () => menuHooks.showing(),
    cardGaze: { pick: (o, d) => menuHooks.pick(o, d), commit: (c) => menuHooks.commit(c), generation: () => menuHooks.generation() },
    // A new size keeps the printed lines at least 1° tall.
    onResized: (scale) => {
      sizing.userScale = scale;
      const head = world.camera.getWorldPosition(new Vector3());
      const at = stage.root.position;
      const size = minTextSizeM(stage.caption.baseSizeM, scale, Math.hypot(head.x - at.x, head.y - at.y, head.z - at.z) + 0.1 * scale);
      stage.caption.setSize(size);
      stage.endPage.setSize(size);
    },
  });
  if (review) runtime.setOverride(reviewOverride(manifest));

  // The director: short live beats about what you do, offered to the scheduler, which plays them only if they're ready in time.
  // Off for the authored chapter since headset session 1 (owner, Nov 14: the AI layer on a written story didn't land).
  // Review builds can still try it with `?director=on` while the new AI mode is designed.
  const originOf = new Map(assets.spine.scenes.flatMap((sc) => sc.objects.map((o) => [o.id, o.origin] as const)));
  const showObjects = (): ShowObject[] =>
    stage.objects.states().flatMap((s) => {
      const def = defs.get(s.id);
      return def && s.home.kind !== 'away' ? [{ id: s.id, def, owner: null, origin: originOf.get(s.id) ?? 'set', history: [] }] : [];
    });
  const answers: Array<{ id: number; ready: ReadyBeat | null }> = [];
  const directorOn = reviewQuery('director') === 'on';
  const director = createDirector({
    spine: assets.spine,
    library: libraryOf(manifest, assets.objects),
    onStage: manifest.onStage.map((o) => o.cast),
    durationOf: runtime.durationOf,
    objects: showObjects,
    canon: () => [],
    recent: () => log.recent(),
    send: (id, _kind, request) => {
      if (!directorOn) {
        answers.push({ id, ready: null });
        return;
      }
      const t = performance.now();
      const done = (ready: ReadyBeat | null, outcome: 'ok' | BackendError['code']) => {
        telemetry.record({ kind: 'ai_call', route: 'planBeat', ms: Math.round(performance.now() - t), outcome });
        answers.push({ id, ready });
      };
      backendAccess
        .withBackend((api) => api.planBeat(request))
        .then((ready) => done(ready, ready ? 'ok' : 'upstream_failed'))
        .catch((cause: unknown) => done(null, cause instanceof BackendError ? cause.code : 'upstream_failed'));
    },
    note: (what, detail) => console.info(`director ${what}: ${detail}`),
  });
  // Review builds only: `?cue=beam` plays the lighthouse beam once the opening has finished, for P5.
  const devCue = reviewQuery('cue');
  if (devCue && manifest.cues.some((c) => c.id === devCue)) runtime.addCue(devCue, 11_500);
  // Review builds only: `?room=shadows,fireflies` plays each room effect in turn, starting a few
  // seconds after the show does (fresh or resumed), 35 s each and 40 s apart, so they can be checked
  // in one sitting. `hunt` hides the kite on your couch; `window-wall` opens the window on a wall. Scheduled again after "Start from the beginning".
  const devRoom = (reviewQuery('room') ?? '').split(',').filter(Boolean);
  const devRoomState = { scheduled: false, lastMs: 0 };
  const scheduleDevRoom = (fromMs: number): void => {
    runtime.clearReviewRoom();
    // Each in turn, quickly (owner: don't make me wait): snow about 12 s, the rest about 16 s, a short gap between.
    const slots = devRoom.map((effect) => (effect === 'snow' ? 14_000 : effect === 'sea' ? 26_000 : 20_000));
    devRoom.forEach((effect, i) => {
      const at = Math.max(11_500, fromMs + 6_000) + slots.slice(0, i).reduce((a, b) => a + b, 0);
      if (effect === 'hunt') runtime.addRoom({ do: 'room', withPrev: false, effect: 'hunt', what: 'object:kite', at: 'room:couch' }, at);
      else if (effect === 'window-wall') {
        // The window effect on a wall, as in a room with no window.
        runtime.addRoom({ do: 'room', withPrev: false, effect: 'window', what: null, at: 'room:wall' }, at);
        runtime.addRoom({ do: 'room', withPrev: false, effect: 'window-off', what: null, at: null }, at + 16_000);
      }
      else if (effect === 'sky') {
        // The night sky: stars and the moon, the Lantern named, a shooting star, the Fox, then day.
        const step = (e: import('@tabletop/contracts').RoomEffect, ms: number) => runtime.addRoom({ do: 'room', withPrev: false, effect: e, what: null, at: null }, at + ms);
        step('night-sky', 0);
        step('stars-lantern', 4_000);
        step('shooting-star', 8_000);
        step('stars-fox', 11_000);
        step('day', 16_000);
      } else if (effect === 'gulls') {
        runtime.addRoom({ do: 'room', withPrev: false, effect: 'gulls', what: null, at: null }, at);
        runtime.addRoom({ do: 'room', withPrev: false, effect: 'gulls-off', what: null, at: null }, at + 16_000);
      } else if (effect === 'bottle') {
        // The bottle isn't in chapter 1: it joins the stage for the review, then washes up at your feet.
        const def = defs.get('bottle');
        const art = def?.art.kind === 'asset' ? assets.textures.get(def.art.path) : undefined;
        if (def && art && !stage.objects.get('bottle')) stage.objects.add(def, art, { kind: 'away' });
        runtime.addRoom({ do: 'room', withPrev: false, effect: 'bottle', what: 'object:bottle', at: null }, at);
      } else if (effect === 'sea') {
        // The sea washes in, the boat sails, the tide rises and falls, the sea goes out.
        const step = (e: import('@tabletop/contracts').RoomEffect, ms: number) => runtime.addRoom({ do: 'room', withPrev: false, effect: e, what: null, at: null }, at + ms);
        step('sea', 0);
        step('boat', 4_000);
        step('tide-in', 8_000);
        step('tide-out', 15_000);
        step('sea-off', 21_000);
      } else if (effect === 'snow') {
        // Snow, long enough to settle.
        runtime.addRoom({ do: 'room', withPrev: false, effect, what: null, at: null }, at);
        runtime.addRoom({ do: 'room', withPrev: false, effect: 'clear', what: null, at: null }, at + 12_000);
      } else if (effect === 'rain') {
        // A storm: rain, then three rolls of thunder, then it clears.
        runtime.addRoom({ do: 'room', withPrev: false, effect: 'rain', what: null, at: null }, at);
        for (const t of [4_000, 8_000, 12_000]) runtime.addRoom({ do: 'room', withPrev: false, effect: 'thunder', what: null, at: null }, at + t);
        runtime.addRoom({ do: 'room', withPrev: false, effect: 'clear', what: null, at: null }, at + 16_000);
      } else if (effect === 'shadows' || effect === 'fireflies' || effect === 'window') {
        runtime.addRoom({ do: 'room', withPrev: false, effect, what: null, at: null }, at);
        runtime.addRoom({ do: 'room', withPrev: false, effect: `${effect}-off`, what: null, at: null }, at + 16_000);
      }
    });
    devRoomState.scheduled = true;
  };
  /** Each frame: schedule once the show starts, and again whenever its clock goes back to the start. */
  const devRoomTick = (): void => {
    if (!devRoom.length || !runtime.started) return;
    if (!devRoomState.scheduled || clock.ms < devRoomState.lastMs - 1000) scheduleDevRoom(clock.ms);
    devRoomState.lastMs = clock.ms;
  };
  return { manifest, assets, stage, dim, sound, clock, runtime, roomMap, shadowPlay, fireflies, windowView, weather, roomDepth, nightSky, snow, sea, gulls, devRoomTick, wash, ember, log, pause, controls, soft, review, room, sizing, tableTop, hands, readAgain, initialObjects, director, answers, showObjects, away, canonData, defs, directorOn, storyConfig, moreTargets, menuHooks };
}

function run(world: World, show: Awaited<ReturnType<typeof prepare>>, resumeFrom: Checkpoint | null, target: EnterTarget | null = null): void {
  const { manifest, assets, stage, sound, clock, runtime, roomMap, shadowPlay, fireflies, windowView, weather, roomDepth, nightSky, snow, sea, gulls, devRoomTick, wash, ember, log, pause, controls, room, sizing, tableTop, hands, readAgain, initialObjects, director, answers, showObjects, away, canonData, defs, storyConfig, moreTargets, menuHooks } = show;
  // The AI Storyteller, when that's the door the reader chose on the landing page.
  const storyMode = target?.kind === 'storyteller' && storyConfig !== null;
  let story: StorySession | null = null;
  /** Lane D's session lifecycle (seams: suspend, resume, end, title), until their PR types it on StorySession. */
  type Lifecycle = { suspend?(): void; resume?(): void; end?(): Promise<StoryEnding>; title?(): string | null };
  const life = (s: StorySession | null): (StorySession & Lifecycle) | null => s as (StorySession & Lifecycle) | null;
  /** Put away or left XR in the Storyteller: the next time the book opens, it's a new story. */
  let storyNeedsFresh = false;
  const library = libraryOf(manifest, assets.objects);
  const onStage = manifest.onStage.map((o) => o.cast);
  /** Begins an evening: a fresh live stage and a fresh session, the book opening on the first set. */
  const startStorySession = () => {
    const cfg = storyConfig!;
    const live = createLiveScheduler({
      durationOf: runtime.durationOf,
      firstSet: cfg.firstSet,
      entrances: (setId, cast) => cast.flatMap((c) => (cfg.entrances[setId]?.[c] ? [{ cast: c, mark: cfg.entrances[setId]![c]! }] : [])),
    });
    stage.objects.removeLive();
    runtime.useScheduler(live, live.spine, initialObjects);
    sound.clearLines();
    // The last evening, if any, is over: nothing it was still writing may play into this one.
    story?.dispose();
    // Everything this session asks for belongs to the generation it was made in.
    const sessionGen = host.generation;
    suspended = false;
    const session: StorySession = createStorySession({
      withBackend: (call) => storyAccess.withBackend(call),
      stream: (request) =>
        (async function* () {
          for (let attempt = 0; attempt < 2; attempt++) {
            const events = await storyAccess.withBackend(async (api) => api.storyTurn(request)).catch(() => null);
            if (!events) {
              yield { kind: 'error' as const, code: 'upstream_failed' as const, message: 'the backend could not be reached' };
              return;
            }
            for await (const event of events) {
              // A stream reports a refused token as an event, not a throw: renew it with a plain call, then try once more.
              // A guest who must sign in is not a stale device token: that one is shown, not renewed.
              if (event.kind === 'error' && event.code === 'unauthorized' && event.message !== SIGN_IN_REQUIRED && attempt === 0) {
                await storyAccess.withBackend((api) => api.memoryRead({ seriesId: 'token-check', afterSeq: null })).catch(() => null);
                break;
              }
              yield event;
              if (event.kind === 'listen' || event.kind === 'redirect' || event.kind === 'error') return;
            }
          }
        })(),
      live,
      sound,
      library,
      // What's in your satchel is marked so; the pictures stay here (the story only needs their names).
      objects: () =>
        showObjects().map((o) => ({
          ...o,
          origin: stage.objects.get(o.id)?.home.kind === 'satchel' ? ('satchel' as const) : o.origin,
          def: o.def.art.kind === 'url' ? { ...o.def, art: { kind: 'asset' as const, path: `live/${o.def.id}.png` } } : o.def,
        })),
      cast: () => {
        const ms = clock.ms;
        const present = presentCast(live, onStage, ms);
        const marks = new Map<string, string | null>(live.scene() === 0 ? manifest.onStage.map((o) => [o.cast, o.mark] as const) : []);
        const since = live.sceneStartMs();
        for (const item of live.timeline()) {
          if (item.startMs < since || item.startMs > ms) continue;
          const a = item.action;
          if (a.do === 'place' && a.what.startsWith('cast:')) marks.set(a.what.slice(5), a.at);
          if (a.do === 'move' && a.to.startsWith('mark:')) marks.set(a.who, a.to.slice(5));
        }
        const holding = new Map(stage.objects.states().flatMap((o) => (o.home.kind === 'paw' ? [[o.home.cast, o.id] as const] : [])));
        return [...present].map((id) => ({ id, mark: marks.get(id) ?? null, holding: holding.get(id) ?? null }));
      },
      room: () => roomMap.forStory(stage.root),
      roomFx: () => ({
        on: roomFx.on,
        // The window opens on a real window, or a wall, or a stand-in wall: anywhere, once its painting has loaded.
        available: [...ROOM_EFFECTS_BUILT, ...(show.windowView ? (['window', 'window-off'] as const) : [])],
      }),
      nowMs: () => clock.ms,
      log: (m) => console.info(m),
      onState: (state, who) => {
        console.info(`storyteller: ${state}${who ? ` (${who})` : ''}`);
        // Printed on the page, like every caption: whose turn it is, and plainly when they can't hear you.
        const name = (who && manifest.cast.find((c) => c.member.id === who)?.member.name) || 'They';
        storyHint.listening = state === 'listening';
        if (state === 'performing') storyHint.blocked = null;
        if (state === 'listening' && storyHint.blocked) storyHint.base = storyHint.blocked;
        else if (state === 'listening') {
          storyHint.base = micAllowed ? `Your turn: hold the button to talk to ${name === "They" ? "them" : name}.` : "They can't hear you yet: allow the microphone on the page outside the book.";
        } else storyHint.base = state === 'thinking' ? (storyHint.heard ? `You: ${storyHint.heard}` : '…') : null;
        if (state !== 'thinking') storyHint.heard = null;
        runtime.setHint(storyHint.base);
      },
      onPaint: (job) => void collectPainting(job, session, sessionGen),
      onAcknowledge: (who) => sound.play('interested', stage.puppets.get(who)?.root.getWorldPosition(new Vector3())),
      // A guest can't use the AI Storyteller: said plainly, printed on the page, never as an error.
      onError: (code, message) => {
        if (code === 'unauthorized' && message === SIGN_IN_REQUIRED) storyHint.blocked = 'Sign in on the page outside the book to talk with them.';
        else if (code === 'upstream_failed' && /could not be reached/.test(message)) storyHint.blocked = 'No internet connection. The AI Storyteller needs the internet.';
        else return;
        runtime.setHint(storyHint.blocked);
      },
    });
    story = session;
  };
  /** A painting the story asked for: wait for it, upload it out of sight, then it appears on the page and the story is told. */
  async function collectPainting(job: { jobId: string; objectId: string }, session: StorySession | null, gen: number): Promise<void> {
    const deadline = performance.now() + 75_000;
    while (performance.now() < deadline) {
      await new Promise((r) => setTimeout(r, 2500));
      if (story !== session || gen !== host.generation) return; // A new evening began meanwhile, or the book was put away.
      const result = await storyAccess.withBackend((api) => api.paintResult({ jobId: job.jobId })).catch(() => null);
      if (!result || result.status === 'pending') continue;
      if (result.status === 'failed') {
        console.info(`storyteller: the painting didn't come (${result.reason})`);
        return;
      }
      const def = { ...result.object, id: job.objectId };
      if (def.art.kind !== 'url') return;
      const texture = await new TextureLoader().loadAsync(def.art.url).catch(() => null);
      if (!texture || story !== session || gen !== host.generation) return;
      // Kept for you at once; it appears on the page only once the story is playing again.
      void keepsakes.keep(def);
      await host.whenPlaying();
      if (story !== session || gen !== host.generation) return;
      texture.colorSpace = SRGBColorSpace;
      const ref = wholeRef(texture);
      defs.set(def.id, def);
      stage.objects.add(def, ref, { kind: 'page', at: [0.035, 0, 0.055] });
      world.renderer.initTexture(texture);
      sound.play('chime', stage.book.root.getWorldPosition(new Vector3()), undefined, 'ui');
      paintedTonight.push(def.name);
      session?.arrived(def.id);
      return;
    }
  }
  /** A new evening: a fresh session, and what you kept from earlier evenings back in your satchel. */
  function beginStory(): void {
    host.generation++;
    paintedTonight.length = 0;
    startStorySession();
    satchelSeen.clear();
    fromSatchel.clear();
    void bringKeepsakes(story, host.generation);
  }
  async function bringKeepsakes(session: StorySession | null, gen: number): Promise<void> {
    for (const k of await keepsakes.list()) {
      if (story !== session || gen !== host.generation) return;
      if (stage.objects.get(k.def.id) || k.def.art.kind !== 'url') continue;
      const texture = await new TextureLoader().loadAsync(k.def.art.url).catch(() => null);
      if (!texture || story !== session || gen !== host.generation || stage.objects.get(k.def.id)) continue;
      // Into the satchel only while the story is playing (held while a card, the cover or the headset holds it).
      await host.whenPlaying();
      if (story !== session || gen !== host.generation || stage.objects.get(k.def.id)) continue;
      texture.colorSpace = SRGBColorSpace;
      defs.set(k.def.id, k.def);
      stage.objects.add(k.def, wholeRef(texture), { kind: 'satchel' });
      world.renderer.initTexture(texture);
    }
  }
  const keepsakes = createKeepsakes();
  /** Where each thing was last frame, to notice one taken out of the satchel by hand. */
  const satchelSeen = new Map<string, string>();
  const fromSatchel = new Set<string>();
  /** What the caption band says between lines: whose turn it is, and your words as they're heard. */
  const storyHint: { base: string | null; heard: string | null; listening: boolean; blocked: string | null } = { base: null, heard: null, listening: false, blocked: null };
  // Listening: hold to talk. The microphone was allowed on the landing page before the Storyteller opened.
  let micAllowed = false;
  void navigator.permissions?.query({ name: 'microphone' as PermissionName }).then((p) => {
    micAllowed = p.state === 'granted';
    p.onchange = () => (micAllowed = p.state === 'granted');
  }).catch(() => undefined);
  const trim = (t: string) => (t.length > 70 ? `…${t.slice(-67)}` : t);
  const ears = createEars({
    token: () => storyAccess.withBackend((api) => api.speechToken({})).then((t) => (t && t.provider !== 'mock' ? t.token : null)).catch(() => null),
    heard: (text) => {
      if (!text) {
        runtime.setHint("Didn’t catch that. Hold the button and try again.");
        return;
      }
      storyHint.heard = trim(text);
      runtime.setHint(`You: ${storyHint.heard}`);
      story?.heard(text);
    },
    hearing: (text) => runtime.setHint(`You: ${trim(text)}`),
    onState: (state) => {
      talk.setState(state === 'off' ? 'idle' : state);
      if (state === 'opening') runtime.setHint('Wait for the tab to glow, then speak.');
      if (state === 'listening') {
        runtime.setHint("Listening… let go when you're done.");
        sound.play('chime', stage.book.root.getWorldPosition(new Vector3()), undefined, 'ui');
      }
    },
    log: (m) => console.info(m),
  });
  // The microphone never outlives the moment: leaving the page, the headset's view or XR stops it at
  // once, without waiting for another frame (frames stop when XR does).
  const stopEars = () => ears.stop();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopEars();
  });
  window.addEventListener('pagehide', stopEars);
  world.renderer.xr.addEventListener('sessionstart', () => {
    const xr = world.renderer.xr.getSession();
    xr?.addEventListener('visibilitychange', () => {
      if (xr.visibilityState !== 'visible') stopEars();
    });
  });
  world.renderer.xr.addEventListener('sessionend', stopEars);
  const talk = createTalkTab({
    bookRoot: stage.book.root,
    pageY: stage.book.pageY,
    pageW: assets.book.closedSizeM[0],
    pageD: assets.book.closedSizeM[1],
    hold: () => {
      // Holding the tab while they speak is cutting in: they stop, and listen.
      if (story && (story.state === 'performing' || story.state === 'thinking')) story.interrupt();
      void ears.hold();
    },
    release: () => ears.release(),
  });
  moreTargets.push(() => talk.targets());
  // The pop-up card the book's printed pages stand on. Review builds: `?card=pause` or `?card=busiest`
  // opens one once the book is open and writes how it reads from your eyes to data-card-report.
  const card = createCardView({ bookRoot: stage.book.root, pageY: stage.book.pageY, pageD: assets.book.closedSizeM[1], scene: world.scene });
  const cardProof = reviewQuery('card');
  /**
   * The first time: a small card stands on the table under the ribbon's tail, "Pinch the ribbon to pause",
   * until the first time you use the ribbon on this headset. Its type is sized like the menu's.
   */
  const RIBBON_HINT_KEY = 'tt.ribbon-used';
  let ribbonUsed = (() => {
    try {
      return localStorage.getItem(RIBBON_HINT_KEY) === '1';
    } catch {
      return false;
    }
  })();
  const hint = createCardView({
    bookRoot: stage.book.root,
    pageY: stage.book.pageY,
    pageD: assets.book.closedSizeM[1],
    scene: world.scene,
    // On the table just past the right page's front edge, beside where the ribbon hangs out (clear of Hold to talk).
    stand: { x: assets.book.closedSizeM[0] * RIBBON_X_SHARE + 0.03, y: 0, z: assets.book.closedSizeM[1] / 2 + 0.03 },
    widthEm: 9,
  });
  const PROOF_CARDS: Record<string, CardSpec> = {
    pause: { over: 'Chapter 1', title: 'The night the light went out', choices: [{ id: 'carry-on', label: 'Carry on' }, { id: 'again', label: 'Start again' }, { id: 'contents', label: 'Contents' }, { id: 'away', label: 'Put the book away' }] },
    busiest: {
      title: 'The teapot who wanted to keep the lighthouse',
      lines: ['A chipped teapot washed up on the shore.', 'The keeper named it and wrote it in the log.', 'Someone small tried to sleep inside it.'],
      note: 'Painted for you: the dragon kite, a teapot called Shubham Mishra',
      choices: [{ id: 'another', label: 'Tell another' }, { id: 'stories', label: 'Your stories' }, { id: 'contents', label: 'Contents' }, { id: 'away', label: 'Put the book away' }],
    },
  };
  let cardProofAt: number | null = null;

  /**
   * The host's generation: bumped whenever what's on the stage stops belonging to what was asked for
   * (put away, switched, started again, a new story). Late work from an older one writes nothing.
   */
  const host = {
    generation: 0,
    waiting: [] as Array<() => void>,
    /** Resolves once the story is playing (no card holding it, the cover open, the headset on). */
    whenPlaying(): Promise<void> {
      if (!held()) return Promise.resolve();
      return new Promise((resolve) => host.waiting.push(resolve));
    },
  };
  /** The story is held: by the clock's pause (cover, ribbon, headset, hands), a card, leaving, or an ending. */
  const held = (): boolean => clock.paused || cardShowing(menu) || menu.leaving || menu.root === 'ending';
  /** Whether lane D's session has been told to hold. */
  let suspended = false;
  /**
   * One lifecycle, from the combined state: the session holds its turns, voice and paintings while the
   * story is held, and the microphone stops at once; playing again releases them in order, and so do
   * the host's own deliveries (paintings, kept things) waiting in whenPlaying().
   */
  function syncLifecycle(): void {
    const now = held();
    if (now && !suspended) {
      suspended = true;
      ears.stop();
      life(story)?.suspend?.();
    } else if (!now && suspended) {
      suspended = false;
      life(story)?.resume?.();
    }
    if (!now && host.waiting.length) for (const resolve of host.waiting.splice(0)) resolve();
  }
  /** Leaving (put away, or XR ended): nothing late from now on lands, and the story is let go. */
  function invalidate(): void {
    host.generation++;
    ears.stop();
    if (story) {
      story.dispose();
      story = null;
      storyNeedsFresh = storyMode;
    }
    // Late deliveries waiting to land wake, see the new generation, and drop.
    for (const resolve of host.waiting.splice(0)) resolve();
  }
  const paintedTonight: string[] = [];
  /** Sound and the room's light, kept on this headset. */
  const SETTINGS_KEY = 'tt.settings';
  const settings: { soundOn: boolean; light: 'dark' | 'lighter' } = (() => {
    try {
      return { soundOn: true, light: 'dark' as const, ...(JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') as { soundOn?: boolean; light?: 'dark' | 'lighter' }) };
    } catch {
      return { soundOn: true, light: 'dark' as const };
    }
  })();
  /** "Lighter" keeps the house lights from going all the way down: the dim stops at this share. */
  const LIGHTER_DIM = 0.55;
  const saveSettings = () => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // Kept for this visit only.
    }
  };
  const applySound = () => (sound as unknown as { setMuted?: (on: boolean) => void }).setMuted?.(!settings.soundOn);
  applySound();

  // The menu: the ribbon opens it, the card shows it, and the story waits while it's open.
  let menu: MenuState = initialMenu();
  let ending: MenuContext['ending'] = null;
  let shownGeneration = -1;
  const chapterN = 1;
  const menuContext = (): MenuContext => {
    const library = libraryState(localStorage, Date.now(), series);
    const storyTitle = life(story)?.title?.() ?? null;
    return {
      mode: storyMode ? 'storyteller' : 'chapter',
      heading: storyMode ? { over: null, title: storyTitle ?? 'The AI Storyteller' } : { over: `Chapter ${chapterN}`, title: canonData?.title ?? library.chapters.find((c) => c.n === chapterN)?.title ?? '' },
      where: storyMode || !runtime.started ? null : whereIn(assets.spine, runtime.scheduler.current().beatId),
      current: storyMode ? null : chapterN,
      chapters: library.chapters,
      stories: storytellerSnapshot().finished,
      satchelCount: stage.objects.states().filter((o) => o.home.kind === 'satchel').length,
      soundOn: settings.soundOn,
      light: settings.light,
      ending,
    };
  };
  function setMenu(next: MenuState): void {
    const wasShowing = cardShowing(menu);
    menu = next;
    if (cardShowing(menu) && !wasShowing) {
      // A card opened: whatever the hands held goes back with no gift, drop or turn, and the microphone stops now.
      hands.cancelAll();
      controls.cancelAll();
    }
    // A finished story stays frozen under its end card; a chapter's has simply ended.
    const freeze = holdsStory(menu) || (storyMode && menu.root === 'ending');
    if (freeze !== controls.ribbonUp) controls.setRibbon(freeze);
    syncLifecycle();
    shownGeneration = -1;
  }
  async function endStoryHere(): Promise<void> {
    const gen = ++host.generation;
    ears.stop();
    const ending0 = life(story)?.end?.();
    const result = ending0 ? await ending0.catch(() => null) : null;
    if (gen !== host.generation) return;
    ending = { heading: result?.title ?? menuContext().heading.title, lines: result?.lines ?? [], things: result?.things ?? [...paintedTonight], next: null };
    void recordFinished({ id: `story-${Date.now()}`, title: ending.heading, lines: ending.lines, things: ending.things });
    story?.dispose();
    story = null;
    setMenu(ended(menu));
  }
  /** Leaves for the page: the place is kept, nothing late lands, and the page shows `target` if one was chosen. */
  function putAway(target: EnterTarget | null): void {
    invalidate();
    if (target) chooseEntry(target, storyMode ? { kind: 'storyteller' } : { kind: 'chapter', n: chapterN, from: runtime.ended ? 'start' : 'resume' });
    away.requested = true;
  }
  function apply(effect: MenuEffect | null): void {
    if (!effect) return;
    switch (effect.kind) {
      case 'carry-on':
        return;
      case 'again':
        if (storyMode && !runtime.ended && menu.root === 'playing') void endStoryHere();
        else {
          ending = null;
          host.generation++;
          readAgain.requested = true;
        }
        return;
      case 'tell-another':
        ending = null;
        host.generation++;
        readAgain.requested = true;
        return;
      case 'put-away':
        return putAway(null);
      case 'next-chapter':
        return putAway({ kind: 'chapter', n: chapterN + 1, from: 'start' });
      case 'open':
        return putAway(effect.target.kind === 'storyteller' ? { kind: 'storyteller' } : effect.target);
      case 'toggle-sound':
        settings.soundOn = !settings.soundOn;
        saveSettings();
        applySound();
        return;
      case 'cycle-light':
        settings.light = settings.light === 'dark' ? 'lighter' : 'dark';
        saveSettings();
        return;
    }
  }
  menuHooks.onRibbon = () => {
    if (!ribbonUsed) {
      ribbonUsed = true;
      hint.close();
      try {
        localStorage.setItem(RIBBON_HINT_KEY, '1');
      } catch {
        // The hint simply shows again next time.
      }
    }
    setMenu(ribbonPinched(menu));
  };
  menuHooks.showing = () => cardShowing(menu) && !cardProof;
  const commit = (id: string, generation: number) => {
    if (generation !== menu.generation || !card.ready) return;
    sound.play('felt', stage.book.root.getWorldPosition(new Vector3()), undefined, 'ui');
    const r = choose(menu, id, menuContext());
    setMenu(r.state);
    apply(r.effect);
  };
  menuHooks.cardTargets = () => {
    const generation = menu.generation;
    return card.targets().map((t) => ({
      proxy: { id: `card:${t.id}`, position: { x: t.position.x, y: t.position.y, z: t.position.z }, radiusM: t.radiusM },
      onRelease: () => commit(t.id, generation),
      halo: false,
    }));
  };
  menuHooks.pick = (origin, direction) => {
    const CONE = (6 * Math.PI) / 180;
    const ribbonAt = stage.book.root.localToWorld(new Vector3(assets.book.closedSizeM[0] * RIBBON_X_SHARE, stage.book.pageY, assets.book.closedSizeM[1] / 2 - 0.012));
    let best: { id: string; a: number } | null = null;
    for (const t of [...card.targets(), { id: 'ribbon', position: ribbonAt }]) {
      const a = direction.angleTo(t.position.clone().sub(origin));
      if (a < CONE && (!best || a < best.a)) best = { id: t.id, a };
    }
    return best ? { id: best.id, generation: menu.generation } : null;
  };
  menuHooks.commit = (c) => commit(c.id, c.generation);
  menuHooks.generation = () => menu.generation;
  /** Each frame: the card shows what the menu says, while the book is open; a hand near a choice brightens its rule. */
  function cardStep(deltaMs: number): void {
    const want = cardShowing(menu) && controls.amount > 0.98 && !away.requested;
    if (want && shownGeneration !== menu.generation) {
      shownGeneration = menu.generation;
      const spec = cardFor(menu, menuContext());
      if (spec) void card.open(spec, head);
    } else if (!want && card.shown && !cardProof) {
      card.close();
      shownGeneration = -1;
    }
    let near: string | null = null;
    let bestD = Infinity;
    for (const side of ['left', 'right'] as const) {
      const p = controls.pinchPoint(side);
      if (!p) continue;
      for (const t of card.targets()) {
        const d = p.distanceTo(t.position);
        if (d < t.radiusM && d < bestD) {
          near = t.id;
          bestD = d;
        }
      }
    }
    card.setNear(near);
    // The ribbon's hint: while the story plays with the book open, until the ribbon has been used once.
    hint.frame(deltaMs, head);
    const hintWanted = !ribbonUsed && runtime.started && !cardShowing(menu) && controls.amount > 0.98 && !away.requested;
    if (hintWanted && !hint.shown) void hint.open({ lines: ['Pinch the ribbon to pause'], choices: [] }, head);
    else if (!hintWanted && hint.shown && hint.spec) hint.close();
    // Back to a chapter that had already ended (a reload at its end): its end card, not a silent page.
    if (!storyMode && runtime.ended && wasEnded && menu.root === 'playing' && !readAgain.requested && runtime.started) {
      ending ??= chapterEnding(chapterN, null, defs, null);
      setMenu(ended(menu));
    }
    // Review builds: where the menu is and where its targets are, for checks driven by emulated hands.
    if (REVIEW_HOOKS) {
      const top = menu.stack[menu.stack.length - 1];
      const ribbonAt = stage.book.root.localToWorld(new Vector3(assets.book.closedSizeM[0] * RIBBON_X_SHARE, stage.book.pageY + 0.01, assets.book.closedSizeM[1] / 2 - 0.012));
      const r3 = (v: Vector3) => [v.x, v.y, v.z].map((n) => +n.toFixed(3));
      const info = JSON.stringify({ objects: Object.fromEntries(hands.targets().filter((t) => t.proxy.id.startsWith("object:")).slice(0, 6).map((t) => [t.proxy.id.slice(7), { at: [t.proxy.position.x, t.proxy.position.y, t.proxy.position.z].map((n) => +n.toFixed(3)), home: stage.objects.get(t.proxy.id.slice(7))?.home.kind }])), mode: storyMode ? "story" : "chapter", story: story !== null, talk: earsOn, root: menu.root, top: top?.kind ?? null, gen: menu.generation, ready: card.ready, card: card.debug, hint: hint.ready ? Math.round(1000 * (hint.measure(head, stage.book.root.getWorldPosition(new Vector3()))?.minTextDeg ?? 0)) / 1000 : hint.shown, shown: card.shown, spec: card.spec?.title ?? null, open: +controls.amount.toFixed(2), shownGen: shownGeneration, clockMs: Math.round(clock.ms), paused: clock.paused, ribbon: r3(ribbonAt), pinchL: controls.pinchPoint("left") && r3(controls.pinchPoint("left")!), pinchR: controls.pinchPoint("right") && r3(controls.pinchPoint("right")!), targets: Object.fromEntries(card.targets().map((t) => [t.id, r3(t.position)])) });
      if (document.documentElement.dataset.menu !== info) document.documentElement.dataset.menu = info;
    }
    if (host.waiting.length && !clock.paused && !cardShowing(menu)) for (const resolve of host.waiting.splice(0)) resolve();
  }
  let earsOn = false;
  const startEpisode = () => {
    log.forget();
    director.reset();
    log.append('episode.started', { spine: assets.spine, libraryVersion: manifest.libraryVersion, objects: showObjects(), players: [{ id: 'reader', name: 'Reader' }] });
  };
  const series = manifest.libraryVersion;
  // Review builds only: `?speed=4` runs the show four times faster, to walk a whole episode in the emulator.
  const speed = Math.max(0.25, Math.min(16, Number(reviewQuery('speed') ?? 1) || 1));
  const head = new Vector3();
  const bookAt = new Vector3();
  const lightningAt = new Vector3();
  /** The room effects showing now, for telemetry and the storyteller. */
  const roomFx: { on: import('@tabletop/contracts').RoomEffect[] } = { on: [] };
  let roomFxKey = '';
  /** The show time of the last thunder heard, so each one plays once. */
  let thunderAt = -Infinity;
  let shootingAt = -Infinity;
  const forward = new Vector3();
  const up = new Vector3();
  const spot = new Vector3();
  let arrival: { atMs: number; confirmed: boolean; landed: boolean; bloomed: boolean; opened: boolean } | null = null;
  let nowMs = 0;
  let searching = false;
  let lastCheckpointMs = -Infinity;
  let warming: (() => void) | null = null;
  let warmedSession: XRSession | null = null;
  let unfoldDim = 0;
  /** No passthrough: the painted reading room, with its own table. */
  let vr = false;
  let roomPlaced = false;
  let sessionFrames = 0;
  const flow = createSessionFlow();
  // Review builds only: `?inject=frame-error` throws inside the hand-input step, to prove the story survives it.
  const inject = reviewQuery('inject') === 'frame-error';
  let injected = 0;

  // Back after a crash, or continuing: the story waits, shut, at the saved moment. The book arrives, reopens and carries on.
  if (resumeFrom) {
    runtime.restore(resumeFrom.runtime as unknown as RuntimeSnapshot, resumeFrom.showMs);
    controls.shut();
    sizing.userScale = resumeFrom.scale;
  }
  // Review builds only: `?jump=<beat>` plays the episode silently up to that beat, nobody helping, and starts there.
  const jump = reviewQuery('jump');
  if (jump && !resumeFrom) {
    const s = runtime.scheduler;
    let t = 0;
    for (; t < 600_000 && s.current().beatId !== jump && !s.ended; t += 100) s.tick(t, false);
    if (s.current().beatId === jump) {
      // A moment before the beat, so its own first actions still happen.
      const open = s.openProblem(t);
      const asksDrawer = !!open && assets.spine.scenes.some((sc) => sc.beats.some((b) => b.actions.some((a) => a.do === 'ask_reader' && a.problem === open.id && a.opensDrawer)));
      runtime.restore({ v: 2, scheduler: s.snapshot(), objects: initialObjects, overlays: [], drawerWanted: asksDrawer, satchelOpen: false }, Math.max(0, s.current().startMs - 1));
      // Like a resume: it waits, shut, until the book has arrived and opened.
      controls.shut();
    } else runtime.reset(initialObjects);
  }

  const checkpoint = (): void => {
    if (!runtime.started || storyMode) return;
    writeCheckpoint(localStorage, { v: CHECKPOINT_VERSION, savedAt: new Date().toISOString(), seriesId: series, episodeId: assets.spine.id, showMs: clock.ms, scale: stage.root.scale.x, confirmed: arrival?.confirmed ?? false, runtime: runtime.snapshot() as unknown as Record<string, unknown>, ended: runtime.ended });
  };

  const placement = startPlacement(
    world,
    stage.root,
    (surface, tables) => {
      // Once the book has begun to open it never moves by itself, except to arrive again after you return.
      if (!flow.canPlace(runtime.started)) return;
      // On the scanned table you meant, all of it on the top; a size you chose by hand (or one restored) is kept.
      const settled = settleOnTable({ head, spot: { x: stage.root.position.x, y: stage.root.position.y, z: stage.root.position.z }, tables, userScale: sizing.userScale ?? null });
      const { scale, fits } = settled;
      const where = stage.root.position.set(settled.spot.x, settled.spot.y, settled.spot.z);
      stage.root.rotation.y = Math.atan2(head.x - where.x, head.z - where.z);
      const outline = settled.table?.outline ?? null;
      tableTop.outline = outline;
      stage.satchel.setSide(settled.satchelSide);
      stage.root.scale.setScalar(scale);
      const eyeDistance = Math.hypot(head.x - where.x, head.y - where.y, head.z - where.z) + 0.1 * scale;
      stage.caption.setSize(minTextSizeM(stage.caption.baseSizeM, scale, eyeDistance));
      telemetry.record({ kind: 'stage_fit', surface: outline ? 'plane' : surface, widthM: 0.42 * scale, scale });
      document.documentElement.dataset.placement = `${surface}${fits ? '' : ':tight'}`;
      // A first spot, or a real table found after a provisional one: the moment plays from the top there.
      arrival = { atMs: nowMs, confirmed: surface !== 'fallback', landed: false, bloomed: false, opened: false };
    },
    () => vr,
    (work) => guard('placement', work),
  );

  /** In the painted room the book goes on the painted table, at a seated reading height in front of you. */
  function placeInRoom(): void {
    if (!room) return;
    const table = tableSpot(head, forward);
    room.place(head, forward, table);
    room.root.visible = true;
    stage.root.position.set(table.x, table.y, table.z);
    stage.root.rotation.y = Math.atan2(head.x - table.x, head.z - table.z);
    const { scale } = settleOnTable({ head, spot: table, tables: [], userScale: sizing.userScale ?? null });
    stage.root.scale.setScalar(scale);
    stage.root.visible = true;
    telemetry.record({ kind: 'stage_fit', surface: 'plane', widthM: 0.42 * scale, scale });
    document.documentElement.dataset.placement = 'room';
    arrival = { atMs: nowMs, confirmed: true, landed: false, bloomed: false, opened: false };
    roomPlaced = true;
  }

  /** A new XR session: warm every shader up, and if the story is under way, arrive again, shut. */
  function beginSession(session: XRSession): void {
    warmedSession = session;
    // Back in the book after putting it away: the menu answers again, with nothing open.
    setMenu(returned(menu));
    // The Storyteller was let go when you left: this time the book opens on a new story.
    if (storyNeedsFresh) {
      storyNeedsFresh = false;
      ending = null;
      readAgain.requested = true;
    }
    vr = session.environmentBlendMode === 'opaque' && !!room;
    roomMap.reset();
    roomPlaced = false;
    sessionFrames = 0;
    if (room) room.root.visible = vr;
    if (flow.begin(runtime.started).shut) {
      controls.shut();
      arrival = null;
      pause.set('headset_off', false);
    }
    const warmStage = warmUp(stage.root, head, forward);
    const dimWasVisible = show.dim.mesh.visible;
    const emberWasVisible = ember.sprite.visible;
    show.dim.mesh.visible = true;
    ember.sprite.visible = true;
    warming = () => {
      warmStage();
      show.dim.mesh.visible = dimWasVisible;
      ember.sprite.visible = emberWasVisible;
    };
    momentForTelemetry = 'warm-up';
  }

  // Each part of the frame has its own guard, so an error in one (say, hand input) never stops the story.
  const handsStep = guard('controls', (frame: XRFrame, deltaMs: number) => {
    hands.frame(clock.ms, controls.amount > 0.98);
    controls.frame(frame, deltaMs, runtime.started && (!arrival || arrival.opened), head);
    if (inject && injected < 3 && clock.ms > 2000) {
      injected++;
      throw new Error('injected frame error');
    }
  });

  // The Storyteller's first story begins once everything it uses exists (the host, the menu, the ears).
  if (storyMode) beginStory();
  /** The room's light setting, through the hands' fold: the show's dim never goes past it. */
  const roomLightFold = (fold: ReturnType<typeof controls.fold>) => (settings.light === 'lighter' ? { ...fold, dim: Math.min(fold.dim, LIGHTER_DIM) } : fold);
  let wasEnded = runtime.ended;
  const storyStep = guard('runtime', (deltaMs: number) => {
    card.frame(deltaMs, head);
    syncLifecycle();
    if (!cardProof) cardStep(deltaMs);
    // The old printed end line gives way to the end card.
    stage.endPage.root.visible = false;
    if (cardProof && PROOF_CARDS[cardProof] && runtime.started && controls.amount > 0.98) {
      if (cardProofAt === null) {
        cardProofAt = nowMs;
        pause.set('ribbon', true);
        void card.open(PROOF_CARDS[cardProof]!, head);
      } else if (card.ready && nowMs - cardProofAt > 1500) {
        const report = card.measure(head, stage.book.root.getWorldPosition(new Vector3()));
        const bookAt = stage.root.getWorldPosition(new Vector3());
        const json = JSON.stringify({ card: cardProof, bookScale: stage.root.scale.x, bookAt: [bookAt.x, bookAt.y, bookAt.z].map((v) => +v.toFixed(3)), head: [head.x, head.y, head.z].map((v) => +v.toFixed(3)), ...report });
        if (document.documentElement.dataset.cardReport !== json) {
          document.documentElement.dataset.cardReport = json;
          console.info(`card proof ${json}`);
        }
      }
    }
    // Put the book away: it closes, the place is kept, and the immersive session ends. The landing page offers "Continue".
    if (away.requested) {
      if (controls.amount > 0.001) controls.close();
      else {
        away.requested = false;
        checkpoint();
        void world.renderer.xr.getSession()?.end().catch(() => undefined);
      }
    }
    // Read it again: the book closes under your hand, then the story opens from the top.
    if (readAgain.requested) {
      if (controls.amount > 0.001) controls.close();
      else if (storyMode) {
        // Start again, in the Storyteller: a new evening on a fresh stage.
        readAgain.requested = false;
        beginStory();
        runtime.start();
        setMenu(restarted(menu));
        controls.lowerRibbon();
        controls.reopen();
        story!.open();
      } else {
        readAgain.requested = false;
        runtime.reset(initialObjects);
        startEpisode();
        setMenu(restarted(menu));
        controls.lowerRibbon();
        clearCheckpoint(localStorage);
        writeProgress(localStorage, { seriesId: series, chapter: 1, state: 'started' });
        log.append('beat.started', { beatId: assets.spine.scenes[0]!.entry, fallback: null });
        controls.reopen();
        wasEnded = false;
      }
    }
    const { unfold, room: roomNow } = runtime.frame(deltaMs * speed, nowMs, head, { fold: roomLightFold(controls.fold()), ribbon: controls.ribbonLift() }, { left: controls.pinchPoint('left'), right: controls.pinchPoint('right') });
    devRoomTick();
    shadowPlay.frame({
      renderer: world.renderer,
      scene: world.scene,
      shadows: roomNow.shadows,
      bookOpen: controls.amount > 0.98,
      bookRoot: stage.book.root,
      pageY: stage.book.pageY,
      cast: [...stage.puppets.values()].map((p) => p.root).filter((r) => { for (let o: import('@iwsdk/core').Object3D | null = r; o; o = o.parent) if (!o.visible) return false; return true; }),
      room: roomMap,
      lift: (at, radiusM, strength) => show.dim.lift(head, { at, radiusM, strength }),
    });
    fireflies.frame({
      state: roomNow.fireflies,
      deltaMs,
      nowMs,
      bookOpen: controls.amount > 0.98,
      bookRoot: stage.book.root,
      pageY: stage.book.pageY,
      hands: [controls.fingertip('left'), controls.fingertip('right')],
      onRise: (at) => sound.play('spark', at),
    });
    const sky = weather.frame({ weather: roomNow.weather, thunderMs: roomNow.thunderMs, nowMs, head, floorY: roomMap.floorY(), ceilingY: roomMap.ceilingY(), bookOpen: controls.amount > 0.98 });
    // Lightning and its thunder come from your window's side (the room's nearest window), or far off ahead.
    const lightningWindow = roomMap.resolve('room:window', 'face');
    const lightningFrom = lightningWindow?.label === 'window' ? lightningWindow.centre : lightningAt.copy(head).addScaledVector(forward, 6).setY(head.y + 1.5);
    // The storm leaves your walls alone: no lightning light, no extra dark (owner, Nov 15: "walls
    // illumination can skip, rain is okay"). Thunder is heard, not seen.
    show.dim.weather({ storm: 0, night: 0, flash: 0, window: null });
    // The storm's sound: rain all round you, and each thunder once.
    sound.ambience('rain', sky.storm);
    // The sea's wash all round you while it's in, easing in and out with it.
    const seaSince = Math.min(1, roomNow.sea.sinceMs / 4000);
    sound.ambience('sea', (roomNow.sea.on ? seaSince : 1 - seaSince) * (controls.amount > 0.98 ? 1 : 0));
    // A shooting star's shimmer, once, from overhead.
    if (roomNow.shootingStarMs !== null && roomNow.shootingStarMs < 400) {
      const startedAt = Math.round(clock.ms - roomNow.shootingStarMs);
      if (Math.abs(startedAt - shootingAt) > 1000) {
        shootingAt = startedAt;
        sound.play('shooting', head.clone().addScaledVector(forward, 2).setY(roomMap.ceilingY()));
      }
    }
    if (roomNow.thunderMs !== null && roomNow.thunderMs < 400) {
      const startedAt = Math.round(clock.ms - roomNow.thunderMs);
      if (Math.abs(startedAt - thunderAt) > 1000) {
        thunderAt = startedAt;
        sound.thunder(lightningFrom.clone());
      }
    }
    roomDepth.frame(roomNow.weather.on || roomNow.weather.sinceMs < 6000 || roomNow.sea.on || roomNow.sea.sinceMs < 5000, roomMap);
    gulls?.frame({ state: roomNow.gulls, nowMs, room: roomMap, head, book: stage.root.visible ? stage.root.getWorldPosition(bookAt) : null, bookOpen: controls.amount > 0.98, onCall: (at) => sound.play('gull', at) });
    sea?.frame({ now: roomNow, nowMs, head, floorY: roomMap.floorY(), bookOpen: controls.amount > 0.98 });
    snow?.frame({ weather: roomNow.weather, nowMs, head, room: roomMap, bookOpen: controls.amount > 0.98 });
    nightSky?.frame({ now: roomNow, nowMs, room: roomMap, head, book: stage.root.visible ? stage.root.getWorldPosition(bookAt) : null, bookOpen: controls.amount > 0.98 });
    windowView?.frame({ state: roomNow.window, nowMs, room: roomMap, bookOpen: controls.amount > 0.98, head, forward, book: stage.root.visible ? stage.root.getWorldPosition(bookAt) : null });
    // Which room effects are showing, each time that changes, so frame summaries can be read per effect.
    const fxOn = effectsOn(roomNow);
    const fxKey = fxOn.join(',');
    if (fxKey !== roomFxKey) {
      roomFxKey = fxKey;
      roomFx.on = fxOn;
      telemetry.record({ kind: 'room_fx', on: fxOn });
    }
    // Review builds: what's out in the room, for checks without pictures.
    if (REVIEW_HOOKS) {
      const seen = roomMap.seenLabels().join(',');
      if (seen && document.documentElement.dataset.roomLabels !== seen) document.documentElement.dataset.roomLabels = seen;
      const out = stage.objects.states().flatMap((o) => (o.home.kind === 'room' ? [`${o.id}@${o.home.place}`] : [])).join(',');
      if (document.documentElement.dataset.roomObjects !== out) document.documentElement.dataset.roomObjects = out;
    }
    unfoldDim = unfold.dim;
    // The book's own pull hides while the drawer is out: it rides on the drawer's front then.
    const bookPull = stage.book.root.getObjectByName('drawer-pull');
    if (bookPull) bookPull.visible = runtime.drawerAmount < 0.02;
    // The director's answers become offers; then, at the start of a quiet beat, it may ask for a callback.
    for (const a of answers.splice(0)) director.receive(runtime.scheduler, clock.ms, a.id, a.ready);
    if (show.directorOn && runtime.started && !runtime.ended) director.frame(runtime.scheduler, clock.ms);
    story?.frame();
    if (story) {
      for (const o of stage.objects.states()) {
        const was = satchelSeen.get(o.id);
        const now = o.home.kind;
        if (was === now) continue;
        satchelSeen.set(o.id, now);
        if (was === 'satchel') void keepsakes.used(o.id);
        if (was === 'satchel' && now === 'hand') fromSatchel.add(o.id);
        else if (was === 'hand' && now !== 'hand' && fromSatchel.delete(o.id) && now === 'page') story.arrived(o.id);
      }
    }
    // The tab is there while the Storyteller's book is open and playing; a pause lets the microphone go.
    const canTalk = story !== null && runtime.started && !held() && controls.amount > 0.98;
    if (story) talk.frame({ left: controls.fingertip('left'), right: controls.fingertip('right') });
    if (canTalk !== earsOn) {
      earsOn = canTalk;
      talk.setShown(canTalk);
      if (canTalk && micAllowed) ears.ready();
      if (!canTalk) ears.stop();
    }
    for (const e of runtime.drain()) {
      if (e.type === 'gift' && story) {
        story.gift(e.objectId, e.castId);
        continue;
      }
      if (e.type === 'gift') {
        log.append('object.handed', { objectId: e.objectId, toCast: e.castId, playerId: 'reader' });
        const o = e.outcome;
        if (o.kind === 'rule' || o.kind === 'fallback') log.append('problem.attempted', { problemId: o.problemId, objectId: e.objectId, playerId: 'reader', ruleId: o.kind === 'rule' ? o.ruleId : null });
        if (o.kind === 'rule' && o.outcome === 'solved') log.append('problem.resolved', { problemId: o.problemId, outcome: o.ruleId, objectId: e.objectId });
        if (show.directorOn) director.gift(runtime.scheduler, clock.ms, showObjects().find((x) => x.id === e.objectId) ?? null, e.castId, e.outcome);
        continue;
      }
      if (e.type === 'cast.held' || e.type === 'cast.dropped') {
        if (e.type === 'cast.held') log.append('entity.grabbed', { entity: `cast:${e.castId}`, playerId: 'reader' });
        else log.append('entity.placed', { entity: `cast:${e.castId}`, playerId: 'reader', at: [0, 0, 0] });
        if (e.type === 'cast.held') director.remember();
        continue;
      }
      if (e.type === 'offer.admitted') {
        // What the director has said goes in the log, so the next request knows not to say it again.
        const beat = runtime.scheduler.beat(e.beatId);
        log.append('beat.queued', { ready: { beat, voice: Object.fromEntries(linesOf(beat).map((l) => [l.lineId, { url: null, durationMs: estimateSpeechMs(l.text) }])) } });
      }
      if (e.type === 'offer.admitted' || e.type === 'offer.expired') {
        console.info(`director ${e.type === 'offer.admitted' ? `plays ${e.kind} after ${Math.round(e.waitedMs)} ms` : `drops ${e.kind}: ${e.reason}`}`);
        continue;
      }
      if (e.type === 'problem.ignored') log.append('problem.resolved', { problemId: e.problemId, outcome: 'ignored', objectId: null });
      if (e.type === 'episode.ended') log.append('episode.ended', { outcome: 'resolved', durationMs: e.atMs });
      if (e.type === 'beat.started') log.append('beat.started', { beatId: e.beatId, fallback: null });
      else if (e.type === 'beat.completed') log.append('beat.completed', { beatId: e.beatId });
      else if (e.type === 'problem.opened' && e.opensDrawer) log.append('drawer.opened', { by: 'beat' });
      lastCheckpointMs = -Infinity;
    }
    if (runtime.ended && !wasEnded && !storyMode) {
      wasEnded = true;
      // What lasts: the facts the next chapter reads, what you keep and its history, and the page.
      if (canonData) {
        const played = new Set(runtime.scheduler.snapshot().history.map((h) => h.beatId));
        const kept = stage.objects.states().filter((o) => o.home.kind === 'satchel').map((o) => o.id);
        const sets = [...new Set(assets.spine.scenes.map((sc) => sc.setId))];
        let page: { title: string; text: string[]; keepsakes: string[] } | null = null;
        const append: typeof log.append = (type, data) => {
          if (type === 'page.composed') page = (data as { page: { title: string; text: string[]; keepsakes: string[] } }).page;
          return log.append(type, data);
        };
        recordChapterEnd(append, canonData, played, kept, defs, sets.map((id) => `sets/${id}/ground.png`));
        ending = chapterEnding(chapterN, page, defs, CHAPTERS.some((c) => c.n === chapterN + 1) ? { n: chapterN + 1 } : null);
      } else ending = chapterEnding(chapterN, null, defs, null);
      writeProgress(localStorage, { seriesId: series, chapter: 1, state: 'finished' });
      checkpoint();
      setMenu(ended(menu));
    }
    if (vr) {
      // No passthrough to dim: the house lights go down in the painted room itself.
      show.dim.mesh.visible = false;
      roomLook.light.value = roomLight(unfold.dim);
    }
    if (runtime.started) {
      if (nowMs - lastCheckpointMs >= CHECKPOINT_EVERY_MS) {
        lastCheckpointMs = nowMs;
        checkpoint();
      }
    }
  });

  const arrivalStep = guard('arrival', () => {
    if (!arrival) {
      momentForTelemetry = warming ? 'warm-up' : 'searching';
      const since = placement.searchStartedMs();
      if (since !== null && (!runtime.started || flow.canPlace(true))) {
        ember.search(head, forward, nowMs - since);
        if (!searching) sound.hum(true);
        searching = true;
      }
      stage.book.root.visible = false;
      return;
    }
    const a = arrivalAt(nowMs - arrival.atMs, arrival.confirmed);
    momentForTelemetry = arrival.opened ? `beat:${runtime.scheduler.current().beatId}` : a.landed ? 'landed' : a.bookVisible ? 'drop' : a.bloom > 0 ? 'bloom' : 'found';
    stage.root.getWorldPosition(spot);
    ember.land(spot, a.ember);
    if (searching && a.ember === 0) {
      searching = false;
      sound.hum(false);
    }
    if (!arrival.bloomed && a.bloom > 0) {
      arrival.bloomed = true;
      sound.play('bloom', spot, undefined, 'ui');
    }
    // The wash fades to a faint stain under the book as the house lights go down.
    wash.update(a.bloom, 1 - 0.75 * unfoldDim, a.words * (1 - unfoldDim), nowMs / 1000);
    stage.book.root.visible = a.bookVisible;
    stage.book.root.position.y = SETTLE_DROP_M * a.drop;
    if (a.landed && !arrival.landed) {
      arrival.landed = true;
      sound.play('thump', spot, undefined, 'ui');
    }
    if (a.landed && !arrival.opened && nowMs - arrival.atMs >= OPEN_AT_MS) {
      arrival.opened = true;
      placement.lock();
      if (flow.landed(runtime.started).reopen) {
        // Back after leaving, or after a crash: the book opens again and the story carries on.
        controls.reopen();
        sound.roomTone(true);
      } else if (!runtime.started) {
        runtime.start();
        if (story) story.open();
        else {
          startEpisode();
          writeProgress(localStorage, { seriesId: series, chapter: 1, state: 'started' });
        }
      }
    }
  });

  world.onXRFrame(
    guard('show', (frame: XRFrame, delta: number, time: number) => {
      nowMs = time * 1000;
      world.camera.getWorldPosition(head);
      world.camera.getWorldDirection(forward);
      up.set(0, 1, 0).applyQuaternion(world.camera.quaternion);
      sound.setListener(head, forward, up);
      // Your room, read from Space Setup now and then, and where the book stands in it.
      const space = world.xrReferenceSpace;
      if (space) roomMap.frame(frame, space, head, forward);
      roomMap.setBookAt(stage.root.visible ? stage.root.getWorldPosition(bookAt) : null);
      // Stage two of preloading: draw everything once, out of sight, so the XR shader variants compile now.
      if (frame.session !== warmedSession) {
        beginSession(frame.session);
        return;
      }
      if (warming) {
        warming();
        warming = null;
      }
      // Wait a few frames for a settled head pose before building the room around it.
      if (vr && !roomPlaced && ++sessionFrames >= 3 && flow.canPlace(runtime.started)) placeInRoom();
      handsStep(frame, delta * 1000);
      storyStep(delta * 1000);
      arrivalStep();
    }),
  );

  // Taking the headset off, or leaving XR, pauses the show and its sound. Coming back resumes it.
  let wasImmersive = false;
  world.visibilityState.subscribe((state) => {
    if (state === VisibilityState.NonImmersive) {
      if (flow.end(runtime.started).pause) pause.set('headset_off', true);
      // Out of XR (the system menu, the browser, or Put the book away): late work from this visit is dropped.
      if (wasImmersive) invalidate();
      wasImmersive = false;
    } else {
      wasImmersive = true;
      pause.set('headset_off', state !== VisibilityState.Visible);
    }
    checkpoint();
  });
  addEventListener('pagehide', checkpoint);

  if (REVIEW_HOOKS) Object.assign(window, { __tt: { world, show, guard, get story() { return story; } } });
}

// Review builds: `?occlusion=on` requests depth sensing and hides the stage behind real things (P5).
const occlusion = reviewQuery('occlusion') === 'on';
// Review builds: `?material=coverage` swaps soft edges to alpha-to-coverage, to compare on the Quest.
if (reviewQuery('material') === 'coverage') useMaterialConfig('coverage');
const baseXr = projectOptions.xr || {};
const worldOptions = occlusion ? { ...projectOptions, xr: { ...baseXr, features: { ...baseXr.features, depthSensing: true } } } : projectOptions;

World.create(document.getElementById('scene-container') as HTMLDivElement, worldOptions).then((world) => {
  document.documentElement.dataset.contract = String(CONTRACT_VERSION);
  // Painted line work needs more pixels than the browser's default, and this scene is cheap to draw.
  world.renderer.xr.setFramebufferScaleFactor(FRAMEBUFFER_SCALE);
  reportTelemetry(world);
  setLandingState({ kind: 'loading', share: 0 });
  // Review checks that need the opening from the top skip any checkpoint.
  const fresh = reviewQuery('inject') !== null || reviewQuery('review') !== null || reviewQuery('cue') !== null;
  prepare(world)
    .then((show) => {
      const series = show.manifest.libraryVersion;
      /** This build holds chapter 1 only (lane B's loadChapter brings the rest). */
      const thisChapter = 1;
      const saved = fresh ? null : readCheckpoint(localStorage, Date.now(), { seriesId: series, episodeId: show.assets.spine.id });
      const choice = landingChoice(readProgress(localStorage, series), saved !== null);
      // Two ways in, side by side: the book's chapters, and the AI Storyteller. One page load runs one of them;
      // choosing the other after playing reloads the page cleanly first.
      let ranMode: 'chapter' | 'story' | null = null;
      const begin = (resume: boolean, mode: 'chapter' | 'story' = 'chapter'): boolean => {
        if (ranMode && ranMode !== mode) {
          // The other mode needs a fresh page load: kept as the destination, so the reloaded page opens it in one tap.
          chooseEntry(mode === 'story' ? { kind: 'storyteller' } : { kind: 'chapter', n: thisChapter, from: resume ? 'resume' : 'start' }, ranMode === 'story' ? { kind: 'storyteller' } : { kind: 'chapter', n: thisChapter, from: 'resume' });
          location.reload();
          return false;
        }
        if (ranMode) {
          // Back from the landing page with the chapter already open: starting again resets it as "Read it again" does.
          if (mode === 'chapter' && !resume) show.readAgain.requested = true;
          return true;
        }
        // The mode counts as running only once it has started: a failed start can be tapped again.
        try {
          if (mode === 'story') run(world, show, null, { kind: 'storyteller' });
          else {
            if (!resume) clearCheckpoint(localStorage);
            run(world, show, resume ? saved : null, null);
          }
        } catch (cause) {
          reportError('run', cause);
          setLandingState({ kind: 'failed' });
          return false;
        }
        ranMode = mode;
        return true;
      };
      const ran = () => ranMode !== null;
      if (occlusion) {
        world.registerSystem(DepthSensingSystem);
        world.createTransformEntity(show.stage.root).addComponent(DepthOccludable);
      }
      const enterRoom = show.room
        ? (mode: 'chapter' | 'story' = 'chapter') => {
            if (!begin(mode === 'story' ? false : ranMode === 'chapter' ? !show.runtime.ended : choice.resume, mode)) return;
            show.sound.unlock();
            world.launchXR({ sessionMode: SessionMode.ImmersiveVR });
          }
        : null;
      // Without AR (no passthrough), the book opens in the painted room.
      let arSupported = true;
      const enter = (resume = choice.resume, mode: 'chapter' | 'story' = 'chapter') => {
        if (!arSupported && enterRoom) {
          enterRoom(mode);
          return;
        }
        if (!begin(resume, mode)) return;
        show.sound.unlock();
        world.launchXR();
      };
      /**
       * Where the reader asked to go from inside the book (or the page), kept across putting the book away
       * and a reload. This page load prepared the book for it, so one tap opens it once any prerequisite
       * (the microphone, for the Storyteller) is met. This build holds chapter 1 only.
       */
      let entry: Entry | null = pendingEntry();
      let entryProblem: string | null = null;
      if (entry?.target.kind === 'chapter' && entry.target.n !== thisChapter) {
        entryProblem = `Chapter ${entry.target.n} couldn't open.`;
        cancelEntry();
        entry = null;
      } else if (entry) prepareEntry();
      const backLabel = (back: Entry['back']): string => (back?.kind === 'storyteller' ? 'Back to the AI Storyteller' : `Back to chapter ${back?.kind === 'chapter' ? back.n : thisChapter}`);
      /** The one button speaks for the library (the agreed seam), or for the waiting entry. */
      const current = (): { label: string; detail: string; restartLabel: string | null; resume: boolean; mode: 'chapter' | 'story' } => {
        if (entry?.target.kind === 'storyteller') return { label: 'Open the AI Storyteller', detail: 'You talk to the characters out loud, and the story is made up as you go.', restartLabel: null, resume: false, mode: 'story' };
        if (entry?.target.kind === 'chapter') {
          const resume = entry.target.from === 'resume';
          return { label: `${resume ? 'Continue' : 'Open'} chapter ${entry.target.n}`, detail: 'About six minutes. You only need your hands.', restartLabel: null, resume, mode: 'chapter' };
        }
        const p = primaryLabel(readLibrary(localStorage));
        const resume = p.target.kind === 'chapter' && p.target.from === 'resume';
        return { label: p.label, detail: entryProblem ? `${entryProblem} ${p.detail}` : p.detail, restartLabel: p.secondary, resume, mode: 'chapter' };
      };
      /**
       * The AI Storyteller needs your voice, so its door asks for the microphone first, on this page (a first
       * prompt inside VR has ended the session). Entering VR needs a fresh tap, so once you've allowed it the
       * door says so and opens on the next tap.
       */
      let micState: PermissionState | 'unknown' = 'unknown';
      void navigator.permissions?.query({ name: 'microphone' as PermissionName }).then((p) => {
        micState = p.state;
        p.onchange = () => {
          micState = p.state;
          if (world.visibilityState.value === VisibilityState.NonImmersive) setLandingState(ready());
        };
        if (world.visibilityState.value === VisibilityState.NonImmersive) setLandingState(ready());
      }).catch(() => undefined);
      const storyDoorLabel = () =>
        ranMode === 'story'
          ? 'Back to the AI Storyteller'
          : micState === 'granted'
            ? 'Or make up a story with the AI Storyteller'
            : micState === 'denied'
              ? 'The AI Storyteller needs your voice: allow the microphone in the browser’s site settings'
              : 'Or make up a story with the AI Storyteller (it will ask for your microphone)';
      const openStoryteller = () => {
        if (micState === 'granted') {
          enter(false, 'story');
          return;
        }
        void askForMicrophone(navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices)).then((answer) => {
          micState = answer === 'granted' ? 'granted' : 'denied';
          if (answer === 'granted') {
            // Straight in. If the browser wants a fresh tap for VR, the door is ready for it.
            setLandingState({ ...(ready() as Extract<LandingState, { kind: 'ready' }>), storyteller: { label: 'Open the AI Storyteller', run: () => enter(false, 'story') } });
            enter(false, 'story');
          } else setLandingState(ready());
        });
      };
      const ready = (): LandingState => {
        const now = current();
        const waiting = entry;
        return {
          kind: 'ready',
          open: () => (now.mode === 'story' ? openStoryteller() : enter(now.resume)),
          openRoom: arSupported && enterRoom ? () => enterRoom(now.mode) : null,
          label: now.mode === 'story' && micState !== 'granted' ? 'Let them hear you' : now.label,
          detail: now.detail,
          restart: waiting?.back
            ? {
                label: backLabel(waiting.back!),
                run: () => {
                  // Back to where you were: that becomes the page's destination, kept like any other choice.
                  const back = cancelEntry();
                  entry = null;
                  if (back) {
                    chooseEntry(back, null);
                    const backMode = back.kind === 'storyteller' ? 'story' : 'chapter';
                    // The other mode already ran on this page load: a fresh load prepares the one you're going back to.
                    if (ranMode && ranMode !== backMode) {
                      location.reload();
                      return;
                    }
                    prepareEntry();
                    entry = pendingEntry();
                  }
                  setLandingState(ready());
                },
              }
            : now.restartLabel
              ? { label: now.restartLabel, run: () => enter(false) }
              : null,
          storyteller: STORYTELLER_AVAILABLE ? { label: storyDoorLabel(), run: openStoryteller, byHand: () => enter(false, 'story') } : null,
          // Your book's shelf: exactly this chapter, from where it says, whatever else is waiting.
          openChapter: (n, from) => {
            if (n !== thisChapter) {
              chooseEntry({ kind: 'chapter', n, from }, null);
              location.reload();
              return;
            }
            cancelEntry();
            entry = null;
            if (ranMode === 'story') {
              chooseEntry({ kind: 'chapter', n, from }, null);
              location.reload();
              return;
            }
            enter(from === 'resume', 'chapter');
          },
        };
      };
      void navigator.xr
        ?.isSessionSupported('immersive-ar')
        .then((supported) => {
          arSupported = supported;
          if (world.visibilityState.value === VisibilityState.NonImmersive) setLandingState(ready());
        })
        .catch(() => undefined);
      setLandingState(ready());
      world.visibilityState.subscribe((state) => {
        // An XR session started some other way (the browser's own prompt, the emulator) takes the button's default.
        if (state !== VisibilityState.NonImmersive && !ran()) begin(current().resume, current().mode);
        // Inside, the mode it asked for has started: the choice is done.
        if (state !== VisibilityState.NonImmersive && entry && ran()) {
          consumeEntry();
          entry = null;
        }
        if (state === VisibilityState.NonImmersive && ranMode) {
          // Put away to go somewhere else: a choice for the other mode needs a fresh page load, made now,
          // so the next tap opens it straight away.
          const next = pendingEntry();
          if (next && (next.target.kind === 'storyteller') !== (ranMode === 'story')) {
            location.reload();
            return;
          }
          entry = next;
        }
        setLandingState(state === VisibilityState.NonImmersive ? ready() : { kind: 'inside' });
      });
    })
    .catch((cause: unknown) => {
      reportError('stage', cause);
      setLandingState({ kind: 'failed' });
    });
});
