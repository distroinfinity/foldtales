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
import { landingChoice, readProgress, STORYTELLER_AVAILABLE, writeProgress, type EnterTarget } from './show/progress.ts';
import { createObjectHands } from './objects/hands.ts';
import type { RuntimeSnapshot } from './show/runtime.ts';
import { createShowClock } from './show/clock.ts';
import { createShowLog, indexedDbLogStore } from './show/log.ts';
import { libraryOf, ShowManifest } from './show/manifest.ts';
import { BackendError, estimateSpeechMs, linesOf, type ReadyBeat, type ShowObject } from '@tabletop/contracts';
import { createDirector } from './director/director.ts';
import { ChapterCanon, recordChapterEnd } from './memory/memory.ts';
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
import { createWristMenu } from './stage/wrist.ts';
import { createLiveScheduler } from './storyteller/live.ts';
import { createStorySession, type StorySession } from './storyteller/session.ts';
import { createEars } from './storyteller/ears.ts';
import { createTalkTab } from './stage/talk.ts';
import { createKeepsakes } from './storyteller/keepsakes.ts';
import type { ExtraTarget } from './stage/controls.ts';
import { presentCast } from './director/director.ts';
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
  /** Other things the hands can take, added by a mode (the Storyteller's "Hold to talk"). */
  const moreTargets: Array<() => ExtraTarget[]> = [];
  /** "Put the book away" from the wrist: the book closes, then the session ends. */
  const away = { requested: false };
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
    extras: () => [...hands.targets(), ...moreTargets.flatMap((f) => f())],
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
  const wrist = createWristMenu({
    parent: world.scene,
    sound,
    paused: () => controls.ribbonUp,
    choose: (choice) => {
      if (choice === 'pause' || choice === 'resume') controls.setRibbon(choice === 'pause');
      else if (choice === 'restart') readAgain.requested = true;
      else away.requested = true;
    },
  });
  return { manifest, assets, stage, dim, sound, clock, runtime, wash, ember, log, pause, controls, soft, review, room, sizing, tableTop, hands, readAgain, initialObjects, director, answers, showObjects, wrist, away, canonData, defs, directorOn, storyConfig, moreTargets };
}

