import type { Rig } from '@tabletop/contracts';

export interface CardLayout {
  name: string;
  file: string;
  /** Metres from the feet: x right, y up, z toward the viewer. */
  pivot: [number, number, number];
  size: [number, number];
  /** The card's centre, from its pivot. */
  anchor: [number, number];
  /** Painted once; the renderer also draws the opposite-side counterpart. */
  mirrored: boolean;
  /** The part's resting turn, clockwise degrees. */
  baseDeg: number;
}

const LAYER_GAP_M = 0.001;

function rigHeightPx(rig: Rig): number {
  const tops = Object.values(rig.parts).map((part) => part.y);
  if (rig.head) tops.push(rig.head.y);
  return -Math.min(...tops);
}

export function metresPerPixel(rig: Rig, heightM: number): number {
  return heightM / rigHeightPx(rig);
}

interface Box {
  name: string;
  file: string;
  x: number;
  y: number;
  pivot: readonly [number, number];
  z: number;
  scale: number;
  mirrored?: boolean;
  rotation?: number;
}

function boxes(rig: Rig): Box[] {
  const parts: Box[] = Object.entries(rig.parts).map(([name, part]) => ({ name, ...part }));
  if (!rig.head) return parts;
  const { head } = rig;
  const faces = Object.entries(head.offsets).map(([face, [dx, dy]]) => ({
    name: `head:${face}`,
    file: head.files.replace('<name>', face),
    x: head.x + dx * head.scale,
    y: head.y + dy * head.scale,
    pivot: head.pivot,
    z: head.z,
    scale: head.scale,
  }));
  return [...parts, ...faces];
}

/** Rig boxes are top-left in pixels, y down, from the point between the feet. */
export function layoutCards(rig: Rig, sizes: Record<string, [number, number]>, heightM: number): CardLayout[] {
  const m = metresPerPixel(rig, heightM);
  return boxes(rig).flatMap((box) => {
    const natural = sizes[box.name];
    if (!natural) return [];
    const width = natural[0] * box.scale;
    const height = natural[1] * box.scale;
    const pivotX = (width * box.pivot[0]) / 100;
    const pivotY = (height * box.pivot[1]) / 100;
    return [
      {
        name: box.name,
        file: box.file,
        pivot: [(box.x + pivotX) * m, -(box.y + pivotY) * m, box.z * LAYER_GAP_M] as [number, number, number],
        size: [width * m, height * m] as [number, number],
        anchor: [(width / 2 - pivotX) * m, -(height / 2 - pivotY) * m] as [number, number],
        mirrored: box.mirrored ?? false,
        baseDeg: box.rotation ?? 0,
      },
    ];
  });
}
