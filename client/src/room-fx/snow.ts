import { BufferGeometry, DoubleSide, Float32BufferAttribute, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, NormalBlending, PlaneGeometry, ShaderMaterial, Vector3, Vector4 } from '@iwsdk/core';
import type { TexRef } from '../paint/texref.ts';
import type { RoomMap } from './room-map.ts';
import type { Lasting, Weather } from './state.ts';
import { amountOf } from './weather.ts';

/**
 * Snow in your room: run 014's painted flakes drift down slowly, swaying, all round you, and settle
 * on your real table, couch, bed and the floor near you, in patches that grow while it snows and melt
 * when it clears. It lights nothing and darkens nothing (owner, Nov 15: lit walls looked wrong).
 */

export const SNOW_ART = { flakes: 'fx/weather/snow-flakes.png', cover: 'fx/weather/snow-cover.png' } as const;
const FLAKE_KINDS = 10;
const FLAKE_COUNT = 900;
const RADIUS_M = 3.2;
/** How long it takes to settle fully, and to melt. */
const SETTLE_MS = 30_000;
const MELT_MS = 6000;
/** What snow settles on. The floor only near you. */
const SETTLES_ON = new Set(['table', 'couch', 'bed', 'floor']);
const FLOOR_REACH_M = 2.2;
/** One repeat of the painted snow, in metres. */
const COVER_TILE_M = 0.7;

export interface SnowView {
  root: Group;
  frame(opts: { weather: Lasting<Weather>; nowMs: number; head: Vector3; room: RoomMap; bookOpen: boolean }): void;
}

