/**
 * The pop-up card's layout, as pure numbers. The card stands on the open spread and faces the reader,
 * so its type is sized from the distance to the reader's eyes: at least 1° tall (we aim a little over),
 * whatever the book's size. Choices sit two to a row, each cell at least the hand's 64 mm target across
 * and tall, so neighbours can always be pinched apart. Every length here is in metres, in the card's own
 * frame: the origin at the middle of its bottom edge, x to the right, y up.
 */

/** Type is set this many degrees tall at its real distance: 1° is the rule, with a margin. */
export const TEXT_DEG = 1.2;
/** The hand target's diameter (design-language.md: at least 64 mm). */
export const TARGET_M = 0.064;
/** At most this many choices on one card; a longer list pages with More and Back. */
export const MAX_CHOICES = 4;
/** A choice's label is wrapped to this width, in ems. */
export const COLUMN_EM = 7.5;
/** Margins round the card's edge and between blocks, in ems. */
const MARGIN_EM = 0.85;
const GAP_EM = 0.4;
/** Space above and below a choice's words inside its cell, in ems. */
const CELL_PAD_EM = 0.45;

/** The size of one em, in metres, for type read from this far away. */
export function emFor(distanceM: number): number {
  return distanceM * Math.tan((TEXT_DEG * Math.PI) / 180);
}

/** Every block's measured height (from the rendered text), in metres. Absent blocks are left out. */
export interface CardMeasure {
  over?: number;
  title?: number;
  lines?: number;
  note?: number;
  choices: number[];
}

export interface Cell {
  /** The centre of the cell. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CardGeometry {
  em: number;
  widthM: number;
  heightM: number;
  /** Width for wrapped text: the title, lines and note. */
  textWidthM: number;
  /** Width a choice's label wraps to. */
  columnM: number;
  /** The top of each text block. */
  top: { over?: number; title?: number; lines?: number; note?: number };
  cells: Cell[];
}

/** The column a choice wraps to: never narrower than a hand target, so two cells side by side stay apart. */
export function columnFor(em: number): number {
  return Math.max(COLUMN_EM * em, TARGET_M);
}

/** The card's width for a given em, before anything is measured (so text can be wrapped to it first). */
export function cardWidthFor(em: number): number {
  return 2 * columnFor(em) + 2 * MARGIN_EM * em;
}

/**
 * Places the measured blocks top to bottom: the small line over the title, the title, the lines,
 * the note, then the choices in rows of two. An odd last choice sits alone in the middle of its row.
 */
export function arrangeCard(m: CardMeasure, em: number): CardGeometry {
  if (m.choices.length > MAX_CHOICES) throw new Error(`a card holds at most ${MAX_CHOICES} choices`);
  const columnM = columnFor(em);
  const widthM = cardWidthFor(em);
  const textWidthM = widthM - 2 * MARGIN_EM * em;
  const top: CardGeometry['top'] = {};
  // Walk down from y = 0 (the card's top), then flip once the height is known.
  let y = MARGIN_EM * em;
  let first = true;
  const block = (key: keyof CardGeometry['top'], h: number | undefined, gapEm = GAP_EM) => {
    if (h === undefined) return;
    if (!first) y += gapEm * em;
    top[key] = y;
    y += h;
    first = false;
  };
  block('over', m.over, 0.2);
  block('title', m.title, 0.2);
  block('lines', m.lines);
  block('note', m.note);
  const rows: Array<{ y: number; h: number; n: number }> = [];
  for (let i = 0; i < m.choices.length; i += 2) {
    const pair = m.choices.slice(i, i + 2);
    const h = Math.max(TARGET_M, Math.max(...pair) + 2 * CELL_PAD_EM * em);
    if (!rows.length && !first) y += GAP_EM * em;
    rows.push({ y, h, n: pair.length });
    y += h;
    first = false;
  }
  y += MARGIN_EM * em;
  const heightM = y;
  const cells: Cell[] = [];
  for (const row of rows) {
    const cy = heightM - (row.y + row.h / 2);
    if (row.n === 2) cells.push({ x: -columnM / 2, y: cy, w: columnM, h: row.h }, { x: columnM / 2, y: cy, w: columnM, h: row.h });
    else cells.push({ x: 0, y: cy, w: columnM, h: row.h });
  }
  // Flip the tops into the card's frame: y up from the bottom edge.
  const flipped: CardGeometry['top'] = {};
  for (const [k, v] of Object.entries(top) as Array<[keyof CardGeometry['top'], number]>) flipped[k] = heightM - v;
  return { em, widthM, heightM, textWidthM, columnM, top: flipped, cells };
}

/** Splits a long list of choices into cards of at most `perCard`, with More and Back where they're needed. */
export function paginate<T>(items: T[], perCard: number, more: T, back: T): T[][] {
  if (perCard < 3) throw new Error('a page needs room for More and Back');
  const pages: T[][] = [];
  let rest = items;
  for (;;) {
    if (rest.length + 1 <= perCard) {
      pages.push([...rest, back]);
      return pages;
    }
    const take = perCard - 2;
    pages.push([...rest.slice(0, take), more, back]);
    rest = rest.slice(take);
  }
}
