/**
 * Preparing the chapter a page load plays: the manifest it plays with, and the one fallback.
 */

/** The manifest as this chapter sees it: who stands where as its first spread opens is the chapter's own. */
export function chapterManifest<M extends { onStage: Array<{ cast: string; mark: string }> }>(manifest: M, chapter: { onStage: ReadonlyArray<{ cast: string; mark: string }> }): M {
  return { ...manifest, onStage: chapter.onStage.map((o) => ({ ...o })) };
}

/**
 * Prepares chapter `asked` whole (data, art, stage). If any of it fails, `cleanUp` removes what it left,
 * and chapter 1 is tried once, with the problem to show on the page. Chapter 1 failing is a real failure.
 */
export async function prepareWithFallback<T>(asked: number, attempt: (n: number) => Promise<T>, cleanUp: () => void, report: (cause: unknown) => void): Promise<{ show: T; problem: string | null }> {
  try {
    return { show: await attempt(asked), problem: null };
  } catch (cause) {
    report(cause);
    cleanUp();
    if (asked === 1) throw cause;
    return { show: await attempt(1), problem: `Chapter ${asked} couldn't open.` };
  }
}
