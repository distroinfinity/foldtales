import { BackSide, Mesh, ShaderMaterial, SphereGeometry, Vector3 } from '@iwsdk/core';

/** House lights down: how dark the room's edges get. One value, so it can go darker later. */
export const MAX_DIM = 0.8;
/** The warm pool around the book is still a little dimmed, so it reads as lamplight, not daylight. */
const POOL_DIM = 0.1;
const RADIUS_M = 3;
const DEFAULT_FALLOFF = 0.3;

export interface DimRing {
  /** Angle from the book's direction where the dark starts rising. */
  inner: number;
  /** Where it reaches full. */
  outer: number;
}

/**
 * The pool hugs the book as you see it, and the dark rises quickly past it: the first headset session
 * showed a wide, slow falloff leaves most of the room you're looking at still lit.
 */
export function dimRing(bookDistanceM: number, bookWidthM: number, falloff = DEFAULT_FALLOFF): DimRing {
  const inner = Math.atan((bookWidthM * 0.5) / Math.max(0.2, bookDistanceM));
  return { inner, outer: inner + falloff };
}

const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Mirrors the shader: how dark the room is at an angle from the book. */
export function dimAlpha(angle: number, dim: number, ring: DimRing): number {
  if (dim <= 0) return 0;
  return dim * (POOL_DIM + (MAX_DIM - POOL_DIM) * smoothstep(ring.inner, ring.outer, angle));
}

export interface BeamLight {
  /** The lighthouse lamp, in world space. */
  lamp: Vector3;
  /** Radians about up, in world space. */
  azimuth: number;
  strength: number;
}

export interface DimView {
  mesh: Mesh;
  /** Positions on your head each frame, so the room around you dims and the book stays lit. */
  update(head: Vector3, book: Vector3, bookWidthM: number, dim: number, beam?: BeamLight | null): void;
  /** Review only: adjusts the darkness, the pool's own dimming and the falloff, live. */
  tune(shape: { max?: number; pool?: number; falloff?: number }): void;
}

/** Half the beam's width, in radians, as it falls on your walls. */
const BEAM_HALF = 0.22;

/**
 * A sphere around your head, drawn once and before the stage, over passthrough only. It
 * tests depth but never writes it, so the book and cards always draw over it.
 */
export function buildDim(): DimView {
  const material = new ShaderMaterial({
    uniforms: {
      uDim: { value: 0 },
      uMax: { value: MAX_DIM },
      uPool: { value: POOL_DIM },
      uBookDir: { value: new Vector3(0, -0.5, -1).normalize() },
      uInner: { value: 0.5 },
      uOuter: { value: 1.2 },
      uLamp: { value: new Vector3() },
      uBeamAz: { value: 0 },
      uBeamStrength: { value: 0 },
      uBeamHalf: { value: BEAM_HALF },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      varying vec3 vWorld;
      void main() {
        vDir = normalize((modelMatrix * vec4(position, 0.0)).xyz);
        vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uDim, uMax, uPool, uInner, uOuter, uBeamAz, uBeamStrength, uBeamHalf;
      uniform vec3 uBookDir, uLamp;
      varying vec3 vDir;
      varying vec3 vWorld;
      void main() {
        float angle = acos(clamp(dot(normalize(vDir), uBookDir), -1.0, 1.0));
        float edge = smoothstep(uInner, uOuter, angle);
        float alpha = uDim * mix(uPool, uMax, edge);
        // Night navy at the edges, a faint warm amber in the pool around the book.
        vec3 color = mix(vec3(0.09, 0.07, 0.04), vec3(0.03, 0.04, 0.10), edge);
        // The lamp's beam, seen from the lamp: where it falls, the dim lifts and your walls warm.
        vec2 fromLamp = vWorld.xz - uLamp.xz;
        float az = atan(fromLamp.x, fromLamp.y);
        float off = abs(mod(az - uBeamAz + 3.14159265, 6.2831853) - 3.14159265);
        float band = 1.0 - smoothstep(0.6, 1.8, abs(vWorld.y - uLamp.y));
        float beam = uBeamStrength * band * (1.0 - smoothstep(uBeamHalf * 0.3, uBeamHalf, off));
        alpha *= 1.0 - 0.9 * beam;
        gl_FragColor = vec4(color * alpha + vec3(1.0, 0.8, 0.48) * 0.24 * beam, alpha);
      }`,
    side: BackSide,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    premultipliedAlpha: true,
    toneMapped: false,
  });
  const mesh = new Mesh(new SphereGeometry(RADIUS_M, 48, 24), material);
  mesh.name = 'room-dim';
  mesh.renderOrder = -1000;
  mesh.frustumCulled = false;
  const toBook = new Vector3();
  let falloff = DEFAULT_FALLOFF;
  return {
    mesh,
    tune(shape) {
      if (shape.max !== undefined) material.uniforms.uMax!.value = shape.max;
      if (shape.pool !== undefined) material.uniforms.uPool!.value = shape.pool;
      if (shape.falloff !== undefined) falloff = shape.falloff;
    },
    update(head, book, bookWidthM, dim, beam) {
      material.uniforms.uBeamStrength!.value = beam?.strength ?? 0;
      if (beam) {
        material.uniforms.uLamp!.value.copy(beam.lamp);
        material.uniforms.uBeamAz!.value = beam.azimuth;
      }
      mesh.position.copy(head);
      mesh.visible = dim > 0.001;
      toBook.subVectors(book, head);
      const ring = dimRing(toBook.length(), bookWidthM, falloff);
      material.uniforms.uBookDir!.value.copy(toBook.normalize());
      material.uniforms.uInner!.value = ring.inner;
      material.uniforms.uOuter!.value = ring.outer;
      material.uniforms.uDim!.value = dim;
    },
  };
}
