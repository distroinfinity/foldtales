import { DoubleSide, Matrix4, Mesh, NormalBlending, PerspectiveCamera, PlaneGeometry, ShaderMaterial, Vector3, WebGLRenderTarget, type Object3D, type Scene, type WebGLRenderer } from '@iwsdk/core';
import { stageLook } from '../paint/card-material.ts';
import type { RoomMap } from './room-map.ts';
import type { Lasting } from './state.ts';

/**
 * Shadow play on your wall. A light just in front of the book throws the cast's shadows onto the
 * real wall behind it, magnified as a candle's would be: a character waves, and its huge shadow waves
 * back, because the shadow is drawn from its own cards. In a dimmed room a shadow only reads inside
 * light, so the wall gets a warm pool too, through the room dim.
 */

/** The cast's cards carry this layer too, so the shadow's camera draws only them. */
export const SHADOW_LAYER = 5;
const SIZE_PX = 256;
const FOV_DEG = 70;
/** About twelve poses a second, as the cast moves. */
const EVERY_FRAMES = 7;
const FADE_MS = 1500;

export interface ShadowPlay {
  /** The shadow on the wall. Add it to the scene once. */
  mesh: Mesh;
  /** Each XR frame, after the show's frame. */
  frame(opts: {
    renderer: WebGLRenderer;
    scene: Scene;
    shadows: Lasting;
    bookOpen: boolean;
    bookRoot: Object3D;
    pageY: number;
    cast: Object3D[];
    room: RoomMap;
    /** Lights the wall around the shadow. */
    lift: (at: Vector3, radiusM: number, strength: number) => void;
  }): void;
}

/** Puts every painted card under `root` on the shadow layer as well. */
export function castShadows(root: Object3D): void {
  root.traverse((o) => {
    const material = (o as Mesh).material as { userData?: { card?: boolean } } | undefined;
    if ((o as Mesh).isMesh && material?.userData?.card) o.layers.enable(SHADOW_LAYER);
  });
}

