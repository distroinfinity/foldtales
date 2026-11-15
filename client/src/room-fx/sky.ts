import { DoubleSide, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, NormalBlending, PlaneGeometry, Quaternion, ShaderMaterial, Vector3, Vector4, type Texture } from '@iwsdk/core';
import type { TexRef } from '../paint/texref.ts';
import type { RoomMap } from './room-map.ts';
import type { RoomNow } from './state.ts';

/**
 * The night sky on your ceiling: run 014's paper stars come out a few at a time and twinkle, the
 * crescent moon hangs ahead of you, a constellation lights up with a faint pencil line, and a
 * shooting star crosses. It leaves the room's light alone (owner, Nov 15, on the storm: lit and
 * darkened walls looked wrong), so it's the ceiling that changes, nothing else.
 */

export const SKY_ART = { stars: 'fx/sky/stars.png', moon: 'fx/sky/moon.png', shooting: 'fx/sky/shooting-star.png' } as const;
const STAR_KINDS = 6;
const STAR_COUNT = 70;
/** Round you on the ceiling, this far out. */
const SPREAD_M = 2.6;
/** A hair below the ceiling, so it never hides in it. */
const BELOW_M = 0.012;
const FADE_MS = 4000;
const SHOOT_MS = 2500;

/** Constellations: a few stars in a shape, in metres across the ceiling ahead of you (x right, z ahead). */
const CONSTELLATIONS: Record<'lantern' | 'kite' | 'fox', Array<[number, number]>> = {
  // A lantern: a ring and its handle.
  lantern: [[-0.15, 0.55], [0.15, 0.55], [0.22, 0.85], [0, 1.0], [-0.22, 0.85], [0, 0.3]],
  // A kite: a diamond and its tail.
  kite: [[0.9, 0.5], [1.15, 0.75], [0.9, 1.05], [0.65, 0.75], [0.95, 0.25], [1.05, 0.05]],
  // A fox: two ears, a head and a long tail.
  fox: [[-1.0, 0.7], [-0.85, 0.95], [-0.7, 0.7], [-0.85, 0.45], [-1.25, 0.25], [-1.5, 0.35]],
};
const LINES: Record<keyof typeof CONSTELLATIONS, Array<[number, number]>> = {
  lantern: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0], [0, 5], [1, 5]],
  kite: [[0, 1], [1, 2], [2, 3], [3, 0], [0, 4], [4, 5]],
  fox: [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4], [4, 5]],
};

