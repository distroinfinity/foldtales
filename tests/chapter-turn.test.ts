import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BufferGeometry, Group, Mesh, MeshBasicMaterial, Texture } from '@iwsdk/core';
import { releaseObjects, titlePage, turnTargetOf } from '../client/src/stage/chapter-turn.ts';

describe('turning a chapter inside the book (F3)', () => {
  it('"Continue to chapter N" on the end card turns to the next chapter, from the start', () => {
    expect(turnTargetOf({ kind: 'next-chapter' }, { n: 1, next: 2 })).toEqual({ kind: 'chapter', n: 2, from: 'start' });
    expect(turnTargetOf({ kind: 'next-chapter' }, { n: 2, next: 3 })).toEqual({ kind: 'chapter', n: 3, from: 'start' });
  });

  it('another chapter chosen from Contents turns there, keeping start or resume', () => {
    expect(turnTargetOf({ kind: 'open', target: { kind: 'chapter', n: 3, from: 'resume' } }, { n: 1, next: 2 })).toEqual({ kind: 'chapter', n: 3, from: 'resume' });
    expect(turnTargetOf({ kind: 'open', target: { kind: 'chapter', n: 1, from: 'start' } }, { n: 2, next: 3 })).toEqual({ kind: 'chapter', n: 1, from: 'start' });
  });

  it('leaving for the page, the Storyteller or this same chapter is not a turn', () => {
    expect(turnTargetOf({ kind: 'put-away' }, { n: 1, next: 2 })).toBeNull();
    expect(turnTargetOf({ kind: 'open', target: { kind: 'storyteller' } }, { n: 1, next: 2 })).toBeNull();
    expect(turnTargetOf({ kind: 'open', target: { kind: 'chapter', n: 2, from: 'start' } }, { n: 2, next: 3 })).toBeNull();
    expect(turnTargetOf({ kind: 'again' }, { n: 1, next: 2 })).toBeNull();
  });

  it('the title page names the chapter and its title, with nothing to press', () => {
    const page = titlePage(2);
    expect(page.over).toBe('Chapter 2');
    expect(page.title).toBe('The night the sea came in');
    expect(page.choices).toEqual([]);
  });

  it('letting a chapter go frees its geometry, materials and paintings, except those the next chapter keeps', () => {
    const shared = new Texture();
    const own = new Texture();
    const spare = new Texture();
    const disposed = new Set<unknown>();
    for (const t of [shared, own, spare]) t.addEventListener('dispose', () => disposed.add(t));
    const geometry = new BufferGeometry();
    geometry.addEventListener('dispose', () => disposed.add(geometry));
    const a = new MeshBasicMaterial({ map: shared });
    const b = new MeshBasicMaterial({ map: own });
    a.addEventListener('dispose', () => disposed.add(a));
    const root = new Group();
    const parent = new Group();
    parent.add(root);
    root.add(new Mesh(geometry, a), new Mesh(new BufferGeometry(), b));
    const freed = releaseObjects([root], new Set([shared]), [spare]);
    expect(root.parent).toBeNull();
    expect(disposed.has(geometry)).toBe(true);
    expect(disposed.has(a)).toBe(true);
    expect(disposed.has(own)).toBe(true);
    expect(disposed.has(spare)).toBe(true);
    expect(disposed.has(shared)).toBe(false);
    expect(freed).toBe(2);
  });

  it('the host turns in the session instead of putting the book away, and lets the old chapter go', () => {
    const source = readFileSync(new URL('../client/src/index.ts', import.meta.url), 'utf8');
    // The menu's choice is turned to while presenting, before put-away's fallback.
    expect(source).toMatch(/turnTargetOf\(effect, \{ n: chapterN, next: chapter\.next \}\)/);
    // Its sound, listeners and frame work are released, and only what the next chapter doesn't reuse is freed.
    expect(source).toMatch(/sound\.close\(\)/);
    expect(source).toMatch(/controls\.dispose\(\)/);
    expect(source).toMatch(/releaseObjects\(old\.objects, keep/);
    // The ending is written before the next chapter reads its carry.
    expect(source).toMatch(/await old\?\.show\.log\.flushed\(\);[\s\S]*loadChapter\(target\.n, \{ from: target\.from \}\)/);
  });
});

describe('leaving XR in the middle of a turn (PR #60 review)', () => {
  const turnSource = readFileSync(new URL('../client/src/stage/chapter-turn.ts', import.meta.url), 'utf8');
  const hostSource = readFileSync(new URL('../client/src/index.ts', import.meta.url), 'utf8');

  it('the title page is let go when the session it stood in ends', () => {
    expect(turnSource).toMatch(/session\?\.addEventListener\('end', \(\) => finish\(\), \{ once: true, signal: ended\.signal \}\)/);
    // And its listener is removed when it folds normally.
    expect(turnSource).toMatch(/function finish\(\): void \{\s*if \(done\) return;\s*done = true;\s*ended\.abort\(\);/);
  });

  it('a turn that fails after XR has ended reloads the page into the waiting chapter, rather than waiting for a session end that never comes', () => {
    const failure = hostSource.slice(hostSource.indexOf(".catch((cause: unknown) => {\n            reportError('turn', cause);"));
    expect(failure).toMatch(/turning = false;/);
    expect(failure).toMatch(/chooseEntry\(target,/);
    expect(failure).toMatch(/if \(!session \|\| !world\.renderer\.xr\.isPresenting\) location\.reload\(\);\s*else void session\.end\(\)/);
  });
});
