import { InstancedBufferAttribute, InstancedMesh, Matrix4, NormalBlending, PlaneGeometry, ShaderMaterial, Vector3, Vector4, type Texture } from '@iwsdk/core';
import type { TexRef } from '../paint/texref.ts';
import type { Lasting, Weather } from './state.ts';

/**
 * Weather in your room. Painted streaks of rain (run 014) fall all around you, in a column the size
 * of the room, and the room dim greys and darkens; thunder lifts the dark off your walls for a moment.
 * Every drop is worked out on the GPU from its seed and the time, so there's no work per drop here.
 */

/** The painted rain strokes, side by side in one strip (from run 014's weather sheet). */
export const RAIN_ART = 'room-fx/weather/rain-strokes.png';
const RAIN_STROKES = 8;
const RAIN_COUNT = 1800;
/** Around you, this far out. Real walls hide what's beyond them (the room's depth). */
const RADIUS_M = 3.2;
const FADE_MS = 3000;

/** A thunder flash over its own time: a bright flicker, a second, fainter one, then gone. */
export function flashAt(ms: number): number {
  if (ms < 0) return 0;
  const first = ms < 90 ? ms / 90 : Math.exp(-(ms - 90) / 140);
  const second = ms < 330 ? 0 : 0.6 * (ms < 380 ? (ms - 330) / 50 : Math.exp(-(ms - 380) / 180));
  return Math.min(1, first + second);
}

/** How much a lasting effect shows, fading in and out over `fadeMs`, as seen at `sinceMs`. */
export function amountOf(state: Lasting, fadeMs = FADE_MS): number {
  const t = Math.min(1, Math.max(0, state.sinceMs / fadeMs));
  return state.on ? t : 1 - t;
}

export interface WeatherView {
  rain: InstancedMesh;
  /** Each frame. Returns the room dim's weather look for this frame. */
  frame(opts: { weather: Lasting<Weather>; thunderMs: number | null; nowMs: number; head: Vector3; floorY: number; ceilingY: number; bookOpen: boolean }): { storm: number; flash: number };
}

export function createWeather(rainArt: TexRef | null): WeatherView {
  const material = new ShaderMaterial({
    uniforms: {
      uMap: { value: (rainArt?.texture ?? null) as Texture | null },
      uRect: { value: rainArt ? new Vector4(...rainArt.uv) : new Vector4(0, 0, 1, 1) },
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
      varying float vStroke;
      void main() {
        float span = uRadius * 2.0;
        // Fixed in the room, wrapped round wherever you are.
        vec2 at = mod(aSeed.xy * span - uCentre.xz + uRadius, span) - uRadius;
        float height = max(0.5, uTop - uFloor);
        float speed = 2.6 + 1.2 * aSeed.z;
        float y = uTop - mod(aSeed.w * height * 7.0 + uTime * speed, height);
        vec3 world = vec3(uCentre.x + at.x, y, uCentre.z + at.y);
        float r = length(at) / uRadius;
        vFade = (1.0 - smoothstep(0.75, 1.0, r)) * smoothstep(0.0, 0.25, y - uFloor) * smoothstep(0.0, 0.3, uTop - y)
          // A fine curtain round the room, not drops at your nose (owner: too big up close).
          * smoothstep(1.1, 1.8, length(at));
        vStroke = floor(fract(aSeed.z * 13.7) * ${RAIN_STROKES}.0);
        vUv = uv;
        // A streak stands upright, turned to face you, leaning a little with the wind.
        vec3 toEye = normalize(vec3(cameraPosition.x - world.x, 0.0, cameraPosition.z - world.z));
        vec3 side = normalize(cross(vec3(0.0, 1.0, 0.0), toEye));
        float length_ = 0.09 + 0.06 * aSeed.x;
        world += side * position.x * 0.007 + vec3(0.0, 1.0, 0.0) * position.y * length_ + side * position.y * 0.012;
        gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform vec4 uRect;
      uniform float uAmount;
      varying vec2 vUv;
      varying float vFade;
      varying float vStroke;
      void main() {
        vec2 strip = vec2((vStroke + vUv.x) / ${RAIN_STROKES}.0, vUv.y);
        vec4 c = texture2D(uMap, mix(uRect.xy, uRect.zw, strip));
        float a = c.a * vFade * uAmount * 0.32;
        if (a < 0.01) discard;
        // Pale silvery paint, a touch lighter than painted, so it reads in a dimmed room.
        gl_FragColor = vec4(mix(c.rgb, vec3(0.8, 0.85, 0.92), 0.5) * a, a);
      }`,
    transparent: true,
    premultipliedAlpha: true,
    blending: NormalBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const rain = new InstancedMesh(new PlaneGeometry(1, 1), material, RAIN_COUNT);
  rain.name = 'rain';
  rain.frustumCulled = false;
  rain.visible = false;
  rain.renderOrder = 450;
  const seeds = new Float32Array(RAIN_COUNT * 4);
  const hash = (n: number) => {
    const x = Math.sin(n * 91.345 + 47.853) * 43758.5453;
    return x - Math.floor(x);
  };
  for (let i = 0; i < seeds.length; i++) seeds[i] = hash(i + 1);
  rain.geometry.setAttribute('aSeed', new InstancedBufferAttribute(seeds, 4));
  // Every drop is placed in the shader; the instance matrices stay as they are.
  const identity = new Matrix4();
  for (let i = 0; i < RAIN_COUNT; i++) rain.setMatrixAt(i, identity);

  return {
    rain,
    frame({ weather, thunderMs, nowMs, head, floorY, ceilingY, bookOpen }) {
      const amount = (weather.kind === 'rain' ? amountOf(weather) : 0) * (bookOpen ? 1 : 0);
      rain.visible = amount > 0.001 && rainArt !== null;
      material.uniforms.uAmount!.value = amount;
      material.uniforms.uTime!.value = nowMs / 1000;
      (material.uniforms.uCentre!.value as Vector3).copy(head);
      material.uniforms.uFloor!.value = floorY;
      material.uniforms.uTop!.value = ceilingY;
      const storm = (weather.kind === 'rain' ? amountOf(weather) : 0) * (bookOpen ? 1 : 0);
      return { storm, flash: thunderMs === null ? 0 : flashAt(thunderMs) * storm };
    },
  };
}
