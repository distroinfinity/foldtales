import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { ShowManifest } from '../client/src/show/manifest.ts';
import { actingPose, type ActingInput } from '../client/src/puppet/acting.ts';

const manifest = ShowManifest.parse(JSON.parse(readFileSync(new URL('../client/public/show/manifest.json', import.meta.url), 'utf8')));
const fox = manifest.cast[0]!.member;
const foxHeads = ['forward', 'talk', 'blink', 'scared', 'profile', 'up'];
const flier = manifest.cast[2]!.member;
const calm = { gust: 0, seed: 0, heads: foxHeads };
const idle: ActingInput = { acting: null, localMs: 0, target: null };
const doing = (acting: ActingInput['acting'], localMs: number, target: string | null = null): ActingInput => ({ acting, localMs, target });

describe('idle, the approved breathing', () => {
  test('moves at twelve poses a second', () => {
    expect(actingPose(fox, idle, 1000, calm)).toEqual(actingPose(fox, idle, 1025, calm));
    expect(actingPose(fox, idle, 1000, calm)).not.toEqual(actingPose(fox, idle, 1091, calm));
  });

  test('stays inside the prototype motion', () => {
    for (let ms = 0; ms < 20_000; ms += 83) {
      const pose = actingPose(fox, idle, ms, calm);
      expect(Math.abs(pose.parts.arm!.deg)).toBeLessThanOrEqual(2);
      expect(Math.abs(pose.parts.tail!.deg)).toBeLessThanOrEqual(5);
      expect(Math.abs(pose.parts.lantern!.deg)).toBeLessThanOrEqual(2.2);
      expect(Math.abs(pose.headDeg)).toBeLessThanOrEqual(1.5);
      expect(Math.abs(pose.parts.coat!.scaleY - 1)).toBeLessThanOrEqual(0.008);
    }
  });

  test('blinks briefly every few seconds', () => {
    const faces = Array.from({ length: 120 }, (_, i) => actingPose(fox, idle, i * 83, calm).face);
    const blinks = faces.filter((f) => f === 'blink').length;
    expect(blinks).toBeGreaterThan(0);
    expect(blinks).toBeLessThan(12);
    expect(faces.filter((f) => f === 'forward').length).toBeGreaterThan(100);
  });

  test('the held part swings hard in a gust', () => {
    const swing = (gust: number) => Math.max(...Array.from({ length: 24 }, (_, i) => Math.abs(actingPose(fox, idle, i * 83, { ...calm, gust }).parts.lantern!.deg)));
    expect(swing(1)).toBeGreaterThan(swing(0) * 2);
  });

  test('a character without heads has no face, and its wings beat', () => {
    const a = actingPose(flier, idle, 0, { ...calm, heads: [] });
    const b = actingPose(flier, idle, 250, { ...calm, heads: [] });
    expect(a.face).toBeNull();
    expect(a.parts.upperWing!.scaleX).not.toBe(b.parts.upperWing!.scaleX);
  });
});

describe('scared', () => {
  test('shows the frightened head, crouches and shakes', () => {
    const pose = actingPose(fox, doing('scared', 600), 6000, calm);
    expect(pose.face).toBe('scared');
    expect(pose.bodyPx[1]).toBeGreaterThan(10);
    const shakes = new Set(Array.from({ length: 12 }, (_, i) => actingPose(fox, doing('scared', 600 + i * 83), 6000 + i * 83, calm).bodyPx[0].toFixed(2)));
    expect(shakes.size).toBeGreaterThan(3);
  });

  test('eases in rather than snapping', () => {
    const first = actingPose(fox, doing('scared', 0), 6000, calm).bodyPx[1];
    const later = actingPose(fox, doing('scared', 600), 6600, calm).bodyPx[1];
    expect(first).toBeLessThan(later);
  });
});

describe('look at the reader', () => {
  test('looks up at you with the up head, and turns toward you', () => {
    const pose = actingPose(fox, doing('look', 500, 'reader'), 9000, calm);
    expect(pose.face).toBe('up');
    expect(pose.lookAt).toBe('reader');
    expect(pose.yawLimitDeg).toBeGreaterThan(20);
  });

  test('then waits, glancing up at you every few seconds', () => {
    const faces = Array.from({ length: 240 }, (_, i) => actingPose(fox, doing('look', 4000 + i * 83, 'reader'), 13_000 + i * 83, calm).face);
    expect(faces.filter((f) => f === 'up').length).toBeGreaterThan(40);
    expect(faces.filter((f) => f === 'forward').length).toBeGreaterThan(40);
  });

  test('keeps following you while it waits', () => {
    expect(actingPose(fox, doing('look', 20_000, 'reader'), 30_000, calm).lookAt).toBe('reader');
  });

  test('a head that does not exist falls back to forward', () => {
    expect(actingPose(fox, doing('look', 500, 'reader'), 9000, { ...calm, heads: ['forward', 'blink'] }).face).toBe('forward');
  });
});

import { yawToward } from '../client/src/puppet/facing.ts';

