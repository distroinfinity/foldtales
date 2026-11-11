import { World } from '@iwsdk/core';
import { CONTRACT_VERSION } from '@tabletop/contracts/version';
import projectOptions from 'virtual:iwsdk-project';
import { createBackendAccess, withDeadline } from './backend.ts';
import { loadPuppet, type StageConfig } from './puppet/puppet.ts';
import { startPlacement } from './stage/placement-runtime.ts';
import { createTelemetry } from './telemetry.ts';

const FLUSH_EVERY_MS = 10_000;
const MAX_ERROR_LENGTH = 500;

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

function reportTelemetry(world: World): void {
  addEventListener('error', (event) => reportError('window', event.message));
  addEventListener('unhandledrejection', (event) => reportError('promise', event.reason));
  setInterval(() => void telemetry.flush(), FLUSH_EVERY_MS);
  document.addEventListener('visibilitychange', () => void telemetry.flush());

  let session: XRSession | undefined;
  world.onXRFrame((frame, delta) => {
    if (frame.session !== session) {
      session = frame.session;
      telemetry.record({ kind: 'session', xrMode: 'ar', device: navigator.userAgent.slice(0, 120), passthrough: session.environmentBlendMode === 'alpha-blend' });
    }
    telemetry.frame(delta * 1000, world.renderer.info.render);
  });
}

async function loadStage(world: World): Promise<void> {
  const response = await fetch('./stage.json');
  if (!response.ok) throw new Error(`stage.json answered ${response.status}`);
  const stage = (await response.json()) as StageConfig;
  const puppet = await loadPuppet(`./art/${stage.cast}`, stage);
  puppet.root.visible = false;
  world.scene.add(puppet.root);
  world.onXRFrame((_frame, _delta, time) => puppet.update(time));
  startPlacement(world, puppet.root, (surface) => {
    telemetry.record({ kind: 'stage_fit', surface, widthM: 0, scale: 1 });
    document.documentElement.dataset.placement = surface;
  });
}

World.create(document.getElementById('scene-container') as HTMLDivElement, projectOptions).then((world) => {
  document.documentElement.dataset.contract = String(CONTRACT_VERSION);
  reportTelemetry(world);
  loadStage(world).catch((cause: unknown) => reportError('stage', cause));
});
