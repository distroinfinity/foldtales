import type { Texture } from '@iwsdk/core';

/**
 * A painted piece: its texture, its true pixel size, and where it sits in that texture (an atlas
 * rectangle, a padded KTX2 file, or the whole PNG). `baked` means its alpha is already premultiplied.
 */
export interface TexRef {
  texture: Texture;
  sizePx: [number, number];
  /** u0, v0, u1, v1 with v up, as Three's UVs are. */
  uv: [number, number, number, number];
  baked: boolean;
}

export function wholeRef(texture: Texture): TexRef {
  const image = texture.image as { width: number; height: number } | undefined;
  return { texture, sizePx: [image?.width ?? 1, image?.height ?? 1], uv: [0, 0, 1, 1], baked: false };
}

/** A part of a piece, as fractions of it, mapped into its texture. */
export function subUv(ref: TexRef, u: [number, number], v: [number, number] = [0, 1]): { u: [number, number]; v: [number, number] } {
  const [u0, v0, u1, v1] = ref.uv;
  return { u: [u0 + (u1 - u0) * u[0], u0 + (u1 - u0) * u[1]], v: [v0 + (v1 - v0) * v[0], v0 + (v1 - v0) * v[1]] };
}
