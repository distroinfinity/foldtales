import { Mesh, PlaneGeometry, ShaderMaterial, Vector2, Vector3, Vector4 } from '@iwsdk/core';
import type { TexRef } from '../paint/texref.ts';
import type { RoomMap } from './room-map.ts';
import type { Lasting } from './state.ts';

/**
 * A window onto the story: the shore at night, the lighthouse on its headland, the moon and the sea,
 * with the lamp's beam turning out there in time with the book's. It opens on whatever the room has
 * (owner, Nov 15: "wall, window, anything that we can use, but not trying to fit it"):
 * - a real window (or a door): the painting fills it, a little inside its frame;
 * - a wall: a painted opening with a soft watercolour edge, on the wall you face, beside the book;
 * - no scan at all: the same opening on a stand-in wall ahead.
 * Once open it stays where it opened, wherever you look.
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
/** A painted opening on a wall: about this big, smaller on a small wall. */
const OPENING_M: [number, number] = [1.6, 1.1];
/** Beside the book, not behind it (where the shadows fall): this far round from straight ahead. */
const ASIDE_RAD = 0.35;
/** A real window is used only if it's this far round from where you face (owner: never behind you). */
const IN_VIEW_RAD = (70 * Math.PI) / 180;
/** One full turn of the lamp, as the book's beam turns. */
const TURN_MS = 7000;

export interface WindowView {
  mesh: Mesh;
  /** `book`: where the book is; you face it, so that's the way "in front of you" means. */
  frame(opts: { state: Lasting; nowMs: number; room: RoomMap; bookOpen: boolean; head: Vector3; forward: Vector3; book: Vector3 | null }): void;
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
      uOpening: { value: 0 },
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
      uniform float uAngle, uFade, uOpening;
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
        // In glass: soft at the edge, as a view is through a frame. On a wall: a painted opening, a
        // rounded shape with an uneven watercolour edge and a little pooled colour round it.
        vec2 e = min(vUv, 1.0 - vUv);
        float edge = smoothstep(0.0, 0.035, min(e.x, e.y));
        if (uOpening > 0.5) {
          vec2 q = (vUv - 0.5) * 2.0;
          float r = pow(pow(abs(q.x), 3.0) + pow(abs(q.y), 3.0), 1.0 / 3.0);
          float a = atan(q.y, q.x);
          r += 0.035 * sin(a * 5.0 + 1.3) + 0.025 * sin(a * 11.0 + 0.4) + 0.015 * sin(a * 23.0);
          edge = 1.0 - smoothstep(0.84, 0.97, r);
          c *= 1.0 - 0.28 * smoothstep(0.7, 0.92, r);
        }
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
  /** Where it opened, fixed until it closes. */
  let spot: { centre: Vector3; normal: Vector3; size: [number, number]; opening: boolean } | null = null;

  /** The real wall the reader faces, a little to the side of the book, or the stand-in wall. */
  const wallAside = (room: RoomMap, head: Vector3, forward: Vector3) => {
    const flat = new Vector3(forward.x, 0, forward.z).normalize();
    for (const turn of [ASIDE_RAD, -ASIDE_RAD, 0]) {
      const dir = flat.clone().applyAxisAngle(new Vector3(0, 1, 0), turn);
      let best: { place: (ReturnType<RoomMap['places']>)[number]; at: Vector3; t: number } | null = null;
      for (const p of room.places()) {
        if (p.horizontal || p.label !== 'wall') continue;
        const facing = dir.dot(p.normal);
        if (facing >= -0.3) continue;
        const t = tmp.copy(p.centre).sub(head).dot(p.normal) / facing;
        if (t <= 0.4) continue;
        const at = head.clone().addScaledVector(dir, t);
        if (Math.hypot(at.x - p.centre.x, at.z - p.centre.z) > p.sizeM[0] / 2 - 0.3) continue;
        if (!best || t < best.t) best = { place: p, at, t };
      }
      if (best) return best;
    }
    const stand = room.resolve('room:wall', 'face');
    return stand ? { place: stand, at: stand.centre.clone(), t: 0 } : null;
  };

