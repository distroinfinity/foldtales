import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { Mesh, Object3D, Texture, type Group } from '@iwsdk/core';
import { Rig } from '../contracts/src/index.ts';
import { BookSpec, SetSpec } from '../client/src/book/spec.ts';
import { bookFiles, buildBook } from '../client/src/book/book-view.ts';
import { wholeRef } from '../client/src/paint/texref.ts';
import { buildPuppet, puppetFiles } from '../client/src/puppet/puppet.ts';
import { buildLeaves } from '../client/src/show/leaves.ts';
import { ShowManifest } from '../client/src/show/manifest.ts';

const artRoot = fileURLToPath(new URL('../art', import.meta.url));
const json = (p: string) => JSON.parse(readFileSync(join(artRoot, p), 'utf8'));
const manifest = ShowManifest.parse(JSON.parse(readFileSync(new URL('../client/public/show/manifest.json', import.meta.url), 'utf8')));
const book = BookSpec.parse(json(manifest.book));
const set = SetSpec.parse(json(manifest.set.file));
const entry = manifest.cast[0]!;
const rig = Rig.parse(json(`${entry.member.rig}/rig.json`));
const ref = () => {
  const t = new Texture();
  t.image = { width: 100, height: 200 };
  return wholeRef(t);
};

/** Three's rule: each Group met on the way down sets the group order for everything under it. */
function groupOrderOf(object: Object3D): number {
  const chain: Object3D[] = [];
  for (let o: Object3D | null = object; o; o = o.parent) chain.unshift(o);
  let order = 0;
  for (const node of chain) if ((node as Group).isGroup) order = node.renderOrder;
  return order;
}

describe('the stack draws back to front, characters and effects included', () => {
  const view = buildBook({ book, set, textures: new Map(bookFiles(book, 'book', set, 'sets/shore-path').map((f) => [f, ref()])), bookBase: 'book', setBase: 'sets/shore-path', soft: { shadow: new Texture(), hinge: new Texture(), gutter: new Texture() }, castOnStage: ['pip'] });
  const puppet = buildPuppet(entry, rig, new Map(puppetFiles(entry, rig).map((f) => [f, ref()])), { shadow: new Texture(), glow: new Texture(), chin: new Texture(), smoke: ref() });
  view.mounts.get('pip')!.add(puppet.root);
  const leaves = buildLeaves([ref(), ref()]);
  view.root.add(leaves.root);
  const stackOrder = set.stack.topToBottom.indexOf('pip') + 1;
  const deepestCard = set.stack.topToBottom.length;

  test('every piece of the character, its glow and its smoke draw at its own place in the stack', () => {
    const meshes: Mesh[] = [];
    puppet.root.traverse((o) => { if ((o as Mesh).isMesh) meshes.push(o as Mesh); });
    expect(meshes.length).toBeGreaterThan(5);
    for (const mesh of meshes) expect(groupOrderOf(mesh), mesh.name).toBe(stackOrder);
  });

  test('leaves and the beam draw over every card', () => {
    const over: Object3D[] = [];
    leaves.root.traverse((o) => { if ((o as Mesh).isMesh) over.push(o); });
    view.root.getObjectByName('beam')!.traverse((o) => { if ((o as Mesh).isMesh) over.push(o); });
    for (const mesh of over) expect(groupOrderOf(mesh), mesh.name).toBeGreaterThan(deepestCard);
  });
});
