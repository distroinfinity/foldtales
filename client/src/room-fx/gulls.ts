import { DoubleSide, Mesh, NormalBlending, PlaneGeometry, ShaderMaterial, Vector3, Vector4 } from '@iwsdk/core';
import type { TexRef } from '../paint/texref.ts';
import type { RoomMap } from './room-map.ts';
import type { Lasting } from './state.ts';

/**
 * Gulls in your room: two of run 015's painted gulls fly in from your window's side (or from far off
 * ahead), flapping, and settle on a shelf or the back of your couch, then look about now and then.
 * Called off, they fly away the way they came. Scenery, not cast: no voices, no lines.
 */

export const GULL_ART = { perched: 'room-fx/gulls/gull-perched.png', up: 'room-fx/gulls/gull-up.png', down: 'room-fx/gulls/gull-down.png' } as const;
const GULLS = 2;
/** A gull stands about this tall perched. */
const HEIGHT_M = 0.24;
const FLY_MS = 4000;
const FLAPS_PER_S = 3.2;

type Pose = 'perched' | 'up' | 'down';

export interface GullsView {
  meshes: Mesh[];
  frame(opts: { state: Lasting; nowMs: number; room: RoomMap; head: Vector3; book: Vector3 | null; bookOpen: boolean; onCall: (at: Vector3) => void }): void;
}

const ease = (t: number) => t * t * (3 - 2 * t);

