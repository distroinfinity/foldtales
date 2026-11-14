import { Mesh, PlaneGeometry, ShaderMaterial, Vector2, Vector3, Vector4 } from '@iwsdk/core';
import type { TexRef } from '../paint/texref.ts';
import type { RoomMap } from './room-map.ts';
import type { Lasting } from './state.ts';

/**
 * Your window becomes the story's window: the real window from Space Setup shows the shore at night,
 * the lighthouse on its headland, the moon and the sea, with the lamp's beam turning out there in
 * time with the book's. The painting fills the glass a little inside the frame, so the real frame
 * still shows round it.
 */

/** The window's painting, made for free from the shore's layers (`art/tools/make_window_night.py`). */
export const WINDOW_ART = 'fx/window-night.png';
/** The part of the painting a window shows: inside the sky's painted edge, round the lighthouse and the sea. */
const VIEW = { u0: 0.1, u1: 0.92, v0: 0.0, v1: 0.9 };
/** Where the lighthouse lamp is in the painting, measured from the headland layer. */
const LAMP_UV = new Vector2(0.197, 0.852);
/** The glass only, inside the real frame. */
const INSET = 0.9;
const FADE_MS = 3000;
/** One full turn of the lamp, as the book's beam turns. */
const TURN_MS = 7000;

export interface WindowView {
  mesh: Mesh;
  frame(opts: { state: Lasting; nowMs: number; room: RoomMap; bookOpen: boolean }): void;
}

export function createWindowView(art: TexRef): WindowView {
  const material = new ShaderMaterial({
    uniforms: {
      uMap: { value: art.texture },
      uRect: { value: new Vector4(...art.uv) },
      uView: { value: new Vector4(VIEW.u0, VIEW.v0, VIEW.u1, VIEW.v1) },
      uLamp: { value: LAMP_UV },
      uAngle: { value: 0 },
      uFade: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform vec4 uRect, uView;
      uniform vec2 uLamp;
      uniform float uAngle, uFade;
      varying vec2 vUv;
      void main() {
        // vUv covers the glass; uView is the part of the painting it shows, already fitted to the glass.
        vec2 p = mix(uView.xy, uView.zw, vUv);
        vec3 c = texture2D(uMap, mix(uRect.xy, uRect.zw, p)).rgb;
        // The lamp's beam, seen from the side: a soft band reaching out from the lamp as it turns,
        // longest side-on, and a bright flare as it faces you.
        float s = sin(uAngle), f = cos(uAngle);
        vec2 d = p - uLamp;
        d.x *= 2.1;
        float along = d.x * sign(s);
        float reach = abs(s) * 1.1;
        float band = step(0.0, along) * (1.0 - smoothstep(reach * 0.6, reach, along))
          * exp(-pow(d.y / (0.012 + 0.05 * along), 2.0));
        float flare = pow(max(f, 0.0), 10.0) * exp(-dot(d, d) * 60.0);
        float glow = exp(-dot(d, d) * 900.0);
        c += vec3(1.0, 0.86, 0.55) * (0.55 * band + 0.9 * flare + 0.6 * glow);
        // Soft at the edge of the glass, as a view is through a frame.
        vec2 e = min(vUv, 1.0 - vUv);
        float edge = smoothstep(0.0, 0.035, min(e.x, e.y));
        gl_FragColor = vec4(c * edge * uFade, edge * uFade);
      }`,
    transparent: true,
    premultipliedAlpha: true,
    depthWrite: false,
    toneMapped: false,
  });
  const mesh = new Mesh(new PlaneGeometry(1, 1), material);
  mesh.name = 'window-view';
  mesh.visible = false;
  mesh.renderOrder = -800;
  const tmp = new Vector3();
  let wasOn = false;
  let changedAt = -Infinity;

  return {
    mesh,
    frame({ state, nowMs, room, bookOpen }) {
      if (state.on !== wasOn) {
        wasOn = state.on;
        changedAt = nowMs - Math.min(state.sinceMs, FADE_MS);
      }
      const t = Math.min(1, (nowMs - changedAt) / FADE_MS);
      const fade = (state.on ? t : 1 - t) * (bookOpen ? 1 : 0);
      // The nearest real window only: with none, this effect is never offered.
      const glass = room.places().find((p) => p.label === 'window') ?? null;
      if (fade <= 0.001 || !glass) {
        mesh.visible = false;
        return;
      }
      const [w, h] = glass.sizeM;
      mesh.position.copy(glass.centre).addScaledVector(glass.normal, 0.008);
      mesh.lookAt(tmp.copy(mesh.position).add(glass.normal));
      mesh.scale.set(w * INSET, h * INSET, 1);
      // Fit the painting to the glass's shape: as wide a part of the view as the window's shape allows.
      const view = material.uniforms.uView!.value as Vector4;
      const artAspect = ((VIEW.u1 - VIEW.u0) * art.sizePx[0]) / ((VIEW.v1 - VIEW.v0) * art.sizePx[1]);
      const aspect = w / Math.max(0.05, h);
      if (aspect < artAspect) {
        // A tall window: a slice, kept round the lighthouse and the sea beside it.
        const span = ((VIEW.u1 - VIEW.u0) * aspect) / artAspect;
        const centre = Math.min(VIEW.u1 - span / 2, Math.max(VIEW.u0 + span / 2, LAMP_UV.x + span * 0.32));
        view.set(centre - span / 2, VIEW.v0, centre + span / 2, VIEW.v1);
      } else {
        const span = ((VIEW.v1 - VIEW.v0) * artAspect) / aspect;
        view.set(VIEW.u0, VIEW.v0, VIEW.u1, VIEW.v0 + span);
      }
      material.uniforms.uAngle!.value = ((nowMs % TURN_MS) / TURN_MS) * Math.PI * 2;
      material.uniforms.uFade!.value = fade;
      mesh.visible = true;
    },
  };
}
