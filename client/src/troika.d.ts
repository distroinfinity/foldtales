declare module 'troika-three-text' {
  import type { Color, Material, Mesh } from 'three';
  export class Text extends Mesh {
    text: string;
    font: string | null;
    fontSize: number;
    maxWidth: number;
    lineHeight: number | 'normal';
    letterSpacing: number;
    textAlign: 'left' | 'right' | 'center' | 'justify';
    anchorX: number | 'left' | 'center' | 'right' | string;
    anchorY: number | 'top' | 'top-baseline' | 'middle' | 'bottom-baseline' | 'bottom' | string;
    color: number | string | Color;
    fillOpacity: number;
    depthOffset: number;
    material: Material;
    sync(callback?: () => void): void;
    dispose(): void;
  }
  export function preloadFont(options: { font: string; characters?: string | string[] }, callback: () => void): void;
}