const hash = (n: number): number => {
  const x = Math.sin(n * 78.233 + 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

function cardMaterial(ref: TexRef, extra = ''): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uMap: { value: ref.texture as Texture }, uRect: { value: new Vector4(...ref.uv) }, uAlpha: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform vec4 uRect;
      uniform float uAlpha;
      varying vec2 vUv;
      void main() {
        vec4 c = texture2D(uMap, mix(uRect.xy, uRect.zw, vUv));
        float a = c.a * uAlpha;
        if (a < 0.01) discard;
        gl_FragColor = vec4(c.rgb * a, a);${extra}
      }`,
    transparent: true,
    premultipliedAlpha: true,
    blending: NormalBlending,
    depthWrite: false,
    side: DoubleSide,
    toneMapped: false,
  });
}

export interface NightSky {
  meshes: Mesh[];
  frame(opts: { now: RoomNow; nowMs: number; room: RoomMap; head: Vector3; book: Vector3 | null; bookOpen: boolean }): void;
}

export function createNightSky(art: { stars: TexRef; moon: TexRef; shooting: TexRef }): NightSky {
  // Stars: one draw, each picking its painting from the strip and twinkling on its own.
  const starMaterial = new ShaderMaterial({
    uniforms: { uMap: { value: art.stars.texture }, uRect: { value: new Vector4(...art.stars.uv) }, uTime: { value: 0 }, uAmount: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute vec4 aStar;
      varying vec2 vUv;
      varying float vBright;
      varying float vKind;
      uniform float uTime, uAmount;
      void main() {
        vUv = uv;
        vKind = aStar.x;
        // Each comes out at its own moment as the sky fades in, then twinkles slowly.
        float shown = clamp(uAmount * 1.6 - aStar.y * 0.6, 0.0, 1.0);
        vBright = shown * (0.8 + 0.2 * sin(uTime * (0.6 + aStar.z) + aStar.y * 40.0)) * min(1.0, aStar.w * 1.25);
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform vec4 uRect;
      varying vec2 vUv;
      varying float vBright;
      varying float vKind;
      void main() {
        vec2 strip = vec2((vKind + vUv.x) / ${STAR_KINDS}.0, vUv.y);
        vec4 c = texture2D(uMap, mix(uRect.xy, uRect.zw, strip));
        float a = c.a * vBright;
        if (a < 0.01) discard;
        gl_FragColor = vec4(c.rgb * a, a);
      }`,
    transparent: true,
    premultipliedAlpha: true,
    depthWrite: false,
    side: DoubleSide,
    toneMapped: false,
  });
  const constellationStars = Object.values(CONSTELLATIONS).reduce((n, c) => n + c.length, 0);
  const total = STAR_COUNT + constellationStars;
  const stars = new InstancedMesh(new PlaneGeometry(1, 1), starMaterial, total);
  stars.name = 'night-stars';
  stars.frustumCulled = false;
  stars.renderOrder = 420;
  const starData = new Float32Array(total * 4);
  stars.geometry.setAttribute('aStar', new InstancedBufferAttribute(starData, 4));

  const moonMaterial = cardMaterial(art.moon);
  const moon = new Mesh(new PlaneGeometry(1, 1), moonMaterial);
  moon.name = 'night-moon';
  moon.renderOrder = 421;
  const shootMaterial = cardMaterial(art.shooting);
  const shooting = new Mesh(new PlaneGeometry(1, 1), shootMaterial);
  shooting.name = 'shooting-star';
  shooting.renderOrder = 422;

  // The constellation's pencil lines: thin warm-grey strokes between its stars.
  const lineMaterial = new ShaderMaterial({
    uniforms: { uAlpha: { value: 0 } },
    vertexShader: /* glsl */ `void main() { gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `uniform float uAlpha; void main() { float a = 0.45 * uAlpha; gl_FragColor = vec4(vec3(0.86, 0.8, 0.66) * a, a); }`,
    transparent: true,
    premultipliedAlpha: true,
    depthWrite: false,
    side: DoubleSide,
    toneMapped: false,
  });
  const maxLines = Math.max(...Object.values(LINES).map((l) => l.length));
  const lines = new InstancedMesh(new PlaneGeometry(1, 1), lineMaterial, maxLines);
  lines.name = 'constellation-lines';
  lines.frustumCulled = false;
  lines.renderOrder = 419;

  const meshes = [stars, moon, shooting, lines];
  for (const m of meshes) m.visible = false;

  /** Where the sky was laid out, fixed while it's up: the ceiling's height, your spot under it, and which way is ahead. */
  let layout: { y: number; centre: Vector3; ahead: Vector3; right: Vector3 } | null = null;
  let wasOn = false;
  let changedAt = -Infinity;
  const m = new Matrix4();
  const q = new Quaternion();
  const down = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2);
  const tmp = new Vector3();

  /** A point on the ceiling, `x` metres right and `z` ahead of where you sat when the sky came out. */
  const onCeiling = (x: number, z: number, out: Vector3) => out.copy(layout!.centre).addScaledVector(layout!.right, x).addScaledVector(layout!.ahead, z).setY(layout!.y - BELOW_M);
  const card = (at: Vector3, size: number, spin: number, out: Matrix4) => {
    q.copy(down).multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), spin));
    return out.compose(at, q, new Vector3(size, size, size));
  };

  const layOut = (room: RoomMap, head: Vector3, book: Vector3 | null) => {
    const ceiling = room.resolve('room:ceiling', 'face');
    const y = ceiling ? ceiling.centre.y : room.ceilingY();
    const ahead = (book ? tmp.copy(book).sub(head) : tmp.set(0, 0, -1)).setY(0).normalize().clone();
    const right = new Vector3(0, 1, 0).cross(ahead).negate().normalize();
    layout = { y, centre: head.clone().setY(y), ahead, right };
    // The scattered stars: round you, more ahead than behind, none right overhead in a clump.
    const at = new Vector3();
    for (let i = 0; i < STAR_COUNT; i++) {
      const angle = hash(i) * Math.PI * 2;
      const r = 0.35 + Math.sqrt(hash(i + 300)) * SPREAD_M;
      const x = Math.sin(angle) * r;
      const z = Math.cos(angle) * r * (Math.cos(angle) > 0 ? 1 : 0.6);
      onCeiling(x, z, at);
      stars.setMatrixAt(i, card(at, 0.06 + 0.05 * hash(i + 600), hash(i + 900) * 6.28, m));
      starData.set([Math.floor(hash(i + 1200) * STAR_KINDS), hash(i + 1500), hash(i + 1800) * 0.8, 0.7], i * 4);
    }
    // The constellations' own stars, a little larger, dim until their shape is named.
    let k = STAR_COUNT;
    for (const shape of Object.values(CONSTELLATIONS)) {
      for (const [x, z] of shape) {
        onCeiling(x, z + 0.4, at);
        stars.setMatrixAt(k, card(at, 0.09, hash(k) * 6.28, m));
        starData.set([Math.floor(hash(k + 30) * STAR_KINDS), hash(k + 60), hash(k + 90) * 0.8, 0.75], k * 4);
        k++;
      }
    }
    stars.instanceMatrix.needsUpdate = true;
    (stars.geometry.getAttribute('aStar') as InstancedBufferAttribute).needsUpdate = true;
    // The moon, ahead and to the left, where you'd look up from the book.
    onCeiling(-0.9, 1.5, at);
    moon.position.copy(at);
    moon.quaternion.copy(down);
    moon.rotateZ(0.4);
    moon.scale.setScalar(0.5);
  };

  return {
    meshes,
    frame({ now, nowMs, room, head, book, bookOpen }) {
      const sky = now.sky;
      if (sky.on !== wasOn) {
        wasOn = sky.on;
        changedAt = nowMs - Math.min(sky.sinceMs, FADE_MS);
        if (sky.on) layout = null;
      }
      const t = Math.min(1, (nowMs - changedAt) / FADE_MS);
      const amount = (sky.on ? t : 1 - t) * (bookOpen ? 1 : 0);
      if (amount <= 0.001) {
        for (const mesh of meshes) mesh.visible = false;
        return;
      }
      if (!layout) layOut(room, head, book);
      stars.visible = true;
      moon.visible = true;
      starMaterial.uniforms.uTime!.value = nowMs / 1000;
      starMaterial.uniforms.uAmount!.value = amount;
      moonMaterial.uniforms.uAlpha!.value = Math.min(1, amount * 1.2) * 0.92;

      // A named constellation: its stars brighten and a faint pencil line joins them.
      const named = now.stars;
      let lineAlpha = 0;
      if (named && sky.on) {
        lineAlpha = Math.min(1, named.sinceMs / 1500) * amount;
        const shape = CONSTELLATIONS[named.which];
        const offset = STAR_COUNT + Object.keys(CONSTELLATIONS).indexOf(named.which) * shape.length;
        for (let i = 0; i < Object.values(CONSTELLATIONS).reduce((n, c) => n + c.length, 0); i++) starData[(STAR_COUNT + i) * 4 + 3] = 0.75;
        for (let i = 0; i < shape.length; i++) starData[(offset + i) * 4 + 3] = 0.75 + 0.25 * lineAlpha;
        (stars.geometry.getAttribute('aStar') as InstancedBufferAttribute).needsUpdate = true;
        const a = new Vector3();
        const b = new Vector3();
        LINES[named.which].forEach(([i, j], n) => {
          onCeiling(shape[i]![0], shape[i]![1] + 0.4, a);
          onCeiling(shape[j]![0], shape[j]![1] + 0.4, b);
          a.y += 0.002;
          b.y += 0.002;
          const mid = a.clone().add(b).multiplyScalar(0.5);
          const length = a.distanceTo(b) * 0.82;
          const spin = Math.atan2(b.clone().sub(a).dot(layout!.right), b.clone().sub(a).dot(layout!.ahead));
          lines.setMatrixAt(n, new Matrix4().compose(mid, down.clone().multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), -spin)), new Vector3(0.004, length, 1)));
        });
        lines.count = LINES[named.which].length;
        lines.instanceMatrix.needsUpdate = true;
      }
      lineMaterial.uniforms.uAlpha!.value = lineAlpha;
      lines.visible = lineAlpha > 0.01;

      // A shooting star crosses overhead, from ahead-left to ahead-right, and fades.
      const shoot = now.shootingStarMs;
      if (shoot !== null && shoot < SHOOT_MS && sky.on) {
        const p = shoot / SHOOT_MS;
        const at = onCeiling(-1.6 + 3.2 * p, 1.9 - 0.6 * p, new Vector3());
        shooting.position.copy(at);
        shooting.quaternion.copy(down);
        shooting.rotateZ(Math.atan2(-0.6, 3.2) + Math.PI);
        shooting.scale.set(0.5, 0.5 * (art.shooting.sizePx[1] / art.shooting.sizePx[0]), 1);
        shootMaterial.uniforms.uAlpha!.value = Math.sin(Math.PI * p) * amount;
        shooting.visible = true;
      } else shooting.visible = false;
    },
  };
}