  /** Chooses where the window opens: the named place, else a real window, else a wall beside the book. */
  const choose = (room: RoomMap, at: string | null, head: Vector3, forward: Vector3): typeof spot => {
    const named = at ? room.resolve(at, 'face') : null;
    // Only a window you can see without turning round: within reach of where you face, left or right.
    const flat = new Vector3(forward.x, 0, forward.z).normalize();
    const inView = (p: { centre: Vector3 }) => flat.angleTo(new Vector3(p.centre.x - head.x, 0, p.centre.z - head.z)) < IN_VIEW_RAD;
    let best: ReturnType<RoomMap['places']>[number] | null = null;
    if (!at || named?.label === 'window') {
      for (const p of room.places()) {
        if (p.label !== 'window' || !inView(p)) continue;
        // The most nearly ahead.
        const a = flat.angleTo(new Vector3(p.centre.x - head.x, 0, p.centre.z - head.z));
        if (!best || a < flat.angleTo(new Vector3(best.centre.x - head.x, 0, best.centre.z - head.z))) best = p;
      }
    }
    const glass = named?.label === 'door' && inView(named) ? named : best;
    if (glass) return { centre: glass.centre.clone(), normal: glass.normal.clone(), size: [glass.sizeM[0] * INSET, glass.sizeM[1] * INSET], opening: false };
    // A wall by its own id opens there; "a wall" means the one you face, beside the book.
    const exact = !!at && /-[0-9]+$/.test(at);
    const wall = named && !named.horizontal && exact ? { place: named, at: named.centre.clone() } : wallAside(room, head, forward);
    if (!wall) return null;
    const { place } = wall;
    const w = Math.min(OPENING_M[0], place.sizeM[0] * 0.8);
    const h = Math.min(OPENING_M[1], place.sizeM[1] * 0.7);
    // Kept whole on the wall: slid along it, away from its ends.
    const side = new Vector3(0, 1, 0).cross(place.normal).normalize();
    const along = wall.at.clone().sub(place.centre).dot(side);
    const slack = Math.max(0, place.sizeM[0] / 2 - w / 2 - 0.1);
    const centre = place.centre.clone().addScaledVector(side, Math.max(-slack, Math.min(slack, along)));
    // At about eye height, and kept on the wall.
    const low = place.centre.y - place.sizeM[1] / 2 + h / 2 + 0.1;
    const high = place.centre.y + place.sizeM[1] / 2 - h / 2 - 0.1;
    centre.y = Math.min(Math.max(head.y + 0.1, low), Math.max(low, high));
    return { centre, normal: place.normal.clone(), size: [w, h], opening: true };
  };

  return {
    mesh,
    frame({ state, nowMs, room, bookOpen, head, forward, book }) {
      if (state.on !== wasOn) {
        wasOn = state.on;
        changedAt = nowMs - Math.min(state.sinceMs, FADE_MS);
        if (state.on) spot = null;
      }
      const t = Math.min(1, (nowMs - changedAt) / FADE_MS);
      const fade = (state.on ? t : 1 - t) * (bookOpen ? 1 : 0);
      if (fade <= 0.001) {
        mesh.visible = false;
        if (!state.on) spot = null;
        return;
      }
      // You face the book, whatever your head is doing the moment it opens.
      const facing = book ? tmp.copy(book).sub(head).setY(0) : forward;
      if (facing.lengthSq() < 1e-4) facing.copy(forward);
      spot ??= choose(room, state.at, head, facing.clone());
      if (!spot) {
        mesh.visible = false;
        return;
      }
      const [w, h] = spot.size;
      mesh.position.copy(spot.centre).addScaledVector(spot.normal, 0.008);
      mesh.lookAt(tmp.copy(mesh.position).add(spot.normal));
      mesh.scale.set(w, h, 1);
      material.uniforms.uOpening!.value = spot.opening ? 1 : 0;
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