export function createShadowPlay(): ShadowPlay {
  const target = new WebGLRenderTarget(SIZE_PX, SIZE_PX, { depthBuffer: false });
  const camera = new PerspectiveCamera(FOV_DEG, 1, 0.005, 20);
  camera.layers.set(SHADOW_LAYER);
  const material = new ShaderMaterial({
    uniforms: {
      uMap: { value: target.texture },
      uShadow: { value: new Matrix4() },
      uStrength: { value: 0 },
      uTexel: { value: 1 / SIZE_PX },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main() {
        vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform mat4 uShadow;
      uniform float uStrength, uTexel;
      varying vec3 vWorld;
      void main() {
        vec4 p = uShadow * vec4(vWorld, 1.0);
        if (p.w <= 0.0) discard;
        vec2 uv = p.xy / p.w * 0.5 + 0.5;
        if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) discard;
        // A soft edge, like a candle's shadow: five taps, a little apart.
        float d = 2.5 * uTexel;
        float a = texture2D(uMap, uv).a * 0.4
          + (texture2D(uMap, uv + vec2(d, 0.0)).a + texture2D(uMap, uv - vec2(d, 0.0)).a
          + texture2D(uMap, uv + vec2(0.0, d)).a + texture2D(uMap, uv - vec2(0.0, d)).a) * 0.15;
        if (a < 0.01) discard;
        // Warm night-navy, never pure black: a painted shadow, not a hole.
        gl_FragColor = vec4(0.07, 0.06, 0.09, a * uStrength * 0.72);
      }`,
    transparent: true,
    blending: NormalBlending,
    depthWrite: false,
    side: DoubleSide,
    toneMapped: false,
  });
  const mesh = new Mesh(new PlaneGeometry(1, 1), material);
  mesh.name = 'shadow-play';
  mesh.frustumCulled = false;
  mesh.visible = false;
  mesh.renderOrder = -900;

  let frames = 0;
  const light = new Vector3();
  const centroid = new Vector3();
  const hit = new Vector3();
  const tmp = new Vector3();
  const matrix = new Matrix4();
  let wasOn = false;
  let since = 0;

  /** Where the ray from the light through the cast meets a wall facing it, nearest first. */
  const wallHit = (room: RoomMap, from: Vector3, through: Vector3): { at: Vector3; normal: Vector3 } | null => {
    const dir = through.clone().sub(from).normalize();
    let best: { at: Vector3; normal: Vector3; t: number } | null = null;
    for (const p of room.places()) {
      if (p.horizontal || p.label !== 'wall') continue;
      const facing = dir.dot(p.normal);
      if (facing >= -0.2) continue;
      const t = tmp.copy(p.centre).sub(from).dot(p.normal) / facing;
      if (t <= 0.3) continue;
      const at = from.clone().addScaledVector(dir, t);
      // Within the wall's width, roughly: a ray past its end hits the next wall instead.
      const along = Math.hypot(at.x - p.centre.x, at.z - p.centre.z);
      if (along > p.sizeM[0] / 2 + 0.3) continue;
      if (!best || t < best.t) best = { at, normal: p.normal.clone(), t };
    }
    if (best) return best;
    const stand = room.resolve('room:wall', 'face');
    if (!stand) return null;
    const facing = dir.dot(stand.normal);
    if (facing >= -0.1) return { at: stand.centre.clone(), normal: stand.normal.clone() };
    const t = tmp.copy(stand.centre).sub(from).dot(stand.normal) / facing;
    return { at: from.clone().addScaledVector(dir, t), normal: stand.normal.clone() };
  };

  return {
    mesh,
    frame({ renderer, scene, shadows, bookOpen, bookRoot, pageY, cast, room, lift }) {
      if (shadows.on !== wasOn) {
        wasOn = shadows.on;
        since = performance.now() - Math.min(shadows.sinceMs, FADE_MS);
      }
      const t = Math.min(1, (performance.now() - since) / FADE_MS);
      const strength = (shadows.on ? t : 1 - t) * (bookOpen ? 1 : 0);
      if (strength <= 0.001 || cast.length === 0) {
        mesh.visible = false;
        return;
      }
      // The light: just in front of the cast, toward you, a little above the page.
      const scale = bookRoot.getWorldScale(tmp).x || 1;
      light.set(0, pageY + 0.06, 0.32);
      bookRoot.localToWorld(light);
      centroid.set(0, 0, 0);
      for (const c of cast) centroid.add(c.getWorldPosition(tmp));
      centroid.multiplyScalar(1 / cast.length);
      centroid.y += 0.07 * scale;
      const wall = wallHit(room, light, centroid);
      if (!wall) {
        mesh.visible = false;
        return;
      }
      hit.copy(wall.at);
      camera.position.copy(light);
      camera.lookAt(centroid);
      camera.updateMatrixWorld();
      matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      material.uniforms.uShadow!.value.copy(matrix);
      material.uniforms.uStrength!.value = strength;

      // The quad lies on the wall, a hair in front of it, covering the light's whole throw.
      const distance = light.distanceTo(hit);
      const side = 2 * distance * Math.tan(((FOV_DEG / 2) * Math.PI) / 180) * 1.4;
      mesh.position.copy(hit).addScaledVector(wall.normal, 0.01);
      mesh.lookAt(tmp.copy(mesh.position).add(wall.normal));
      mesh.scale.set(side, side, 1);
      mesh.visible = true;
      lift(hit, Math.min(1.4, side * 0.3), 0.75 * strength);

      // The silhouettes, about twelve times a second, as the cast moves.
      if (frames++ % EVERY_FRAMES !== 0) return;
      const xr = renderer.xr.enabled;
      const previous = renderer.getRenderTarget();
      const clearAlpha = renderer.getClearAlpha();
      renderer.xr.enabled = false;
      stageLook.silhouette.value = 1;
      renderer.setRenderTarget(target);
      renderer.setClearAlpha(0);
      renderer.clear(true, false, false);
      renderer.render(scene, camera);
      stageLook.silhouette.value = 0;
      renderer.setRenderTarget(previous);
      renderer.setClearAlpha(clearAlpha);
      renderer.xr.enabled = xr;
    },
  };
}
