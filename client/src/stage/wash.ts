import { Color, Mesh, Object3D, PlaneGeometry, ShaderMaterial, Sprite, SpriteMaterial, Vector3, type Texture } from '@iwsdk/core';
import { Text } from 'troika-three-text';
import captionFont from '@fontsource/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-500-normal.woff?url';
import { stageLook } from '../paint/card-material.ts';

/** The wash covers the open spread with room to spare. Stage metres at reference size. */
const WASH_RADIUS_M = 0.3;
const WORDS_Z_M = 0.215;

export interface WashView {
  root: Object3D;
  update(bloom: number, fade: number, words: number, seconds: number): void;
}

/**
 * Painted on your real table where the theater will play: a noisy-edged bloom of page-coloured
 * pigment that pools at its rim, paper grain, and a gold pencil line, as `art/found-surface-proof.html`.
 */
export function buildWash(): WashView {
  const root = new Object3D();
  root.name = 'found-wash';
  const material = new ShaderMaterial({
    uniforms: {
      uBloom: { value: 0 },
      uFade: { value: 1 },
      uTime: { value: 0 },
      uPage: { value: new Color('#F6EFE2') },
      uRim: { value: new Color('#C8A06A') },
      uLine: { value: new Color('#B2802A') },
      uTint: stageLook.tint,
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uBloom, uFade, uTime;
      uniform vec3 uPage, uRim, uLine, uTint;
      varying vec2 vUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
      }
      void main() {
        vec2 p = (vUv - 0.5) * 2.0;
        float a = atan(p.y, p.x);
        float d = length(p);
        float r = 0.95 * uBloom * (1.0 + 0.06 * sin(a * 3.0 + 1.3) + 0.04 * sin(a * 7.0 + uTime * 0.6) + 0.025 * sin(a * 13.0 + 2.1));
        if (r <= 0.0 || d > r) discard;
        float rr = d / r;
        vec3 col = mix(uPage, uRim, smoothstep(0.72, 1.0, rr));
        float alpha = mix(0.8, 0.9, smoothstep(0.75, 1.0, rr));
        float grain = 0.55 * noise(vUv * 700.0) + 0.45 * noise(vUv * 180.0);
        col *= 0.86 + 0.14 * grain;
        float dash = step(-0.82, sin(a * 38.0 + 0.7));
        float line = (1.0 - smoothstep(0.0, 0.008, abs(rr - 0.965))) * dash;
        col = mix(col, uLine, line * 0.85);
        alpha *= 1.0 - smoothstep(r - 0.006, r, d);
        alpha *= uFade;
        col *= uTint;
        gl_FragColor = vec4(col * alpha, alpha);
      }`,
    transparent: true,
    depthWrite: false,
    premultipliedAlpha: true,
    toneMapped: false,
  });
  const plane = new Mesh(new PlaneGeometry(WASH_RADIUS_M * 2, WASH_RADIUS_M * 2), material);
  plane.name = 'wash';
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = 0.0002;
  plane.renderOrder = -3;
  root.add(plane);

  const words = new Text();
  words.name = 'wash-words';
  words.text = 'Your theater will play here';
  words.font = captionFont;
  // About 11 mm capitals: at least 1° at a seated reading distance.
  words.fontSize = 0.016;
  words.anchorX = 'center';
  words.anchorY = 'middle';
  words.color = '#2B2420';
  words.rotation.x = -Math.PI / 2;
  words.position.set(0, 0.0006, WORDS_Z_M);
  words.sync();
  root.add(words);

  return {
    root,
    update(bloom, fade, wordsShare, seconds) {
      root.visible = bloom > 0.001 && fade > 0.001;
      material.uniforms.uBloom!.value = bloom;
      material.uniforms.uFade!.value = fade;
      material.uniforms.uTime!.value = seconds;
      words.visible = wordsShare > 0.01;
      words.fillOpacity = wordsShare;
    },
  };
}

export interface EmberView {
  sprite: Sprite;
  /** While searching: drifts ahead of you and sinks toward where a table would be. */
  search(head: Vector3, forward: Vector3, searchMs: number): void;
  /** After a spot is chosen: flies down onto it. `remaining` goes 1 to 0. */
  land(target: Vector3, remaining: number): void;
  hide(): void;
}

const EMBER_M = 0.06;
const AHEAD_M = 0.55;
const SINK_MS = 2600;

export function buildEmber(map: Texture): EmberView {
  // Normal blending with a solid warm core: an additive glow vanishes against a bright real room.
  const sprite = new Sprite(new SpriteMaterial({ map, depthWrite: false, transparent: true, toneMapped: false }));
  sprite.name = 'ember';
  sprite.scale.setScalar(EMBER_M);
  sprite.renderOrder = 200;
  sprite.visible = false;
  const want = new Vector3();
  const from = new Vector3();
  let started = false;
  return {
    sprite,
    search(head, forward, searchMs) {
      const flat = Math.hypot(forward.x, forward.z) || 1;
      const sink = Math.min(1, searchMs / SINK_MS);
      const s = searchMs / 1000;
      want.set(
        head.x + (forward.x / flat) * AHEAD_M + Math.sin(s * 1.4) * 0.02,
        head.y - 0.12 - 0.3 * (1 - (1 - sink) ** 3) + Math.sin(s * 2.3) * 0.008,
        head.z + (forward.z / flat) * AHEAD_M,
      );
      // It drifts after your gaze rather than sticking to it, so it reads as a thing in the room.
      if (!started) sprite.position.copy(want);
      else sprite.position.lerp(want, 0.04);
      started = true;
      sprite.visible = true;
      sprite.scale.setScalar(EMBER_M * (1 + 0.06 * Math.sin(s * 9)));
      from.copy(sprite.position);
    },
    land(target, remaining) {
      if (remaining <= 0) {
        sprite.visible = false;
        return;
      }
      sprite.visible = true;
      sprite.position.lerpVectors(target, from, remaining * remaining);
      sprite.scale.setScalar(EMBER_M * (0.6 + 0.4 * remaining));
    },
    hide() {
      sprite.visible = false;
      started = false;
    },
  };
}