describe('turning toward you', () => {
  test('faces you straight on when you are in front', () => {
    expect(yawToward(0, 0.6, 30)).toBeCloseTo(0);
  });

  test('turns toward you as you lean to one side', () => {
    expect(yawToward(0.2, 0.6, 30)).toBeGreaterThan(0.2);
    expect(yawToward(-0.2, 0.6, 30)).toBeLessThan(-0.2);
  });

  test('never turns past its limit, so nothing goes edge-on', () => {
    expect(yawToward(1, 0.05, 30)).toBeCloseTo((30 * Math.PI) / 180);
    expect(yawToward(-1, -1, 30)).toBeCloseTo((-30 * Math.PI) / 180);
  });
});

describe('the full acting list', () => {
  const headsOf: Record<string, string[]> = {
    pip: ['forward', 'talk', 'blink', 'scared', 'profile', 'up'],
    wick: ['forward', 'talk', 'blink', 'grumpy', 'profile'],
    moth: [],
    thimble: ['forward', 'talk', 'blink', 'scared', 'profile', 'up'],
  };
  const differs = (a: ReturnType<typeof actingPose>, b: ReturnType<typeof actingPose>) => JSON.stringify(a) !== JSON.stringify(b);

  test('every acting a character lists is visible, never a silent idle', () => {
    for (const entry of manifest.cast) {
      const member = entry.member;
      const opts = { gust: 0, seed: 0, heads: headsOf[member.id]! };
      for (const acting of member.acting) {
        if (acting === 'idle') continue;
        const moving = [300, 600, 900, 1200].some((ms) => differs(actingPose(member, doing(acting, ms, 'reader'), 5000 + ms, opts), actingPose(member, idle, 5000 + ms, opts)));
        expect(moving, `${member.id} ${acting}`).toBe(true);
      }
    }
  });

  test('small and believable: no part turns past 40°, and the body never leaves its mark', () => {
    for (const entry of manifest.cast) {
      const opts = { gust: 0, seed: 0, heads: headsOf[entry.member.id]! };
      for (const acting of entry.member.acting) {
        for (let ms = 0; ms < 2500; ms += 83) {
          const pose = actingPose(entry.member, doing(acting, ms, 'reader'), 8000 + ms, opts);
          for (const part of Object.values(pose.parts)) expect(Math.abs(part.deg), `${entry.member.id} ${acting}`).toBeLessThanOrEqual(40);
          expect(Math.abs(pose.bodyPx[0])).toBeLessThan(40);
          expect(pose.bodyPx[1]).toBeGreaterThan(-90);
        }
      }
    }
  });

  test('a face is always one the rig has', () => {
    for (const entry of manifest.cast) {
      const heads = headsOf[entry.member.id]!;
      for (const acting of entry.member.acting) {
        for (let ms = 0; ms < 3000; ms += 83) {
          const face = actingPose(entry.member, doing(acting, ms, 'reader'), 8000 + ms, { gust: 0, seed: 0, heads, talking: ms % 2 === 0 }).face;
          if (heads.length === 0) expect(face).toBeNull();
          else expect(heads).toContain(face);
        }
      }
    }
  });

  test('talking swaps the mouth open and shut, as the prototype does', () => {
    const faces = new Set(Array.from({ length: 24 }, (_, i) => actingPose(fox, idle, i * 83, { ...calm, talking: true }).face));
    expect(faces.has('talk')).toBe(true);
    expect(faces.has('forward')).toBe(true);
  });

  test('grumbling lowers the logbook and alternates the grumpy face', () => {
    const keeper = manifest.cast[1]!.member;
    const opts = { gust: 0, seed: 0, heads: headsOf.wick! };
    const faces = new Set(Array.from({ length: 24 }, (_, i) => actingPose(keeper, doing('grumble', 400 + i * 83), 4000 + i * 83, opts).face));
    expect(faces.has('grumpy')).toBe(true);
    expect(actingPose(keeper, doing('grumble', 600), 4600, opts).parts.logbook!.px[1]).toBeGreaterThan(30);
  });

  test('a hop leaves the ground and comes back', () => {
    const heights = Array.from({ length: 12 }, (_, i) => actingPose(fox, doing('hop', i * 83), 3000 + i * 83, calm).bodyPx[1]);
    expect(Math.min(...heights)).toBeLessThan(-15);
    expect(heights[heights.length - 1]).toBeCloseTo(0, 0);
  });

  test('a flier beats its wings faster when it flutters or goes for the light', () => {
    const opts = { gust: 0, seed: 0, heads: [] };
    const spread = (acting: ActingInput['acting']) => {
      const values = Array.from({ length: 12 }, (_, i) => actingPose(flier, doing(acting, 400 + i * 83), 2000 + i * 83, opts).parts.upperWing!.scaleX);
      return values.reduce((sum, v, i) => (i ? sum + Math.abs(v - values[i - 1]!) : 0), 0);
    };
    expect(spread('flutter')).toBeGreaterThan(spread(null));
  });
});
