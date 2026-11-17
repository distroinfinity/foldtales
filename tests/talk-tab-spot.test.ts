import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TALK_TAB_H, TALK_TAB_W, talkTabSpot } from '../client/src/stage/talk.ts';

const json = (path: string) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
const book = json('art/book/book.json');
const drawer = json('art/book/drawer/drawer.json');
const satchel = json('art/satchel/satchel.json');

type Box = { x0: number; x1: number; z0: number; z1: number };
const apart = (a: Box, b: Box) => a.x1 < b.x0 || b.x1 < a.x0 || a.z1 < b.z0 || b.z1 < a.z0;

describe('Hold to talk sits on the book, clear of the drawer (owner, headset 2026-11-18)', () => {
  const [pageW, pageD] = book.closedSizeM;
  for (const pageY of [0.012, 0.02, 0.03]) {
    const [x, y, z] = talkTabSpot({ pageY, pageW, pageD });
    const rim = 0.0025;
    const tab: Box = { x0: x - TALK_TAB_W / 2 - rim, x1: x + TALK_TAB_W / 2 + rim, z0: z - TALK_TAB_H / 2 - rim, z1: z + TALK_TAB_H / 2 + rim };

    it(`is at page height, above the table (page ${pageY} m)`, () => {
      expect(y).toBeGreaterThan(pageY - 0.005);
      expect(y).toBeGreaterThan(0.005);
    });

    it('is never over the open drawer or anything in it', () => {
      const [tw] = drawer.tray.sizeM;
      const { centerX, edgeZ, travelM } = drawer.attach;
      const open: Box = { x0: centerX - tw / 2, x1: centerX + tw / 2, z0: -pageD / 2, z1: edgeZ + travelM };
      expect(apart(tab, open)).toBe(true);
    });

    it('is clear of the satchel on either side', () => {
      const [sx, , sz] = satchel.position;
      const w = satchel.parts.back.sizeM[0] / 2 + 0.02;
      for (const side of [1, -1]) expect(apart(tab, { x0: side * Math.abs(sx) - w, x1: side * Math.abs(sx) + w, z0: sz - 0.05, z1: sz + 0.05 })).toBe(true);
    });

    it("lies at the book's near edge, within the book's width, mostly showing", () => {
      expect(tab.x0).toBeGreaterThan(-pageW);
      expect(z - TALK_TAB_H / 2).toBeLessThan(pageD / 2);
      expect(z).toBeGreaterThan(pageD / 2);
    });
  }
});