function run(world: World, show: Awaited<ReturnType<typeof prepare>>, resumeFrom: Checkpoint | null, target: EnterTarget | null = null): void {
  const { manifest, assets, stage, sound, clock, runtime, wash, ember, log, pause, controls, room, sizing, tableTop, hands, readAgain, initialObjects, director, answers, showObjects, wrist, away, canonData, defs, storyConfig, moreTargets } = show;
  // The AI Storyteller, when that's the door the reader chose on the landing page.
  const storyMode = target?.kind === 'storyteller' && storyConfig !== null;
  let story: StorySession | null = null;
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
              if (event.kind === 'error' && event.code === 'unauthorized' && attempt === 0) {
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
      room: () => [],
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
      onPaint: (job) => void collectPainting(job, session),
      onAcknowledge: (who) => sound.play('interested', stage.puppets.get(who)?.root.getWorldPosition(new Vector3())),
      // A guest can't use the AI Storyteller: said plainly, printed on the page, never as an error.
      onError: (code, message) => {
        if (code === 'unauthorized' && /sign in/i.test(message)) storyHint.blocked = 'Sign in on the page outside the book to talk with them.';
        else if (code === 'upstream_failed' && /could not be reached/.test(message)) storyHint.blocked = 'No internet connection. The AI Storyteller needs the internet.';
        else return;
        runtime.setHint(storyHint.blocked);
      },
    });
    story = session;
  };
  /** A painting the story asked for: wait for it, upload it out of sight, then it appears on the page and the story is told. */
  async function collectPainting(job: { jobId: string; objectId: string }, session: StorySession | null): Promise<void> {
    const deadline = performance.now() + 75_000;
    while (performance.now() < deadline) {
      await new Promise((r) => setTimeout(r, 2500));
      if (story !== session) return; // A new evening began meanwhile.
      const result = await storyAccess.withBackend((api) => api.paintResult({ jobId: job.jobId })).catch(() => null);
      if (!result || result.status === 'pending') continue;
      if (result.status === 'failed') {
        console.info(`storyteller: the painting didn't come (${result.reason})`);
        return;
      }
      const def = { ...result.object, id: job.objectId };
      if (def.art.kind !== 'url') return;
      const texture = await new TextureLoader().loadAsync(def.art.url).catch(() => null);
      if (!texture || story !== session) return;
      texture.colorSpace = SRGBColorSpace;
      const ref = wholeRef(texture);
      defs.set(def.id, def);
      stage.objects.add(def, ref, { kind: 'page', at: [0.035, 0, 0.055] });
      world.renderer.initTexture(texture);
      sound.play('chime', stage.book.root.getWorldPosition(new Vector3()), undefined, 'ui');
      // Everything painted for you is yours to keep: it goes in your satchel for every evening after.
      void keepsakes.keep(def);
      session?.arrived(def.id);
      return;
    }
  }
  /** A new evening: a fresh session, and what you kept from earlier evenings back in your satchel. */
  function beginStory(): void {
    startStorySession();
    satchelSeen.clear();
    fromSatchel.clear();
    void bringKeepsakes(story);
  }
  async function bringKeepsakes(session: StorySession | null): Promise<void> {
    for (const k of await keepsakes.list()) {
      if (story !== session) return;
      if (stage.objects.get(k.def.id) || k.def.art.kind !== 'url') continue;
      const texture = await new TextureLoader().loadAsync(k.def.art.url).catch(() => null);
      if (!texture || story !== session || stage.objects.get(k.def.id)) continue;
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
  if (storyMode) beginStory();
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
    const space = world.xrReferenceSpace;
    if (space && runtime.started) wrist.frame(frame, space, head);
    // While the wrist's tags are open, your hands are choosing there, not taking hold of the book.
    controls.frame(frame, deltaMs, runtime.started && (!arrival || arrival.opened) && !wrist.open, head);
    if (inject && injected < 3 && clock.ms > 2000) {
      injected++;
      throw new Error('injected frame error');
    }
  });

  let wasEnded = runtime.ended;
  const storyStep = guard('runtime', (deltaMs: number) => {
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
        controls.lowerRibbon();
        controls.reopen();
        story!.open();
      } else {
        readAgain.requested = false;
        runtime.reset(initialObjects);
        startEpisode();
        controls.lowerRibbon();
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
    const canTalk = story !== null && runtime.started && !clock.paused && controls.amount > 0.98;
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
        recordChapterEnd(log.append, canonData, played, kept, defs, sets.map((id) => `sets/${id}/ground.png`));
      }
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
      const saved = fresh ? null : readCheckpoint(localStorage, Date.now(), { seriesId: series, episodeId: show.assets.spine.id });
      const choice = landingChoice(readProgress(localStorage, series), saved !== null);
      // Two ways in, side by side: the book's chapters, and the AI Storyteller. One page load runs one of them;
      // choosing the other after playing reloads the page cleanly first.
      let ranMode: 'chapter' | 'story' | null = null;
      const begin = (resume: boolean, mode: 'chapter' | 'story' = 'chapter'): boolean => {
        if (ranMode && ranMode !== mode) {
          location.reload();
          return false;
        }
        if (ranMode) {
          // Back from the landing page with the chapter already open: starting again resets it as "Read it again" does.
          if (mode === 'chapter' && !resume) show.readAgain.requested = true;
          return true;
        }
        ranMode = mode;
        if (mode === 'story') run(world, show, null, { kind: 'storyteller' });
        else {
          if (!resume) clearCheckpoint(localStorage);
          run(world, show, resume ? saved : null, null);
        }
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
      // Once the chapter has run, the landing page speaks for where it is now, not where it was at load.
      const current = () => (ranMode === 'chapter' ? (show.runtime.ended ? { label: 'Read chapter 1 again', restartLabel: null, resume: false } : { label: 'Continue chapter 1', restartLabel: 'Start from the beginning', resume: true }) : choice);
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
        return {
          kind: 'ready',
          open: () => enter(now.resume),
          openRoom: arSupported && enterRoom ? () => enterRoom() : null,
          label: now.label,
          restart: now.restartLabel ? { label: now.restartLabel, run: () => enter(false) } : null,
          storyteller: STORYTELLER_AVAILABLE ? { label: storyDoorLabel(), run: openStoryteller } : null,
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
        if (state !== VisibilityState.NonImmersive && !ran()) begin(choice.resume);
        setLandingState(state === VisibilityState.NonImmersive ? ready() : { kind: 'inside' });
      });
    })
    .catch((cause: unknown) => {
      reportError('stage', cause);
      setLandingState({ kind: 'failed' });
    });
});
