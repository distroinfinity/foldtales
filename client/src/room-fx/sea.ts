import { CircleGeometry, DoubleSide, Mesh, NormalBlending, PlaneGeometry, ShaderMaterial, Vector3, Vector4 } from '@iwsdk/core';
import type { TexRef } from '../paint/texref.ts';
import type { RoomNow } from './state.ts';

/**
 * The sea on your floor: run 015's painted night water in a ring round you (never at your feet),
 * moving slowly, with a lacy foam edge that rolls in and out. Real furniture hides it, through the
 * room's depth. The tide moves the edge; a paper boat sails a slow circle on it. Calm on purpose
 * (owner, Nov 15: busy things on the floor didn't look good).
 */

export const SEA_ART = { water: 'fx/sea/water.png', boat: 'objects/paper-boat/paper-boat.png' } as const;
/** The water's ring round you, metres: from here out to the tide line. */
const INNER_M = 0.9;
const LOW_TIDE_M = 1.8;
const HIGH_TIDE_M = 2.5;
const RISE_MS = 5000;
const TIDE_MS = 6000;
/** One repeat of the painted water, metres. */
const TILE_M = 1.1;
const BOAT_CIRCLE_M = 1.55;
const BOAT_LAP_S = 70;

export interface SeaView {
  meshes: Mesh[];
  frame(opts: { now: RoomNow; nowMs: number; head: Vector3; floorY: number; bookOpen: boolean }): void;
}

