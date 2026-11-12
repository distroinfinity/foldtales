/**
 * Review hooks: the cast review, the beam cue, the injected frame error, the PNG and material
 * comparisons, and occlusion. On in dev and in a review build (`vite build --mode review`), which
 * is what the headset runs; a production build has none of them.
 */
export const REVIEW_HOOKS = import.meta.env.DEV || import.meta.env.MODE === 'review';

export function reviewQuery(name: string): string | null {
  if (!REVIEW_HOOKS) return null;
  return new URLSearchParams(location.search).get(name);
}
