import { DepthOccludable, DepthSensingSystem, Group, SessionMode, Vector3, VisibilityState, World } from '@iwsdk/core';
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
import { buildDim } from './light/dim.ts';
import { loadStageAssets, uploadAll } from './paint/assets.ts';
import { makeSoftPieces } from './paint/soft.ts';
import { CHECKPOINT_VERSION, clearCheckpoint, readCheckpoint, writeCheckpoint, type Checkpoint } from './show/checkpoint.ts';
import { landingChoice, readProgress, writeProgress } from './show/progress.ts';
import { createObjectHands } from './objects/hands.ts';
import type { RuntimeSnapshot } from './show/runtime.ts';
import { createShowClock } from './show/clock.ts';
import { createShowLog, indexedDbLogStore } from './show/log.ts';
import { ShowManifest } from './show/manifest.ts';
import { createPauseControl } from './show/pause.ts';
import { createShowRuntime } from './show/runtime.ts';
import { createSoundEngine } from './sound/engine.ts';
import narratorVoice from '../../art/voice/narrator.json';
import { arrivalAt, OPEN_AT_MS } from './stage/arrival.ts';
import { buildStage } from './stage/build.ts';
import { createBookControls } from './stage/controls.ts';
import { reviewOverride } from './stage/review.ts';
import { createFrameGuard } from './stage/frame-guard.ts';
import { startPlacement } from './stage/placement-runtime.ts';
import { createSessionFlow } from './stage/session-flow.ts';
import { minTextSizeM, settleOnTable } from './stage/sizing.ts';
import { warmUp } from './stage/warm-up.ts';
import { buildEmber, buildWash } from './stage/wash.ts';
import { createTelemetry } from './telemetry.ts';

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
  const runtime = createShowRuntime({
    manifest,
    spine: assets.spine,
    defs,
    moods: assets.set.moods,
    views: { stageRoot: stage.root, book: stage.book, puppets: stage.puppets, actors: stage.actors, heads: stage.heads, dim, leaves: stage.leaves, caption: stage.caption, endPage: stage.endPage, sound, objects: stage.objects, drawer: stage.drawer, satchel: stage.satchel, spark: stage.spark, spans: stage.spans },
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
  const sizing: { userScale: number | null } = { userScale: null };
  /** The scanned table under the book, for settling things you let go of. */
  const tableTop: { outline: Array<{ x: number; z: number }> | null } = { outline: null };
  const readAgain = { requested: false };
  const hands = createObjectHands({
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
  const controls = createBookControls({
    world,
    stageRoot: stage.root,
    book: stage.book,
    sound,
    pause,
    glow: soft.glow,
    cards: stage.book.cards.length,
    onMoved: () => undefined,
    extras: () => hands.targets(),
    onGazeSelect: (origin, direction) => hands.gazeSelect(origin, direction),
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
  // Review builds only: `?cue=beam` plays the lighthouse beam once the opening has finished, for P5.
  const devCue = reviewQuery('cue');
  if (devCue && manifest.cues.some((c) => c.id === devCue)) runtime.addCue(devCue, 11_500);
  return { manifest, assets, stage, dim, sound, clock, runtime, wash, ember, log, pause, controls, soft, review, room, sizing, tableTop, hands, readAgain, initialObjects };
}

function run(world: World, show: Awaited<ReturnType<typeof prepare>>, resumeFrom: Checkpoint | null): void {
  const { manifest, assets, stage, sound, clock, runtime, wash, ember, log, pause, controls, room, sizing, tableTop, hands, readAgain, initialObjects } = show;
  const series = manifest.libraryVersion;
  // Review builds only: `?speed=4` runs the show four times faster, to walk a whole episode in the emulator.
  const speed = Math.max(0.25, Math.min(16, Number(reviewQuery('speed') ?? 1) || 1));
  const head = new Vector3();
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
    if (!runtime.started) return;
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
    vr = session.environmentBlendMode === 'opaque' && !!room;
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

  let wasEnded = runtime.ended;
  const storyStep = guard('runtime', (deltaMs: number) => {
    // Read it again: the book closes under your hand, then the story opens from the top.
    if (readAgain.requested) {
      if (controls.amount > 0.001) controls.close();
      else {
        readAgain.requested = false;
        runtime.reset(initialObjects);
        clearCheckpoint(localStorage);
        writeProgress(localStorage, { seriesId: series, chapter: 1, state: 'started' });
        log.append('beat.started', { beatId: assets.spine.scenes[0]!.entry, fallback: null });
        controls.reopen();
        wasEnded = false;
      }
    }
    const { unfold } = runtime.frame(deltaMs * speed, nowMs, head, { fold: controls.fold(), ribbon: controls.ribbonLift() }, { left: controls.pinchPoint('left'), right: controls.pinchPoint('right') });
    unfoldDim = unfold.dim;
    // The book's own pull hides while the drawer is out: it rides on the drawer's front then.
    const bookPull = stage.book.root.getObjectByName('drawer-pull');
    if (bookPull) bookPull.visible = runtime.drawerAmount < 0.02;
    for (const e of runtime.drain()) {
      if (e.type === 'beat.started') log.append('beat.started', { beatId: e.beatId, fallback: null });
      else if (e.type === 'beat.completed') log.append('beat.completed', { beatId: e.beatId });
      else if (e.type === 'problem.opened' && e.opensDrawer) log.append('drawer.opened', { by: 'beat' });
      lastCheckpointMs = -Infinity;
    }
    if (runtime.ended && !wasEnded) {
      wasEnded = true;
      writeProgress(localStorage, { seriesId: series, chapter: 1, state: 'finished' });
      checkpoint();
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
        writeProgress(localStorage, { seriesId: series, chapter: 1, state: 'started' });
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
  world.visibilityState.subscribe((state) => {
    if (state === VisibilityState.NonImmersive) {
      if (flow.end(runtime.started).pause) pause.set('headset_off', true);
    } else {
      pause.set('headset_off', state !== VisibilityState.Visible);
    }
    checkpoint();
  });
  addEventListener('pagehide', checkpoint);

  if (REVIEW_HOOKS) Object.assign(window, { __tt: { world, show, guard } });
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
      const saved = fresh ? null : readCheckpoint(localStorage, Date.now(), { seriesId: series, episodeId: show.assets.spine.id });
      const choice = landingChoice(readProgress(localStorage, series), saved !== null);
      // You choose on the landing page: continue where you were, or start from the beginning.
      let ran = false;
      const begin = (resume: boolean) => {
        if (ran) return;
        ran = true;
        if (!resume) clearCheckpoint(localStorage);
        run(world, show, resume ? saved : null);
      };
      if (occlusion) {
        world.registerSystem(DepthSensingSystem);
        world.createTransformEntity(show.stage.root).addComponent(DepthOccludable);
      }
      const enterRoom = show.room
        ? () => {
            begin(choice.resume);
            show.sound.unlock();
            world.launchXR({ sessionMode: SessionMode.ImmersiveVR });
          }
        : null;
      // Without AR (no passthrough), the book opens in the painted room.
      let arSupported = true;
      const enter = (resume = choice.resume) => {
        begin(resume);
        if (!arSupported && enterRoom) {
          enterRoom();
          return;
        }
        show.sound.unlock();
        world.launchXR();
      };
      const restart = choice.restartLabel ? { label: choice.restartLabel, run: () => enter(false) } : null;
      const ready = (): LandingState => ({ kind: 'ready', open: () => enter(), openRoom: arSupported ? enterRoom : null, label: choice.label, restart });
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
        if (state !== VisibilityState.NonImmersive) begin(choice.resume);
        setLandingState(state === VisibilityState.NonImmersive ? ready() : { kind: 'inside' });
      });
    })
    .catch((cause: unknown) => {
      reportError('stage', cause);
      setLandingState({ kind: 'failed' });
    });
});
