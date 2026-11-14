import { InstancedBufferAttribute, InstancedMesh, Matrix4, NormalBlending, PlaneGeometry, ShaderMaterial, Vector3, type Object3D } from '@iwsdk/core';
import type { Lasting } from './state.ts';

/**
 * Fireflies leave the page. Small, and dark most of the time: each glows up slowly, holds, and
 * fades, on its own rhythm, so only a few are lit at once, like breathing. They wander lazily about
 * the room near the book at different heights, and drift over to a hand held up near them; take it
 * away and they wander off again. Called off, they sink back into the page. One draw for all.
 * (Owner, Nov 15: the first version was too big, too even and always on.)
 */

const COUNT = 26;
const RISE_MS = 3000;
const SINK_MS = 2500;
/** How near a raised hand must come for them to notice it. */
const NOTICE_M = 0.9;
/** On screen size of a glow, metres: small, a point of light with a soft halo. */
const SIZE_M = 0.024;

interface Fly {
  at: Vector3;
  vel: Vector3;
  /** Where on the page it comes from, in the book's frame. */
  home: Vector3;
  /** Its own spot in the air about the book: angle, distance out, height above the table. */
  angle: number;
  out: number;
  up: number;
  /** Its own slow wander. */
  freq: [number, number, number];
  phase: number;
  /** Its breath: seconds per cycle, and where in it it starts. */
  period: number;
  offset: number;
}

/** Deterministic spread, so a firefly is the same one every evening. */
const hash = (n: number): number => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** A firefly's breath: dark, a slow glow up, a short hold, a slower fade, dark again. */
function breath(seconds: number): number {
  if (seconds < 0.8) {
    const u = seconds / 0.8;
    return u * u * (3 - 2 * u);
  }
  if (seconds < 1.1) return 1;
  if (seconds < 2.4) {
    const u = (seconds - 1.1) / 1.3;
    return (1 - u) * (1 - u);
  }
  return 0;
}

export interface Fireflies {
  mesh: InstancedMesh;
  frame(opts: { state: Lasting; deltaMs: number; nowMs: number; bookOpen: boolean; bookRoot: Object3D; pageY: number; hands: Array<Vector3 | null>; onRise: (at: Vector3) => void }): void;
}