export function createSea(art: { water: TexRef; boat: TexRef | null }): SeaView {
  const material = new ShaderMaterial({
    uniforms: {
      uMap: { value: art.water.texture },
      uRect: { value: new Vector4(...art.water.uv) },
      uTime: { value: 0 },
      uCentre: { value: new Vector3() },
      uInner: { value: INNER_M },
      uOuter: { value: LOW_TIDE_M },
      uAmount: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vXZ;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vXZ = world.xz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform vec4 uRect;
      uniform float uTime, uInner, uOuter, uAmount;
      uniform vec3 uCentre;
      varying vec2 vXZ;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
      }
      vec3 water(vec2 p) { return texture2D(uMap, mix(uRect.xy, uRect.zw, fract(p / ${TILE_M}))).rgb; }
      void main() {
        vec2 d = vXZ - uCentre.xz;
        float r = length(d);
        float angle = atan(d.y, d.x);
        // The edge breathes in and out a little, unevenly, as waves do.
        float edge = uOuter + 0.08 * sin(uTime * 0.9 + angle * 3.0) + 0.06 * (noise(vec2(angle * 4.0, uTime * 0.3)) - 0.5);
        // No hard hole at your feet: the water thins away gently toward you.
        float wet = smoothstep(uInner - 0.45, uInner + 0.35, r) * (1.0 - smoothstep(edge - 0.04, edge + 0.02, r));
        // Two drifts of the painting, crossing slowly, for moving water.
        vec3 c = mix(water(vXZ + vec2(uTime * 0.02, uTime * 0.012)), water(vXZ * 0.83 - vec2(uTime * 0.015, -uTime * 0.02)), 0.5);
        // Moonlit: lifted toward teal, so the painting reads in a dimmed room.
        c = mix(c * 1.6, vec3(0.32, 0.52, 0.58), 0.18);
        // Slow swells: faint bands of light rolling in toward you.
        float swell = pow(0.5 + 0.5 * sin(r * 7.0 + uTime * 0.9 + 0.6 * sin(angle * 2.0)), 6.0);
        c += vec3(0.55, 0.7, 0.72) * swell * 0.16 * smoothstep(uInner, edge, r);
        // The foam: a lacy cream line along the edge.
        float lace = smoothstep(0.35, 0.75, noise(vXZ * 14.0 + uTime * 0.2));
        float foam = (1.0 - smoothstep(0.0, 0.12, abs(r - edge + 0.05))) * (0.45 + 0.55 * lace);
        c = mix(c, vec3(0.93, 0.92, 0.86), foam * 0.85);
        float a = max(wet * 0.82, foam * 0.9 * step(uInner, r)) * uAmount;
        if (a < 0.01) discard;
        gl_FragColor = vec4(c * a, a);
      }`,
    transparent: true,
    premultipliedAlpha: true,
    blending: NormalBlending,
    depthWrite: false,
    side: DoubleSide,
    toneMapped: false,
  });
  const water = new Mesh(new CircleGeometry(HIGH_TIDE_M + 0.3, 64), material);
  water.name = 'sea';
  water.rotation.x = -Math.PI / 2;
  water.renderOrder = 425;
  water.frustumCulled = false;
  water.visible = false;
  const meshes: Mesh[] = [water];

  // The paper boat, upright and turned side-on to you as it sails round.
  let boat: Mesh | null = null;
  let boatMaterial: ShaderMaterial | null = null;
  if (art.boat) {
    boatMaterial = new ShaderMaterial({
      uniforms: { uMap: { value: art.boat.texture }, uRect: { value: new Vector4(...art.boat.uv) }, uAlpha: { value: 0 } },
      vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap; uniform vec4 uRect; uniform float uAlpha; varying vec2 vUv;
        void main() { vec4 c = texture2D(uMap, mix(uRect.xy, uRect.zw, vUv)); float a = c.a * uAlpha; if (a < 0.01) discard; gl_FragColor = vec4(c.rgb * a, a); }`,
      transparent: true,
      premultipliedAlpha: true,
      depthWrite: false,
      side: DoubleSide,
      toneMapped: false,
    });
    boat = new Mesh(new PlaneGeometry(1, 1), boatMaterial);
    boat.name = 'paper-boat';
    const width = 0.24;
    boat.scale.set(width, width * (art.boat.sizePx[1] / art.boat.sizePx[0]), 1);
    boat.renderOrder = 426;
    boat.visible = false;
    meshes.push(boat);
  }

  /** Where the sea came in, fixed while it's out: round where you sat. */
  let centre: Vector3 | null = null;
  const tmp = new Vector3();

  return {
    meshes,
    frame({ now, nowMs, head, floorY, bookOpen }) {
      const sea = now.sea;
      const t = Math.min(1, sea.sinceMs / (sea.on ? RISE_MS : 4000));
      const amount = (sea.on ? t : 1 - t) * (bookOpen ? 1 : 0);
      water.visible = amount > 0.001;
      if (!water.visible) {
        if (!sea.on) centre = null;
        if (boat) boat.visible = false;
        return;
      }
      centre ??= head.clone();
      water.position.set(centre.x, floorY + 0.004, centre.z);
      // The sea washes in from beyond the tide line; the tide then moves the line.
      const tide = Math.min(1, now.tide.sinceMs / TIDE_MS);
      const level = now.tide.high ? LOW_TIDE_M + (HIGH_TIDE_M - LOW_TIDE_M) * tide : HIGH_TIDE_M - (HIGH_TIDE_M - LOW_TIDE_M) * (Number.isFinite(now.tide.sinceMs) ? tide : 1);
      const coming = sea.on ? Math.min(1, sea.sinceMs / RISE_MS) : 1;
      material.uniforms.uOuter!.value = INNER_M + (level - INNER_M) * coming;
      material.uniforms.uTime!.value = nowMs / 1000;
      (material.uniforms.uCentre!.value as Vector3).copy(centre);
      material.uniforms.uAmount!.value = amount;

      // The boat sails a slow circle once it's been launched, bobbing on the swell.
      if (boat && boatMaterial) {
        const launched = now.boatMs !== null && sea.on;
        boat.visible = launched;
        if (launched) {
          const s = nowMs / 1000;
          const a = (s / BOAT_LAP_S) * Math.PI * 2;
          boat.position.set(centre.x + Math.sin(a) * BOAT_CIRCLE_M, floorY + boat.scale.y / 2 + 0.01 + 0.012 * Math.sin(s * 1.3), centre.z - Math.cos(a) * BOAT_CIRCLE_M);
          boat.lookAt(tmp.set(head.x, boat.position.y, head.z));
          boat.rotateZ(0.06 * Math.sin(s * 0.9));
          boatMaterial.uniforms.uAlpha!.value = Math.min(1, (now.boatMs ?? 0) / 1500) * amount;
        }
      }
    },
  };
}
