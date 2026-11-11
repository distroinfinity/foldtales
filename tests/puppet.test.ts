import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { Rig } from '../contracts/src/index.ts';
import { idlePose } from '../client/src/puppet/idle.ts';
import { layoutCards, metresPerPixel, type CardLayout } from '../client/src/puppet/layout.ts';

const artRoot = fileURLToPath(new URL('../art', import.meta.url));
const stage = JSON.parse(readFileSync(new URL('../client/public/stage.json', import.meta.url), 'utf8')) as { cast: string; heightM: number };
const castDir = join(artRoot, stage.cast);
const rig = Rig.parse(JSON.parse(readFileSync(join(castDir, 'rig.json'), 'utf8')));

function pngSize(path: string): [number, number] {
  const header = readFileSync(path).subarray(0, 24);
  return [header.readUInt32BE(16), header.readUInt32BE(20)];
}

const sizes: Record<string, [number, number]> = {};
for (const [name, part] of Object.entries(rig.parts)) sizes[name] = pngSize(join(castDir, part.file));
for (const face of Object.keys(rig.head!.offsets)) sizes[`head:${face}`] = pngSize(join(castDir, rig.head!.files.replace('<name>', face)));

const cards = layoutCards(rig, sizes, stage.heightM);
const card = (name: string): CardLayout => cards.find((c) => c.name === name)!;
const m = metresPerPixel(rig, stage.heightM);

describe('layoutCards, against the real rig', () => {
  test('the scale comes from the rig', () => {
    expect(m).toBeCloseTo(stage.heightM / 905, 8);
  });

  test('the forward head tops out at the character height', () => {
    const head = card('head:forward');
    expect(head.pivot[1] + head.anchor[1] + head.size[1] / 2).toBeCloseTo(stage.heightM, 3);
  });

  test('the legs reach the feet origin', () => {
    const legs = card('legs');
    const bottom = legs.pivot[1] + legs.anchor[1] - legs.size[1] / 2;
    expect(Math.abs(bottom)).toBeLessThan(0.001);
  });

  test('a pivot is at its percentage of the box', () => {
    const [w, h] = sizes.coat!;
    const coat = card('coat');
    expect(coat.pivot[0]).toBeCloseTo((-238 + w / 2) * m, 6);
    expect(coat.pivot[1]).toBeCloseTo(-(-730 + h) * m, 6);
  });

  test('the anchor puts the card centre where the box centre is', () => {
    const [w, h] = sizes.tail!;
    const tail = card('tail');
    expect(tail.pivot[0] + tail.anchor[0]).toBeCloseTo((118 + w / 2) * m, 6);
    expect(tail.pivot[1] + tail.anchor[1]).toBeCloseTo(-(-318 + h / 2) * m, 6);
  });

  test('scale shrinks a part', () => {
    expect(card('lantern').size[0]).toBeCloseTo(sizes.lantern![0] * 0.78 * m, 6);
  });

  test('higher z sits nearer, a millimetre a step', () => {
    expect(card('arm').pivot[2]).toBeCloseTo(0.007, 6);
    expect(card('coat').pivot[2]).toBeCloseTo(0.003, 6);
  });

  test('a head offset is scaled by the head', () => {
    const [w, h] = sizes['head:up']!;
    const [fw, fh] = sizes['head:forward']!;
    const up = card('head:up');
    const forward = card('head:forward');
    expect(up.pivot[0] - forward.pivot[0]).toBeCloseTo((-43 * 0.7 + ((w - fw) * 0.7 * 50) / 100) * m, 6);
    expect(up.pivot[1] - forward.pivot[1]).toBeCloseTo(-(-14 * 0.7 + ((h - fh) * 0.7 * 72) / 100) * m, 6);
  });

  test('only cards with a known size are laid out', () => {
    const just = layoutCards(rig, { coat: sizes.coat!, 'head:forward': sizes['head:forward']! }, stage.heightM);
    expect(just.map((c) => c.name).sort()).toEqual(['coat', 'head:forward']);
  });
});

describe('idlePose', () => {
  test('moves at twelve poses a second', () => {
    expect(idlePose(1)).toEqual(idlePose(1 + 1 / 40));
    expect(idlePose(1)).not.toEqual(idlePose(1 + 1 / 11));
  });

  test('blinks briefly every few seconds', () => {
    expect(idlePose(0.1).face).toBe('blink');
    expect(idlePose(1).face).toBe('forward');
    expect(idlePose(4.2).face).toBe('blink');
  });

  test('stays within the approved motion', () => {
    for (let t = 0; t < 30; t += 0.083) {
      const pose = idlePose(t);
      expect(Math.abs(pose.rotationsDeg.arm!)).toBeLessThanOrEqual(2);
      expect(Math.abs(pose.rotationsDeg.tail!)).toBeLessThanOrEqual(5);
      expect(Math.abs(pose.rotationsDeg.lantern!)).toBeLessThanOrEqual(2.2);
      expect(Math.abs(pose.rotationsDeg.head!)).toBeLessThanOrEqual(1.5);
      expect(Math.abs(pose.breatheScaleY - 1)).toBeLessThanOrEqual(0.008);
      expect(Math.abs(pose.glowScale - 1)).toBeLessThanOrEqual(0.05);
    }
  });
});
