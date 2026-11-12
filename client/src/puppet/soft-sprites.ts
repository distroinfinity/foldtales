import { CanvasTexture, DoubleSide, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace } from '@iwsdk/core';

const SIZE = 128;

/** A round gradient. Stops go from the middle (0) to the edge (1). */
export function radialTexture(stops: Array<[number, string]>): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(SIZE / 2, SIZE / 2, 0, SIZE / 2, SIZE / 2, SIZE / 2);
  for (const [offset, color] of stops) gradient.addColorStop(offset, color);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, SIZE, SIZE);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** A soft, depth-respecting plane that never writes depth, for shadows and glows. */
export function softPlane(texture: CanvasTexture, width: number, height: number): Mesh {
  const material = new MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, side: DoubleSide, toneMapped: false });
  return new Mesh(new PlaneGeometry(width, height), material);
}
