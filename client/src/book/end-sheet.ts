import type { ObjectDef } from '@tabletop/contracts';

/** A chapter's end card, from the page the chapter recorded at its end (memory.ts, `page.composed`). */
export function chapterEnding(
  n: number,
  page: { title: string; text: string[]; keepsakes: string[] } | null,
  defs: ReadonlyMap<string, Pick<ObjectDef, 'name'>>,
  next: { n: number } | null,
): { heading: string; lines: string[]; things: string[]; next: string | null } {
  const things = (page?.keepsakes ?? []).flatMap((id) => {
    const name = defs.get(id)?.name;
    return name ? [name] : [];
  });
  return { heading: `The end of chapter ${n}`, lines: (page?.text ?? []).slice(0, 3), things, next: next ? `Continue to chapter ${next.n}` : null };
}