export function createSnow(art: { flakes: TexRef; cover: TexRef }): SnowView {
  const root = new Group();
  root.name = 'snow';

  // Falling flakes: one draw, each placed and swayed on the GPU from its seed.
  const fallMaterial = new ShaderMaterial({
    uniforms: {
      uMap: { value: art.flakes.texture },
      uRect: { value: new Vector4(...art.flakes.uv) },
      uTime: { value: 0 },
      uCentre: { value: new Vector3() },
      uRadius: { value: RADIUS_M },
      uFloor: { value: 0 },
      uTop: { value: 2.4 },
      uAmount: { value: 0 },
    },
    vertexShader: /* glsl */ `
      attribute vec4 aSeed;
      uniform float uTime, uRadius, uFloor, uTop;
      uniform vec3 uCentre;
      varying vec2 vUv;
      varying float vFade;
      varying float vKind;
      void main() {
        float span = uRadius * 2.0;
        vec2 at = mod(aSeed.xy * span - uCentre.xz + uRadius, span) - uRadius;
        float height = max(0.5, uTop - uFloor);
        float speed = 0.3 + 0.25 * aSeed.z;
        float fall = uTime * speed + aSeed.w * height * 5.0;
        float y = uTop - mod(fall, height);
        // A slow sway as it falls.
        at += vec2(sin(fall * 2.1 + aSeed.x * 30.0), cos(fall * 1.7 + aSeed.y * 30.0)) * 0.12;
        vec3 world = vec3(uCentre.x + at.x, y, uCentre.z + at.y);
        float r = length(at) / uRadius;
        vFade = (1.0 - smoothstep(0.75, 1.0, r)) * smoothstep(0.0, 0.2, y - uFloor) * smoothstep(0.0, 0.3, uTop - y)
          * smoothstep(0.7, 1.3, length(at));
        vKind = floor(fract(aSeed.z * 17.3) * ${FLAKE_KINDS}.0);
        vUv = uv;
        // A flake faces you, a few centimetres across.
        vec4 centre = viewMatrix * vec4(world, 1.0);
        centre.xy += position.xy * (0.022 + 0.018 * aSeed.x);
        gl_Position = projectionMatrix * centre;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform vec4 uRect;
      uniform float uAmount;
      varying vec2 vUv;
      varying float vFade;
      varying float vKind;
      void main() {
        vec2 strip = vec2((vKind + vUv.x) / ${FLAKE_KINDS}.0, vUv.y);
        vec4 c = texture2D(uMap, mix(uRect.xy, uRect.zw, strip));
        float a = c.a * vFade * uAmount * 0.85;
        if (a < 0.01) discard;
        gl_FragColor = vec4(c.rgb * a, a);
      }`,
    transparent: true,
    premultipliedAlpha: true,
    blending: NormalBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const flakes = new InstancedMesh(new PlaneGeometry(1, 1), fallMaterial, FLAKE_COUNT);
  flakes.name = 'snow-flakes';
  flakes.frustumCulled = false;
  flakes.renderOrder = 451;
  const seeds = new Float32Array(FLAKE_COUNT * 4);
  for (let i = 0; i < seeds.length; i++) {
    const x = Math.sin((i + 1) * 57.913 + 3.17) * 43758.5453;
    seeds[i] = x - Math.floor(x);
  }
  flakes.geometry.setAttribute('aSeed', new InstancedBufferAttribute(seeds, 4));
  const identity = new Matrix4();
  for (let i = 0; i < FLAKE_COUNT; i++) flakes.setMatrixAt(i, identity);
  root.add(flakes);

  // Settled snow: the painted cover laid on each surface, showing through a soft mask that grows.
  const coverMaterial = new ShaderMaterial({
    uniforms: { uMap: { value: art.cover.texture }, uRect: { value: new Vector4(...art.cover.uv) }, uSettled: { value: 0 }, uHead: { value: new Vector3() }, uReach: { value: FLOOR_REACH_M } },
    vertexShader: /* glsl */ `
      attribute float aFloor;
      attribute float aEdge;
      varying vec2 vXZ;
      varying float vFloor;
      varying float vEdge;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vXZ = world.xz;
        vFloor = aFloor;
        vEdge = aEdge;
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform float uSettled, uReach;
      uniform vec3 uHead;
      uniform vec4 uRect;
      varying vec2 vXZ;
      varying float vFloor;
      varying float vEdge;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
      }
      void main() {
        // Repeated by hand, inside the cover's own part of a shared texture sheet. It was made to tile.
        vec3 c = texture2D(uMap, mix(uRect.xy, uRect.zw, fract(vXZ / ${COVER_TILE_M}))).rgb;
        // Patches first, then it fills in: a soft mask from two scales of noise against how settled it is.
        float n = 0.65 * noise(vXZ * 3.0) + 0.35 * noise(vXZ * 11.0);
        float cover = smoothstep(n - 0.08, n + 0.08, uSettled * 1.15 * smoothstep(0.0, 0.45, vEdge));
        // On the floor, only round you.
        cover *= mix(1.0, 1.0 - smoothstep(uReach * 0.7, uReach, distance(vXZ, uHead.xz)), vFloor);
        float a = cover * 0.92;
        if (a < 0.01) discard;
        gl_FragColor = vec4(c * a, a);
      }`,
    transparent: true,
    premultipliedAlpha: true,
    depthWrite: false,
    side: DoubleSide,
    toneMapped: false,
  });
  const covers = new Group();
  covers.name = 'snow-cover';
  covers.renderOrder = 430;
  root.add(covers);

  let key = '';
  /** How settled the snow is, 0 to 1, eased on the show's own time. */
  let settled = 0;
  let lastMs: number | null = null;

  const rebuild = (room: RoomMap) => {
    for (const child of [...covers.children]) {
      (child as Mesh).geometry.dispose();
      covers.remove(child);
    }
    for (const p of room.places()) {
      if (!p.horizontal || !SETTLES_ON.has(p.label) || p.outline.length < 3) continue;
      const y = p.centre.y + (p.label === 'floor' ? 0.003 : 0.006);
      // A fan from the middle: 1 there, 0 on the outline, so snow can thin out toward every edge.
      const v: number[] = [];
      const edge: number[] = [];
      const cx = p.outline.reduce((a, q) => a + q.x, 0) / p.outline.length;
      const cz = p.outline.reduce((a, q) => a + q.z, 0) / p.outline.length;
      for (let i = 0; i < p.outline.length; i++) {
        const a = p.outline[i]!;
        const b = p.outline[(i + 1) % p.outline.length]!;
        v.push(cx, y, cz, a.x, y, a.z, b.x, y, b.z);
        edge.push(1, 0, 0);
      }
      const g = new BufferGeometry();
      g.setAttribute('position', new Float32BufferAttribute(v, 3));
      g.setAttribute('aEdge', new Float32BufferAttribute(edge, 1));
      g.setAttribute('aFloor', new Float32BufferAttribute(new Array(v.length / 3).fill(p.label === 'floor' ? 1 : 0), 1));
      const mesh = new Mesh(g, coverMaterial);
      mesh.renderOrder = 430;
      mesh.frustumCulled = false;
      covers.add(mesh);
    }
  };

  return {
    root,
    frame({ weather, nowMs, head, room, bookOpen }) {
      const snowing = weather.kind === 'snow' ? amountOf(weather) : 0;
      const falling = snowing * (bookOpen ? 1 : 0);
      flakes.visible = falling > 0.001;
      fallMaterial.uniforms.uAmount!.value = falling;
      fallMaterial.uniforms.uTime!.value = nowMs / 1000;
      (fallMaterial.uniforms.uCentre!.value as Vector3).copy(head);
      fallMaterial.uniforms.uFloor!.value = room.floorY();
      fallMaterial.uniforms.uTop!.value = room.ceilingY();

      // Settles while it snows, melts once it stops. The book being shut holds it, as it holds the show.
      const dt = lastMs === null ? 0 : Math.max(0, Math.min(200, nowMs - lastMs));
      lastMs = nowMs;
      if (bookOpen) {
        if (weather.kind === 'snow' && weather.on) settled = Math.min(1, settled + dt / SETTLE_MS);
        else settled = Math.max(0, settled - dt / MELT_MS);
      }
      covers.visible = settled > 0.001 && bookOpen;
      if (covers.visible) {
        const next = room.places().map((p) => p.id).join('|');
        if (next !== key) {
          key = next;
          rebuild(room);
        }
        coverMaterial.uniforms.uSettled!.value = settled;
        (coverMaterial.uniforms.uHead!.value as Vector3).copy(head);
      }
    },
  };
}
