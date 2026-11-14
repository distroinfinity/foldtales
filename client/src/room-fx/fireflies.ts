import { InstancedBufferAttribute, NormalBlending, InstancedMesh, Matrix4, PlaneGeometry, ShaderMaterial, Vector3, type Object3D, type Texture } from '@iwsdk/core';
import type { Lasting } from './state.ts';

/**
 * Fireflies leave the page. Warm glows (the lantern's own) rise off the book, drift about the room
 * near it, and gather round your hand when you hold it out; take it away and they wander again.
 * Called off, they sink back into the page. One draw for all of them.
 */

const COUNT = 24;
const RISE_MS = 3000;
const SINK_MS = 2000;
/** How near a hand must come to the swarm for them to notice it. */
const NOTICE_M = 0.9;

interface Fly {
  at: Vector3;
  vel: Vector3;
  /** Where on the page it comes from, in the book's frame. */
  home: Vector3;
  /** Its own orbit round whatever it's following. */
  orbit: Vector3;
  phase: number;
  speed: number;
}

export interface Fireflies {
  mesh: InstancedMesh;
  frame(opts: { state: Lasting; deltaMs: number; nowMs: number; bookOpen: boolean; bookRoot: Object3D; pageY: number; hands: Array<Vector3 | null>; onRise: (at: Vector3) => void }): void;
}

export function createFireflies(glow: Texture): Fireflies {
  const material = new ShaderMaterial({
    uniforms: { uMap: { value: glow }, uSize: { value: 0.05 } },
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
      uniform sampler2D uMap;
      varying vec2 vUv;
      varying float vBright;
      void main() {
        vec4 c = texture2D(uMap, vUv);
        // A hot little core inside the lantern's soft glow.
        float core = smoothstep(0.18, 0.0, distance(vUv, vec2(0.5)));
        // Premultiplied, with alpha only where it glows: over passthrough, alpha decides what shows through.
        vec3 light = (c.rgb * c.a + vec3(1.0, 0.92, 0.7) * core) * vBright;
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

  const flies: Fly[] = Array.from({ length: COUNT }, (_, i) => {
    const a = (i / COUNT) * Math.PI * 2;
    return {
      at: new Vector3(),
      vel: new Vector3(),
      home: new Vector3(Math.cos(a * 3.1) * 0.15, 0, Math.sin(a * 1.7) * 0.1),
      orbit: new Vector3(Math.cos(a), Math.sin(a * 2.3) * 0.6, Math.sin(a)).multiplyScalar(0.06 + 0.1 * ((i * 7) % 5) / 5),
      phase: i * 1.37,
      speed: 0.8 + ((i * 13) % 7) / 10,
    };
  });
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
      const scale = bookRoot.getWorldScale(tmp).x || 1;
      material.uniforms.uSize!.value = 0.045 * Math.max(0.8, scale);
      const dt = Math.min(0.05, deltaMs / 1000);
      const t = nowMs / 1000;

      // Above the book they wander; a hand held out near them, they follow.
      bookRoot.getWorldPosition(centre).add(tmp.set(0, 0.35 + 0.08 * Math.sin(t * 0.3), 0));
      let follow: Vector3 | null = null;
      // A hand held up, off the table, and near enough: not one resting by the book.
      const tableY = bookRoot.getWorldPosition(homeWorld).y;
      for (const h of hands) if (h && h.y > tableY + 0.12 && h.distanceTo(centre) < NOTICE_M && (!follow || h.distanceTo(centre) < follow.distanceTo(centre))) follow = h;

      flies.forEach((f, i) => {
        homeWorld.copy(f.home).setY(pageY);
        bookRoot.localToWorld(homeWorld);
        if (!state.on) goal.copy(homeWorld);
        else {
          const swirl = t * 0.6 * f.speed + f.phase;
          goal.copy(follow ?? centre);
          const r = follow ? 0.7 : 2.6;
          goal.x += f.orbit.x * r * Math.cos(swirl) - f.orbit.z * r * Math.sin(swirl);
          goal.z += f.orbit.x * r * Math.sin(swirl) + f.orbit.z * r * Math.cos(swirl);
          goal.y += f.orbit.y * r + 0.04 * Math.sin(t * 1.7 + f.phase);
        }
        // A soft spring with drag: they drift, never snap.
        tmp.copy(goal).sub(f.at).multiplyScalar(follow ? 2.2 : 0.9);
        f.vel.addScaledVector(tmp, dt).multiplyScalar(Math.pow(0.35, dt));
        f.at.addScaledVector(f.vel, dt);
        matrix.makeTranslation(f.at.x, f.at.y, f.at.z);
        mesh.setMatrixAt(i, matrix);
        // Each glows and dims on its own slow pulse.
        bright[i] = amount * (0.45 + 0.55 * Math.max(0, Math.sin(t * 1.3 * f.speed + f.phase)) ** 2);
      });
      mesh.instanceMatrix.needsUpdate = true;
      (mesh.geometry.getAttribute('aBright') as InstancedBufferAttribute).needsUpdate = true;
    },
  };
}
