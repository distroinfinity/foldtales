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
