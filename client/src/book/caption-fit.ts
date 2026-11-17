/**
 * Fitting a spoken line to the page's caption band: wrapped as the printed text wraps, never more
 * than the band holds, and a long line split into consecutive chunks, each shown for its share of
 * the voice. The words are never changed and never cut.
 *
 * The widths are Atkinson Hyperlegible Next 500's advances (the caption face), in ems, read from
 * the font file the caption prints with. Anything else is measured as a wide letter, so a guess
 * errs toward an earlier wrap, never a later one.
 */
const ADVANCE_EM: Record<string, number> = {"0":0.653,"1":0.42,"2":0.56,"3":0.586,"4":0.618,"5":0.596,"6":0.609,"7":0.521,"8":0.619,"9":0.585,"a":0.536,"b":0.578,"c":0.495,"d":0.577,"e":0.548,"f":0.335,"g":0.572,"h":0.559,"i":0.271,"j":0.251,"k":0.518,"l":0.285,"m":0.86,"n":0.559,"o":0.559,"p":0.578,"q":0.584,"r":0.36,"s":0.486,"t":0.346,"u":0.551,"v":0.489,"w":0.707,"x":0.505,"y":0.478,"z":0.478,"A":0.647,"B":0.625,"C":0.65,"D":0.677,"E":0.58,"F":0.558,"G":0.704,"H":0.697,"I":0.405,"J":0.532,"K":0.644,"L":0.545,"M":0.838,"N":0.703,"O":0.727,"P":0.607,"Q":0.737,"R":0.628,"S":0.599,"T":0.578,"U":0.688,"V":0.614,"W":0.868,"X":0.648,"Y":0.605,"Z":0.612," ":0.293,".":0.235,",":0.235,";":0.235,":":0.235,"!":0.293,"?":0.507,"'":0.18,"\"":0.337,"’":0.249,"‘":0.249,"“":0.431,"”":0.431,"-":0.366,"—":0.827,"–":0.503,"…":0.715,"(":0.313,")":0.313,"&":0.729,"/":0.408};
const UNKNOWN_EM = 0.75;
const SPACE_EM = ADVANCE_EM[' ']!;

export const textWidthEm = (text: string): number => {
  let w = 0;
  for (const ch of text) w += ADVANCE_EM[ch] ?? UNKNOWN_EM;
  return w;
};

export interface CaptionFit {
  /** A printed line's width, in ems of the caption's size. */
  lineEm: number;
  /** How many printed lines the band holds at that size. */
  maxLines: number;
}

/** At most this many printed lines show at once, however much room the band has. */
export const CAPTION_MAX_LINES = 2;
/** The caption's line spacing, as a multiple of its size. */
export const CAPTION_LINE_HEIGHT = 1.15;
/** One printed line's full height, ascender to descender, in ems. */
const INK_EM = 1.0;
/** Room kept at the line's ends so a measured fit never meets the printed wrap. */
const WIDTH_MARGIN = 0.95;

/** What the band holds at this size: `widthM` and `bandM` are the caption's width and the band's depth, in the same units as `sizeM`. */
export function captionFit(widthM: number, bandM: number, sizeM: number): CaptionFit {
  // n lines of ink stand (n - 1) line spacings plus one letter's full height (ascender to descender) tall.
  const lines = Math.floor(((bandM * 0.96) / sizeM - INK_EM) / CAPTION_LINE_HEIGHT) + 1;
  return { lineEm: (widthM * WIDTH_MARGIN) / sizeM, maxLines: Math.max(1, Math.min(CAPTION_MAX_LINES, lines)) };
}

const words = (text: string): string[] => text.trim().split(/\s+/).filter(Boolean);

/** Greedy word wrap, as the printed text wraps. A word wider than a line stands on its own line, whole. */
export function wrapLines(text: string, lineEm: number): string[] {
  const lines: string[] = [];
  let line = '';
  let width = 0;
  for (const word of words(text)) {
    const w = textWidthEm(word);
    if (line && width + SPACE_EM + w > lineEm) {
      lines.push(line);
      line = word;
      width = w;
    } else {
      line = line ? `${line} ${word}` : word;
      width = line === word ? w : width + SPACE_EM + w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

const fits = (text: string, fit: CaptionFit): boolean => wrapLines(text, fit.lineEm).length <= fit.maxLines;

/** How good a place it is to end a chunk after this word: the end of a sentence, then a pause. */
const breakBonus = (word: string): number => (/[.!?…]['"’”)]*$/.test(word) ? 1 : /[;:—–]['"’”)]*$/.test(word) ? 0.6 : /,['"’”)]*$/.test(word) ? 0.45 : 0);

/**
 * A line in chunks that each fit the band, in order, with every word kept whole. Chunks come out
 * about even, and end at a sentence or a pause where one is near, so each reads as a phrase.
 */
export function captionChunks(text: string, fit: CaptionFit): string[] {
  const all = words(text);
  if (!all.length) return [];
  if (fits(text, fit)) return [all.join(' ')];
  const chunks: string[] = [];
  let at = 0;
  while (at < all.length) {
    const rest = all.slice(at);
    if (fits(rest.join(' '), fit)) {
      chunks.push(rest.join(' '));
      break;
    }
    // The longest run of words that fits from here (at least one word, whole, whatever its width).
    let most = 1;
    while (most < rest.length && fits(rest.slice(0, most + 1).join(' '), fit)) most++;
    // How many chunks the rest needs, so this one aims at an even share of it.
    const restEm = textWidthEm(rest.join(' '));
    const capacityEm = textWidthEm(rest.slice(0, most).join(' '));
    const share = restEm / Math.max(2, Math.ceil(restEm / Math.max(capacityEm, 1e-6)));
    let best = most;
    let bestScore = -Infinity;
    for (let n = 1; n <= most; n++) {
      const em = textWidthEm(rest.slice(0, n).join(' '));
      // Too short a chunk flashes past: never under a third of the share, unless that's all that fits.
      if (em < share * 0.34 && n < most) continue;
      const score = -Math.abs(em - share) / share + 0.8 * breakBonus(rest[n - 1]!);
      if (score > bestScore) {
        bestScore = score;
        best = n;
      }
    }
    chunks.push(rest.slice(0, best).join(' '));
    at += best;
  }
  return chunks;
}

/** Which chunk shows `localMs` into a line `durationMs` long: each chunk for its share of the words, start to end. */
export function chunkAt(chunks: readonly string[], durationMs: number, localMs: number): { text: string; startMs: number; endMs: number } {
  const total = chunks.reduce((n, c) => n + c.length, 0) || 1;
  let start = 0;
  for (let i = 0; i < chunks.length; i++) {
    const end = i === chunks.length - 1 ? durationMs : start + (durationMs * chunks[i]!.length) / total;
    if (localMs < end || i === chunks.length - 1) return { text: chunks[i]!, startMs: start, endMs: end };
    start = end;
  }
  return { text: '', startMs: 0, endMs: durationMs };
}