export function createGulls(art: Record<Pose, TexRef>): GullsView {
  const material = (ref: TexRef) =>
    new ShaderMaterial({
      uniforms: { uMap: { value: ref.texture }, uRect: { value: new Vector4(...ref.uv) }, uAlpha: { value: 1 }, uFlip: { value: 0 } },
      vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap; uniform vec4 uRect; uniform float uAlpha, uFlip; varying vec2 vUv;
        void main() {
          vec2 uv = vec2(mix(vUv.x, 1.0 - vUv.x, uFlip), vUv.y);
          vec4 c = texture2D(uMap, mix(uRect.xy, uRect.zw, uv));
          float a = c.a * uAlpha;
          if (a < 0.01) discard;
          gl_FragColor = vec4(c.rgb * a, a);
        }`,
      transparent: true,
      premultipliedAlpha: true,
      depthWrite: false,
      side: DoubleSide,
      toneMapped: false,
    });
  const birds = Array.from({ length: GULLS }, (_, i) => {
    const poses = {} as Record<Pose, { mesh: Mesh; material: ShaderMaterial }>;
    for (const pose of ['perched', 'up', 'down'] as const) {
      const m = material(art[pose]);
      const mesh = new Mesh(new PlaneGeometry(1, 1), m);
      mesh.name = `gull-${i + 1}-${pose}`;
      mesh.renderOrder = 427;
      mesh.visible = false;
      const ref = art[pose];
      // The perched gull sets the scale; flying ones share it, so a gull stays one size.
      const pxPerM = art.perched.sizePx[1] / HEIGHT_M;
      mesh.scale.set(ref.sizePx[0] / pxPerM, ref.sizePx[1] / pxPerM, 1);
      poses[pose] = { mesh, material: m };
    }
    return { poses, phase: i * 0.37 };
  });
  const meshes = birds.flatMap((b) => Object.values(b.poses).map((p) => p.mesh));

  /** Where they come from and where they settle, fixed while they're here. */
  let route: { from: Vector3; perch: Vector3[] } | null = null;
  let wasOn = false;
  let changedAt = -Infinity;
  /** When they last called: as they come in, then now and then while they're perched. */
  let calledAt = -Infinity;
  const at = new Vector3();

  const plan = (room: RoomMap, head: Vector3, book: Vector3 | null, place: string | null): typeof route => {
    const ahead = (book ? book.clone().sub(head) : new Vector3(0, 0, -1)).setY(0).normalize();
    // Where you can see them (owner, on the window: never behind you): the most nearly ahead of a
    // shelf, the couch, a bed or a table, but not the table the book stands on. A named place wins.
    const angleOf = (p: { centre: Vector3 }) => ahead.angleTo(new Vector3(p.centre.x - head.x, 0, p.centre.z - head.z));
    const inView = room
      .places()
      .filter((p) => p.horizontal && ['shelf', 'storage', 'couch', 'bed', 'table'].includes(p.label) && angleOf(p) < (70 * Math.PI) / 180)
      .filter((p) => !book || Math.hypot(p.centre.x - book.x, p.centre.z - book.z) > 0.6)
      .sort((a, b) => angleOf(a) - angleOf(b));
    const target = (place ? room.resolve(place, 'rest') : null) ?? inView[0] ?? room.resolve('room:shelf', 'rest');
    if (!target) return null;
    const window = room.resolve('room:window', 'face');
    const from = window?.label === 'window' ? window.centre.clone().addScaledVector(window.normal, -0.5) : head.clone().addScaledVector(ahead, 4).setY(head.y + 0.6);
    // Two spots on the top, a little apart, along its longer side.
    const side = new Vector3(-ahead.z, 0, ahead.x);
    const spread = Math.min(0.25, Math.max(0.12, target.sizeM[0] * 0.25));
    const y = target.centre.y + HEIGHT_M / 2;
    return { from, perch: [target.centre.clone().addScaledVector(side, -spread).setY(y), target.centre.clone().addScaledVector(side, spread).setY(y)] };
  };

  return {
    meshes,
    frame({ state, nowMs, room, head, book, bookOpen, onCall }) {
      if (state.on !== wasOn) {
        wasOn = state.on;
        changedAt = nowMs - Math.min(state.sinceMs, FLY_MS);
        if (state.on) route = null;
      }
      const since = nowMs - changedAt;
      const leaving = !state.on;
      if (!bookOpen || (leaving && since > FLY_MS) || (!state.on && !route)) {
        for (const m of meshes) m.visible = false;
        if (leaving && since > FLY_MS) route = null;
        return;
      }
      route ??= plan(room, head, book, state.at);
      if (!route) return;
      const t = nowMs / 1000;
      // They call as they come in and as they go, and every so often while they're perched.
      if (since < 300 && nowMs - calledAt > 2000) {
        calledAt = nowMs;
        onCall(leaving ? route.perch[0]!.clone() : route.from.clone());
      } else if (state.on && since > FLY_MS && nowMs - calledAt > 9000 + 6000 * Math.abs(Math.sin(nowMs * 0.001))) {
        calledAt = nowMs;
        onCall(route.perch[0]!.clone());
      }
      birds.forEach((bird, i) => {
        // Arriving: from the window toward the perch; leaving: back the way they came. The second follows a moment later.
        const lag = i * 500;
        const p = Math.max(0, Math.min(1, (since - lag) / FLY_MS));
        const flying = leaving ? p > 0 && p < 1 : p < 1;
        const travel = ease(p);
        const a = leaving ? route!.perch[i]! : route!.from;
        const b = leaving ? route!.from : route!.perch[i]!;
        at.copy(a).lerp(b, travel);
        // A soft arc: up in the middle of the flight.
        if (flying) at.y += 0.35 * Math.sin(Math.PI * travel);
        const flap = Math.sin((t + bird.phase) * FLAPS_PER_S * Math.PI * 2) > 0 ? 'up' : 'down';
        const pose: Pose = flying ? flap : 'perched';
        // Which way it moves across your view: the paintings face right, so flip only when it flies left.
        const toEye = new Vector3(head.x - at.x, 0, head.z - at.z).normalize();
        const viewRight = new Vector3(0, 1, 0).cross(toEye);
        const heading = b.clone().sub(a).dot(viewRight);
        for (const [name, { mesh, material }] of Object.entries(bird.poses)) {
          mesh.visible = name === pose && !(leaving && p >= 1);
          if (!mesh.visible) continue;
          mesh.position.copy(at);
          // A perched gull now and then turns its head: a small, quick tilt.
          if (!flying) mesh.position.y += 0.004 * Math.max(0, Math.sin(t * 0.7 + bird.phase * 9)) ** 8;
          mesh.lookAt(head.x, mesh.position.y, head.z);
          // Facing the way it flies; perched, a pair looks different ways.
          material.uniforms.uFlip!.value = flying ? (heading < 0 ? 1 : 0) : i % 2;
          material.uniforms.uAlpha!.value = 1;
        }
      });
    },
  };
}
