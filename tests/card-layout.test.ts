import { describe, expect, it } from 'vitest';
import { TARGET_M, TEXT_DEG, arrangeCard, cardWidthFor, emFor, paginate } from '../client/src/book/card-layout.ts';

const deg = (m: number, d: number) => (Math.atan(m / d) * 180) / Math.PI;

describe('the pop-up card layout', () => {
  it('sets type above 1° at any reading distance', () => {
    for (const d of [0.45, 0.55, 0.65, 0.75, 0.9]) expect(deg(emFor(d), d)).toBeGreaterThanOrEqual(1);
    expect(TEXT_DEG).toBeGreaterThan(1);
  });

  it('keeps every pair of choices a hand target apart, at the nearest and furthest distances', () => {
    for (const d of [0.45, 0.9]) {
      const em = emFor(d);
      const g = arrangeCard({ title: em * 1.3, choices: [em, em * 2.3, em, em] }, em);
      expect(g.cells).toHaveLength(4);
      for (let i = 0; i < g.cells.length; i++)
        for (let j = i + 1; j < g.cells.length; j++) {
          const a = g.cells[i]!;
          const b = g.cells[j]!;
          expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(TARGET_M - 1e-9);
        }
      for (const c of g.cells) {
        expect(c.h).toBeGreaterThanOrEqual(TARGET_M);
        expect(c.w).toBeGreaterThanOrEqual(TARGET_M);
        expect(Math.abs(c.x) + c.w / 2).toBeLessThanOrEqual(g.widthM / 2 + 1e-9);
        expect(c.y - c.h / 2).toBeGreaterThan(0);
      }
    }
  });

  it('stacks the blocks top to bottom inside the card', () => {
    const em = emFor(0.65);
    const g = arrangeCard({ over: em, title: em * 2.6, lines: em * 3.4, note: em * 2.2, choices: [em, em, em] }, em);
    expect(g.top.over!).toBeLessThanOrEqual(g.heightM);
    expect(g.top.over!).toBeGreaterThan(g.top.title!);
    expect(g.top.title!).toBeGreaterThan(g.top.lines!);
    expect(g.top.lines!).toBeGreaterThan(g.top.note!);
    // The odd last choice sits alone, in the middle.
    expect(g.cells[2]!.x).toBe(0);
    expect(g.top.note! - em * 2.2).toBeGreaterThan(g.cells[0]!.y + g.cells[0]!.h / 2 - 1e-9);
    expect(g.widthM).toBeCloseTo(cardWidthFor(em));
  });

  it('refuses more than four choices', () => {
    expect(() => arrangeCard({ choices: [1, 1, 1, 1, 1] }, 0.01)).toThrow();
  });

  it('pages a long list with More and Back, never more than four to a card', () => {
    const pages = paginate(['a', 'b', 'c', 'd', 'e'], 4, 'more', 'back');
    expect(pages).toEqual([['a', 'b', 'more', 'back'], ['c', 'd', 'e', 'back']]);
    expect(paginate(['a', 'b', 'c', 'd', 'e', 'f', 'g'], 4, 'more', 'back')).toEqual([['a', 'b', 'more', 'back'], ['c', 'd', 'more', 'back'], ['e', 'f', 'g', 'back']]);
    expect(paginate(['a', 'b', 'c'], 4, 'more', 'back')).toEqual([['a', 'b', 'c', 'back']]);
    expect(paginate([], 4, 'more', 'back')).toEqual([['back']]);
  });
});
