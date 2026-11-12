import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { DoubleSide, Texture, type Group, type Mesh, type MeshBasicMaterial, type Object3D } from '@iwsdk/core';
import { buildPuppet, loadPuppet } from '../client/src/puppet/puppet.ts';
import { wholeRef, type TexRef } from '../client/src/paint/texref.ts';
import { actingPose } from '../client/src/puppet/acting.ts';
import { Rig } from '../contracts/src/index.ts';
import { layoutCards, metresPerPixel, type CardLayout } from '../client/src/puppet/layout.ts';

const artRoot = fileURLToPath(new URL('../art', import.meta.url));
const manifest = JSON.parse(readFileSync(new URL('../client/public/show/manifest.json', import.meta.url), 'utf8'));
const entry = manifest.cast[0];
const stage = { cast: entry.member.rig as string, heightM: entry.member.heightM as number };
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


function fakeTextures(dir: string, r: Rig, extra: string[] = []): Map<string, TexRef> {
  const files = [...Object.values(r.parts).map((p) => p.file), ...Object.keys(r.head?.offsets ?? {}).map((f) => r.head!.files.replace('<name>', f)), ...extra];
  return new Map(files.map((file) => {
    const texture = new Texture();
    const [width, height] = pngSize(join(dir, file));
    texture.image = { width, height };
    return [file, wholeRef(texture)];
  }));
}
const fx = { shadow: new Texture(), glow: new Texture(), chin: new Texture(), smoke: wholeRef(new Texture()) };
const rigOf = (who: string) => Rig.parse(JSON.parse(readFileSync(join(artRoot, `cast/${who}/rig.json`), 'utf8')));
const entryOf = (i: number) => manifest.cast[i];

describe('buildPuppet', () => {
  const fox = buildPuppet(entry, rig, fakeTextures(castDir, rig, ['parts/lantern-out.png']), fx);
  const named = (root: Object3D, name: string) => root.getObjectByName(name)!;
  const pose = (face: string) => actingPose(entry.member, { acting: null, localMs: 0, target: null }, 0, { gust: 0, seed: 0, heads: [] }) && { ...actingPose(entry.member, { acting: null, localMs: 0, target: null }, 0, { gust: 0, seed: 0, heads: ['forward'] }), face };
  const state = { stand: 1, glow: 1, smoke: 0 };

  test('every head is a card, and exactly the posed one shows', () => {
    fox.apply(pose('up'), state);
    const visible = Object.keys(rig.head!.offsets).filter((f) => named(fox.root, `head:${f}`).visible);
    expect(visible).toEqual(['up']);
  });

  test('a variant swaps in at the same place, pivot and scale', () => {
    fox.setVariant('lantern', 'out');
    const base = named(fox.root, 'lantern').children.find((c) => c.name === 'lantern#base')!;
    const out = named(fox.root, 'lantern').children.find((c) => c.name === 'lantern#out')!;
    expect([base.visible, out.visible]).toEqual([false, true]);
    expect(out.position.toArray()).toEqual(base.position.toArray());
    fox.setVariant('lantern', 'base');
    expect([base.visible, out.visible]).toEqual([true, false]);
  });

  test('the glow and the smoke travel with the swinging lantern', () => {
    let node: Object3D | null = named(fox.root, 'carried-glow');
    while (node && node.name !== 'lantern') node = node.parent;
    expect(node?.name).toBe('lantern');
  });

  test('nothing in the puppet is a Group, so it draws at its mount\'s place in the stack', () => {
    const groups: string[] = [];
    fox.root.traverse((o) => { if ((o as Group).isGroup) groups.push(o.name); });
    expect(groups).toEqual([]);
  });

  test('a flipped character is mirrored and drawn from both sides', () => {
    const wickRig = rigOf('wick');
    const wick = buildPuppet(entryOf(1), wickRig, fakeTextures(join(artRoot, 'cast/wick'), wickRig), fx);
    expect(wick.body.scale.x).toBeLessThan(0);
    const mesh = named(wick.root, 'body').children[0] as Mesh;
    expect((mesh.material as MeshBasicMaterial).side).toBe(DoubleSide);
  });

  test('a mirrored part gets its painted-once counterpart', () => {
    const mothRig = rigOf('moth');
    const moth = buildPuppet(entryOf(2), mothRig, fakeTextures(join(artRoot, 'cast/moth'), mothRig), fx);
    expect(moth.root.getObjectByName('upperWing~mirror')).toBeDefined();
    expect(moth.root.getObjectByName('body~mirror')).toBeUndefined();
  });

  test('the contact shadow stays on the page while the card folds', () => {
    const shadow = named(fox.root, 'contact-shadow');
    let node: Object3D | null = shadow;
    while (node && node !== fox.fold && node !== fox.root) node = node.parent;
    expect(node).toBe(fox.root);
  });
});

describe('loadPuppet', () => {
  test('rejects when a file is missing, so no half-built puppet appears', async () => {
    await expect(
      loadPuppet(entry, 'base', fx, {
        json: async () => rig,
        texture: async (url) => {
          if (url.endsWith('coat.png')) throw new Error('404');
          const texture = new Texture();
          texture.image = { width: 10, height: 10 };
          return texture;
        },
      }),
    ).rejects.toThrow('404');
  });
});
