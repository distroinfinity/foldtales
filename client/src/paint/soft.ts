import { CanvasTexture, SRGBColorSpace } from '@iwsdk/core';

const SIZE = 128;

function canvasTexture(draw: (ctx: CanvasRenderingContext2D) => void): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  draw(canvas.getContext('2d')!);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** A round gradient. Stops go from the middle (0) to the edge (1). */
export function radialTexture(stops: Array<[number, string]>): CanvasTexture {
  return canvasTexture((ctx) => {
    const gradient = ctx.createRadialGradient(SIZE / 2, SIZE / 2, 0, SIZE / 2, SIZE / 2, SIZE / 2);
    for (const [offset, color] of stops) gradient.addColorStop(offset, color);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, SIZE, SIZE);
  });
}

/** A straight gradient, darkest at one edge. `bottom` is dark at v=0, `left` dark at u=0. */
export function edgeTexture(edge: 'bottom' | 'left', color: string): CanvasTexture {
  return canvasTexture((ctx) => {
    const gradient = edge === 'bottom' ? ctx.createLinearGradient(0, SIZE, 0, 0) : ctx.createLinearGradient(0, 0, SIZE, 0);
    gradient.addColorStop(0, color);
    gradient.addColorStop(0.35, color.replace(/[\d.]+\)$/, (a) => `${Number.parseFloat(a) * 0.45})`));
    gradient.addColorStop(1, color.replace(/[\d.]+\)$/, '0)'));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, SIZE, SIZE);
  });
}

/** The soft pieces the stage shares: shadows, glow, and the hinge and gutter shading. */
export function makeSoftPieces() {
  return {
    shadow: radialTexture([[0, 'rgba(10,8,12,.55)'], [0.7, 'rgba(10,8,12,0)']]),
    chin: radialTexture([[0, 'rgba(38,26,34,.5)'], [0.45, 'rgba(38,26,34,.28)'], [0.72, 'rgba(38,26,34,0)']]),
    glow: radialTexture([[0, 'rgba(255,214,130,.9)'], [0.4, 'rgba(255,196,110,.32)'], [0.7, 'rgba(255,190,90,0)']]),
    ember: radialTexture([[0, 'rgba(255,246,214,1)'], [0.14, 'rgba(255,214,120,1)'], [0.3, 'rgba(240,160,60,.55)'], [0.55, 'rgba(220,130,50,.16)'], [0.75, 'rgba(220,130,50,0)']]),
    hinge: edgeTexture('bottom', 'rgba(30,22,26,.6)'),
    gutter: edgeTexture('left', 'rgba(70,50,30,.55)'),
  };
}
export type SoftPieces = ReturnType<typeof makeSoftPieces>;
