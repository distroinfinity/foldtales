import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { Texture, Vector3, type Group, type Object3D } from '@iwsdk/core';
import { BookSpec, SetSpec } from '../client/src/book/spec.ts';
import { buildBook, bookFiles, CAPTION_WIDTH_SHARE } from '../client/src/book/book-view.ts';
import { wholeRef } from '../client/src/paint/texref.ts';

const json = (path: string) => JSON.parse(readFileSync(new URL(`../art/${path}`, import.meta.url), 'utf8'));
const bookSpec = BookSpec.parse(json('book/book.json'));
const setSpec = SetSpec.parse(json('sets/shore-path/set.json'));
const files = bookFiles(bookSpec, 'book', setSpec, 'sets/shore-path');
const textures = new Map(files.map((f) => {
  const t = new Texture();
  t.image = { width: 100, height: 100 };
  return [f, wholeRef(t)];
}));
const soft = { shadow: new Texture(), hinge: new Texture(), gutter: new Texture() };
const view = buildBook({ book: bookSpec, set: setSpec, textures, bookBase: 'book', setBase: 'sets/shore-path', soft, castOnStage: ['pip'] });

describe('the book view', () => {
  test('names every file it needs, once', () => {
    expect(new Set(files).size).toBe(files.length);
    expect(files).toContain('book/cover-front.png');
    expect(files).toContain('sets/shore-path/layer-2-headland.png');
  });

  test('closed: the cover lies on the pages and the cards are hidden inside', () => {
    view.update({ dim: 0, cover: 0, layers: [0, 0, 0, 0, 0] }, 0, 0);
    expect(view.leftHalf.rotation.z).toBeCloseTo(-Math.PI);
    expect(view.cards.every((card) => !card.root.visible)).toBe(true);
  });

  test('open: the cover lies beside the pages and every card stands', () => {
    view.update({ dim: 1, cover: 1, layers: [1, 1, 1, 1, 1] }, 0, 0);
    expect(view.leftHalf.rotation.z).toBeCloseTo(0);
    for (const card of view.cards) for (const hinge of card.hinges) expect(hinge.rotation.x).toBeCloseTo(0);
  });

  test('cards draw back to front in the stack order, the character in its place', () => {
    const order = setSpec.stack.topToBottom;
    const groupOrder = (id: string) => (view.cards.find((c) => c.id === id)!.root as Group).renderOrder;
    for (let i = 1; i < order.length; i++) expect(groupOrder(order[i]!)).toBeGreaterThan(groupOrder(order[i - 1]!));
  });

  test('the character stands on its mark, on the right page', () => {
    const mount = view.mounts.get('pip')!;
    const mark = setSpec.marks.find((m) => m.id === 'pip')!;
    expect(mount.position.x).toBeCloseTo(mark.position[0]);
    expect(mount.position.z).toBeCloseTo(mark.position[2]);
    expect(Math.abs(mount.position.y - view.pageY)).toBeLessThan(0.001);
  });

  test('each layer half has a page-coloured back just behind it, for card thickness', () => {
    const layer = view.cards.find((c) => c.id === 'layer-2-headland')!;
    for (const hinge of layer.hinges) {
      const names = hinge.children.map((c: Object3D) => c.name);
      expect(names).toContain('front');
      expect(names).toContain('back');
    }
  });

  test('the left halves travel with the cover', () => {
    const left = view.cards.find((c) => c.id === 'layer-1-sky')!.hinges[0]!;
    let node: Object3D | null = left;
    while (node && node !== view.leftHalf) node = node.parent;
    expect(node).toBe(view.leftHalf);
  });

  test('the ribbon hangs at the near edge, in easy reach, and lifts toward you when it pauses the show', () => {
    const ribbon = view.root.getObjectByName('ribbon')!;
    const at = (lift: number) => {
      view.setRibbon(lift);
      view.root.updateMatrixWorld(true);
      return ribbon.getWorldPosition(new Vector3());
    };
    const flat = at(0);
    expect(flat.z).toBeGreaterThan(0.1);
    const lifted = at(1);
    expect(lifted.y).toBeGreaterThan(flat.y + 0.01);
  });

  test('the ribbon lies clear of the caption, so it never crosses a word', () => {
    view.update({ dim: 1, cover: 1, layers: [1, 1, 1, 1, 1] }, 0, 0);
    view.root.updateMatrixWorld(true);
    const ribbon = view.root.getObjectByName('ribbon')!;
    const inner = new Vector3(-bookSpec.parts.ribbon.sizeM[0] / 2, 0, 0);
    ribbon.localToWorld(inner);
    view.root.worldToLocal(inner);
    const captionHalf = (bookSpec.openSizeM[0] * CAPTION_WIDTH_SHARE) / 2;
    expect(Math.min(inner.x, ribbon.getWorldPosition(new Vector3()).x - bookSpec.parts.ribbon.sizeM[0] / 2)).toBeGreaterThan(captionHalf + 0.005);
  });

  test('an extra character mounted on the page hides with the pop-ups when the book shuts', () => {
    const extra = view.addMount('review:extra', [-0.1, 0, 0]);
    view.update({ dim: 0, cover: 0, layers: [0, 0, 0, 0, 0] }, 0, 0);
    expect(extra.visible).toBe(false);
    view.update({ dim: 1, cover: 1, layers: [1, 1, 1, 1, 1] }, 0, 0);
    expect(extra.visible).toBe(true);
  });
});
