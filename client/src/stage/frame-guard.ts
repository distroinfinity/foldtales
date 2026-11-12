const REPORT_EVERY_MS = 1000;

/**
 * One uncaught error froze the spike's whole render loop. Every piece of our frame work runs
 * inside a guard: an error is caught, reported (at most once a second per piece) and survived.
 */
export function createFrameGuard(report: (where: string, cause: unknown) => void, now: () => number = () => performance.now()) {
  const counts = new Map<string, number>();
  const lastReport = new Map<string, number>();
  const guard = <A extends unknown[]>(where: string, work: (...args: A) => void) =>
    (...args: A): void => {
      try {
        work(...args);
      } catch (cause) {
        counts.set(where, (counts.get(where) ?? 0) + 1);
        const t = now();
        const last = lastReport.get(where);
        if (last === undefined || t - last >= REPORT_EVERY_MS) {
          lastReport.set(where, t);
          report(where, cause);
        }
      }
    };
  return Object.assign(guard, { failures: (where: string): number => counts.get(where) ?? 0 });
}
