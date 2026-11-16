import { Mesh, MeshBasicMaterial, Object3D, PlaneGeometry } from '@iwsdk/core';
import { Text, preloadFont } from 'troika-three-text';
import titleFont from '@fontsource/fraunces/files/fraunces-latin-500-normal.woff?url';
import captionFont from '@fontsource/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-500-normal.woff?url';

const NAVY = '#1F2A44';
const INK = '#2B2420';
const CHARACTERS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,;:!?\'"’“”-—…()';

/** Both faces, measured and ready, so the first line printed doesn't stall a frame. */
export function preloadFonts(): Promise<void> {
  const one = (font: string) => new Promise<void>((resolve) => preloadFont({ font, characters: CHARACTERS }, resolve));
  return Promise.all([one(titleFont), one(captionFont)]).then(() => undefined);
}

/** The title, set in Fraunces on the cover's blank panel, as the art left room for. */
export function titleText(title: string, widthM: number): Text {
  const text = new Text();
  text.name = 'title';
  text.text = title;
  text.font = titleFont;
  text.fontSize = 0.019;
  text.maxWidth = widthM * 0.8;
  text.lineHeight = 1.05;
  text.textAlign = 'center';
  text.anchorX = 'center';
  text.anchorY = 'middle';
  text.color = NAVY;
  text.sync();
  return text;
}

export interface CaptionView {
  mesh: Text;
  /** Prints a line on the page's caption band, or clears it. `opacity` fades it in and out. */
  show(line: string | null, opacity: number): void;
  /** The authored size, in the book's own units. */
  readonly baseSizeM: number;
  setSize(sizeM: number): void;
}

/** The chapter's printed end line, for the chapter that's loaded. */
export function endLine(n: number): string {
  return `The end of chapter ${n}`;
}

/** Captions are printed on the page, never over your room. At least 1° tall at reading distance. */
export function captionText(widthM: number): CaptionView {
  const text = new Text();
  text.name = 'caption';
  text.text = '';
  text.font = captionFont;
  text.fontSize = 0.012;
  text.maxWidth = widthM;
  text.lineHeight = 1.25;
  text.textAlign = 'center';
  text.anchorX = 'center';
  text.anchorY = 'middle';
  text.color = INK;
  text.depthOffset = -1;
  let current = '';
  return {
    mesh: text,
    baseSizeM: 0.012,
    setSize(sizeM) {
      if (Math.abs(text.fontSize - sizeM) < 1e-5) return;
      text.fontSize = sizeM;
      text.sync();
    },
    show(line, opacity) {
      const next = line ?? '';
      if (next !== current) {
        current = next;
        text.text = next;
        text.sync();
      }
      text.visible = next.length > 0 && opacity > 0.01;
      text.fillOpacity = opacity;
    },
  };
}

export interface EndPageView {
  root: Object3D;
  /** Where "Read it again" is, for the hand. */
  readAgain: Object3D;
  show(on: boolean, opacity: number): void;
  /** A hand is near "Read it again": its gold rule brightens. */
  setNear(near: boolean): void;
  setSize(sizeM: number): void;
  /** Prints the loaded chapter's number in the end line. */
  setChapter(n: number): void;
}

/**
 * The chapter's last page, printed on the caption band: its title line on the left, and
 * "Read it again" on the right with a gold rule under it, pinched like any of the book's controls.
 */
export function endPageText(widthM: number): EndPageView {
  const root = new Object3D();
  root.name = 'end-page';
  const make = (text: string, font: string, color: string, anchorX: 'left' | 'right' | 'center') => {
    const t = new Text();
    t.text = text;
    t.font = font;
    t.fontSize = 0.012;
    t.color = color;
    t.anchorX = anchorX;
    t.anchorY = 'middle';
    t.depthOffset = -1;
    t.sync();
    return t;
  };
  const end = make(endLine(1), titleFont, NAVY, 'left');
  end.position.x = -widthM / 2 + 0.01;
  // Well clear of the ribbon's tail at the near right corner, so one is never taken for the other.
  const AGAIN_X = 0.075;
  const again = make('Read it again', captionFont, INK, 'center');
  again.position.x = AGAIN_X;
  const rule = new Mesh(new PlaneGeometry(0.068, 0.0016), new MeshBasicMaterial({ color: '#D4A23E', transparent: true, toneMapped: false }));
  rule.position.set(AGAIN_X, -0.009, 0);
  const anchor = new Object3D();
  anchor.position.set(AGAIN_X, 0, 0);
  root.add(end, again, rule, anchor);
  root.visible = false;
  let near = false;
  return {
    root,
    readAgain: anchor,
    show(on, opacity) {
      root.visible = on && opacity > 0.01;
      end.fillOpacity = opacity;
      again.fillOpacity = opacity;
      (rule.material as MeshBasicMaterial).opacity = opacity * (near ? 1 : 0.7);
    },
    setChapter(n) {
      const line = endLine(n);
      if (end.text === line) return;
      end.text = line;
      end.sync();
    },
    setNear(value) {
      near = value;
      rule.scale.y = value ? 1.6 : 1;
    },
    setSize(sizeM) {
      for (const t of [end, again]) {
        if (Math.abs(t.fontSize - sizeM) < 1e-5) continue;
        t.fontSize = sizeM;
        t.sync();
      }
    },
  };
}
