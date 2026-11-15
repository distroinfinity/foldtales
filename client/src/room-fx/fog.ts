import { Group, Mesh, NormalBlending, PlaneGeometry, ShaderMaterial, Vector3, Vector4 } from '@iwsdk/core';
import type { TexRef } from '../paint/texref.ts';
import type { Lasting, Weather } from './state.ts';
import { amountOf } from './weather.ts';

/**
 * Fog rolls along your floor: run 014's painted wisps, low and faint, drifting slowly round you,
 * hidden behind real furniture by the room's depth. Like snow, it lights and darkens nothing.
 */

export const FOG_ART = ['room-fx/weather/fog-1.png', 'room-fx/weather/fog-2.png', 'room-fx/weather/fog-3.png', 'room-fx/weather/fog-4.png'] as const;
const WISPS = 12;
/** Round you, between these distances. Never at your feet in a wall of white. */
const NEAR_M = 0.9;
const FAR_M = 2.8;
const DRIFT_M_PER_S = 0.05;

export interface FogView {
  root: Group;
  frame(opts: { weather: Lasting<Weather>; nowMs: number; head: Vector3; floorY: number; bookOpen: boolean }): void;
}

const hash = (n: number): number => {
  const x = Math.sin(n * 39.346 + 11.135) * 43758.5453;
  return x - Math.floor(x);
};

export function createFog(art: TexRef[]): FogView {
  const root = new Group();
  root.name = 'fog';
  root.visible = false;
  const wisps = Array.from({ length: WISPS }, (_, i) => {
    const ref = art[i % art.length]!;
    const material = new ShaderMaterial({
      uniforms: { uMap: { value: ref.texture }, uRect: { value: new Vector4(...ref.uv) }, uAlpha: { value: 0 } },
      vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap;
        uniform vec4 uRect;
        uniform float uAlpha;
        varying vec2 vUv;
        void main() {
          vec4 c = texture2D(uMap, mix(uRect.xy, uRect.zw, vUv));
          // Softer still at its ends, so a wisp never shows a cut edge.
          float a = c.a * uAlpha * smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.75, vUv.x);
          if (a < 0.005) discard;
          gl_FragColor = vec4(c.rgb * a, a);
        }`,
      transparent: true,
      premultipliedAlpha: true,
      blending: NormalBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const mesh = new Mesh(new PlaneGeometry(1, 1), material);
    const width = 1.1 + 0.9 * hash(i + 10);
    mesh.scale.set(width, width * (ref.sizePx[1] / ref.sizePx[0]) * 1.4, 1);
    mesh.renderOrder = 440;
    mesh.frustumCulled = false;
    root.add(mesh);
    return { mesh, material, angle: hash(i) * Math.PI * 2, r: NEAR_M + (FAR_M - NEAR_M) * hash(i + 20), lift: 0.04 + 0.22 * hash(i + 30), speed: (0.5 + hash(i + 40)) * (hash(i + 50) > 0.5 ? 1 : -1), phase: hash(i + 60) * 10 };
  });
  /** Where the fog gathered, fixed while it's out: round where you sat. */
  let centre: Vector3 | null = null;
  const tmp = new Vector3();

  return {
    root,
    frame({ weather, nowMs, head, floorY, bookOpen }) {
      const amount = (weather.kind === 'fog' ? amountOf(weather, 4000) : 0) * (bookOpen ? 1 : 0);
      root.visible = amount > 0.001;
      if (!root.visible) {
        if (!(weather.kind === 'fog' && weather.on)) centre = null;
        return;
      }
      centre ??= head.clone();
      const t = nowMs / 1000;
      for (const w of wisps) {
        // Slowly round you, each at its own pace, breathing in and out a little.
        const a = w.angle + (t * DRIFT_M_PER_S * w.speed) / w.r;
        const r = w.r + 0.15 * Math.sin(t * 0.07 + w.phase);
        w.mesh.position.set(centre.x + Math.sin(a) * r, floorY + w.lift + w.mesh.scale.y * 0.3, centre.z + Math.cos(a) * r);
        // Upright and turned to face you, so a wisp is seen side-on as a low band of mist.
        w.mesh.lookAt(tmp.set(head.x, w.mesh.position.y, head.z));
        w.material.uniforms.uAlpha!.value = amount * (0.38 + 0.12 * Math.sin(t * 0.13 + w.phase));
      }
    },
  };
}