export function createFireflies(): Fireflies {
  const material = new ShaderMaterial({
    uniforms: { uSize: { value: SIZE_M } },
    vertexShader: /* glsl */ `
      attribute float aBright;
      varying vec2 vUv;
      varying float vBright;
      uniform float uSize;
      void main() {
        vUv = uv;
        vBright = aBright;
        vec4 centre = viewMatrix * vec4(instanceMatrix[3].xyz, 1.0);
        centre.xy += position.xy * uSize;
        gl_Position = projectionMatrix * centre;
      }`,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      varying float vBright;
      void main() {
        float d = distance(vUv, vec2(0.5)) * 2.0;
        // A tiny pale core in a soft yellow-green gold halo.
        float halo = exp(-d * d * 7.0) * 0.55;
        float core = smoothstep(0.22, 0.0, d);
        vec3 light = (vec3(0.78, 0.86, 0.36) * halo + vec3(1.0, 0.97, 0.72) * core) * vBright;
        // Premultiplied, with alpha only where it glows: over passthrough, alpha decides what shows through.
        float a = clamp(max(light.r, max(light.g, light.b)), 0.0, 1.0);
        if (a < 0.004) discard;
        gl_FragColor = vec4(light, a);
      }`,
    transparent: true,
    depthWrite: false,
    blending: NormalBlending,
    premultipliedAlpha: true,
    toneMapped: false,
  });
  const mesh = new InstancedMesh(new PlaneGeometry(1, 1), material, COUNT);
  mesh.name = 'fireflies';
  mesh.frustumCulled = false;
  mesh.visible = false;
  mesh.renderOrder = 500;
  const bright = new Float32Array(COUNT);
  mesh.geometry.setAttribute('aBright', new InstancedBufferAttribute(bright, 1));

  const flies: Fly[] = Array.from({ length: COUNT }, (_, i) => ({
    at: new Vector3(),
    vel: new Vector3(),
    home: new Vector3((hash(i) - 0.5) * 0.3, 0, (hash(i + 50) - 0.5) * 0.2),
    angle: hash(i + 100) * Math.PI * 2,
    out: 0.2 + 0.75 * hash(i + 150),
    up: 0.08 + 0.6 * hash(i + 200),
    freq: [0.05 + 0.09 * hash(i + 250), 0.04 + 0.08 * hash(i + 300), 0.06 + 0.1 * hash(i + 350)],
    phase: hash(i + 400) * 100,
    period: 3.2 + 3.6 * hash(i + 450),
    offset: hash(i + 500) * 7,
  }));
  const matrix = new Matrix4();
  const goal = new Vector3();
  const centre = new Vector3();
  const homeWorld = new Vector3();
  const tmp = new Vector3();
  let wasOn = false;
  let changedAt = -Infinity;

  return {
    mesh,
    frame({ state, deltaMs, nowMs, bookOpen, bookRoot, pageY, hands, onRise }) {
      if (state.on !== wasOn) {
        wasOn = state.on;
        changedAt = nowMs - state.sinceMs;
        if (state.on) {
          // Each starts on the page.
          for (const f of flies) {
            f.at.copy(f.home).setY(pageY);
            bookRoot.localToWorld(f.at);
            f.vel.set(0, 0, 0);
          }
          if (state.sinceMs < 500) onRise(bookRoot.getWorldPosition(tmp));
        }
      }
      const since = nowMs - changedAt;
      const amount = (state.on ? Math.min(1, since / RISE_MS) : 1 - Math.min(1, since / SINK_MS)) * (bookOpen ? 1 : 0);
      if (amount <= 0.001) {
        mesh.visible = false;
        return;
      }
      mesh.visible = true;
      const dt = Math.min(0.05, deltaMs / 1000);
      const t = nowMs / 1000;

      bookRoot.getWorldPosition(centre);
      const tableY = centre.y;
      // A hand held up, off the table, and near enough: not one resting by the book.
      let follow: Vector3 | null = null;
      for (const h of hands) {
        if (!h || h.y < tableY + 0.12) continue;
        const d = Math.hypot(h.x - centre.x, h.z - centre.z);
        if (d < NOTICE_M && (!follow || d < Math.hypot(follow.x - centre.x, follow.z - centre.z))) follow = h;
      }

      flies.forEach((f, i) => {
        homeWorld.copy(f.home).setY(pageY);
        bookRoot.localToWorld(homeWorld);
        if (!state.on) goal.copy(homeWorld);
        else {
          // Each keeps to its own spot in the air and wanders lazily round it.
          const [a, b, c] = f.freq;
          const wander = 0.16;
          if (follow) {
            // Near your hand, loosely: a few centimetres to a hand's width away.
            const r = 0.08 + 0.14 * hash(i + 600);
            goal.set(follow.x + Math.cos(f.angle + t * a) * r, follow.y + (hash(i + 650) - 0.4) * 0.12, follow.z + Math.sin(f.angle + t * a) * r);
          } else {
            goal.set(centre.x + Math.cos(f.angle) * f.out, tableY + f.up, centre.z + Math.sin(f.angle) * f.out);
          }
          const k = follow ? 0.3 : 1;
          goal.x += wander * Math.sin(t * a * 6.283 + f.phase) * k;
          goal.y += wander * 0.5 * Math.sin(t * b * 6.283 + f.phase * 1.3) * k;
          goal.z += wander * Math.sin(t * c * 6.283 + f.phase * 0.7) * k;
        }
        // A soft spring with heavy drag: they drift and hover, never dart.
        tmp.copy(goal).sub(f.at).multiplyScalar(follow ? 0.9 : 0.5);
        f.vel.addScaledVector(tmp, dt).multiplyScalar(Math.pow(0.25, dt));
        const speed = f.vel.length();
        if (speed > 0.18) f.vel.multiplyScalar(0.18 / speed);
        f.at.addScaledVector(f.vel, dt);
        matrix.makeTranslation(f.at.x, f.at.y, f.at.z);
        mesh.setMatrixAt(i, matrix);
        // Dark most of the time, then a slow breath of light.
        bright[i] = amount * (0.03 + 0.97 * breath((t + f.offset) % f.period));
      });
      mesh.instanceMatrix.needsUpdate = true;
      (mesh.geometry.getAttribute('aBright') as InstancedBufferAttribute).needsUpdate = true;
    },
  };
}
