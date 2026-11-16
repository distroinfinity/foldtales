import { PERF_CASES, type PerfCase } from '../client/src/review/perf-cases.ts';

export interface Row {
  receivedAt: string;
  deviceId: string;
  buildId: string;
  sessionId: string;
  event: { kind: string; [field: string]: unknown };
}

export interface SessionReport {
  sessionId: string;
  deviceId: string;
  buildId: string;
  device: string;
  medianFps: number | null;
  lowFps: number | null;
  hitches: number;
  worstHitchMs: number;
  errors: string[];
  placement: string[];
}

const median = (values: number[]): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
};

export function summarise(rows: Row[]): SessionReport[] {
  const sessions = new Map<string, Row[]>();
  for (const row of rows) sessions.set(row.sessionId, [...(sessions.get(row.sessionId) ?? []), row]);
  return [...sessions.values()].map((group) => {
    const of = (kind: string) => group.map((row) => row.event).filter((event) => event.kind === kind);
    const frames = of('frame_summary');
    const hitches = of('hitch').map((event) => Number(event.ms));
    const lows = frames.map((event) => Number(event.lowFps));
    return {
      sessionId: group[0]!.sessionId,
      deviceId: group[0]!.deviceId,
      buildId: group[0]!.buildId,
      device: String(of('session')[0]?.device ?? 'unknown'),
      medianFps: median(frames.map((event) => Number(event.medianFps))),
      lowFps: lows.length > 0 ? Math.min(...lows) : null,
      hitches: hitches.length,
      worstHitchMs: hitches.length > 0 ? Math.max(...hitches) : 0,
      errors: of('error').map((event) => `${String(event.where)}: ${String(event.message)}`),
      placement: of('stage_fit').map((event) => String(event.surface)),
    };
  });
}

/** The room states `room_fx` reports. One-off moments (the boat, the tide, a bottle, a hunt) aren't states. */
const LASTING = new Set(['rain', 'snow', 'night-sky', 'sea', 'shadows', 'fireflies', 'gulls', 'window']);

export interface CaseReport {
  testCase: string;
  sessions: number;
  builds: string[];
  /** 10-second windows counted: not a session's first (getting into the fixture), none straddling a change of effects. */
  windows: number;
  /** The median of the counted windows' median fps. */
  medianFps: number | null;
  /** The lowest 1% low (99th-percentile frame time) of any counted window. Not the single slowest frame. */
  low1PercentFps: number | null;
  /** Frames over 16.7 ms (under 60 fps), summed over the counted windows. */
  slowFrames: number;
  worstFrameMs: number;
  hitches: number;
  /** The lasting effects the fixture asks for, those seen on in the counted windows, and any missing. */
  expected: string[];
  seen: string[];
  missing: string[];
}

/** Frame numbers per `?perf=` fixture, with each fixture's effects checked against what was really on. */
export function byCase(rows: Row[], cases: PerfCase[] = PERF_CASES): CaseReport[] {
  const sessions = new Map<string, Row[]>();
  for (const row of rows) sessions.set(row.sessionId, [...(sessions.get(row.sessionId) ?? []), row]);
  const out = new Map<string, CaseReport & { fps: number[] }>();
  for (const group of sessions.values()) {
    const testCase = group.map((r) => r.event).find((e) => e.kind === 'session' && typeof e.testCase === 'string')?.testCase as string | undefined;
    if (!testCase) continue;
    const expected = (cases.find((c) => c.id === testCase)?.hold ?? []).map((h) => h.effect as string).filter((e) => LASTING.has(e));
    const report = out.get(testCase) ?? { testCase, sessions: 0, builds: [], windows: 0, medianFps: null, low1PercentFps: null, slowFrames: 0, worstFrameMs: 0, hitches: 0, expected, seen: [], missing: [], fps: [] };
    report.sessions++;
    if (!report.builds.includes(group[0]!.buildId)) report.builds.push(group[0]!.buildId);
    const events = group.map((r) => r.event).sort((a, b) => String(a.at).localeCompare(String(b.at)));
    let on: string[] = [];
    let changedAt = Number.NEGATIVE_INFINITY;
    let first = true;
    for (const e of events) {
      const at = Date.parse(String(e.at));
      if (e.kind === 'room_fx') {
        on = (e.on as string[]) ?? [];
        changedAt = at;
      } else if (e.kind === 'hitch') report.hitches++;
      else if (e.kind === 'frame_summary') {
        const windowMs = Number(e.windowSeconds ?? 10) * 1000;
        const straddles = at - windowMs < changedAt;
        if (first || straddles) {
          first = false;
          continue;
        }
        report.windows++;
        report.fps.push(Number(e.medianFps));
        report.low1PercentFps = Math.min(report.low1PercentFps ?? Infinity, Number(e.lowFps));
        report.slowFrames += Number(e.slowFrames ?? 0);
        report.worstFrameMs = Math.max(report.worstFrameMs, Number(e.worstFrameMs ?? 0));
        for (const effect of on) if (!report.seen.includes(effect)) report.seen.push(effect);
      }
    }
    out.set(testCase, report);
  }
  return [...out.values()].map(({ fps, ...r }) => ({ ...r, medianFps: median(fps), missing: r.expected.filter((e) => !r.seen.includes(e)) }));
}

async function main(): Promise<void> {
  const url = process.env.BACKEND_URL;
  const token = process.env.TT_ADMIN_TOKEN;
  if (!url || !token) throw new Error('needs BACKEND_URL and TT_ADMIN_TOKEN in the environment');
  const since = process.argv.slice(2).find((a) => !a.startsWith('--')) ?? new Date(Date.now() - 86_400_000).toISOString();
  const response = await fetch(`${url}/admin/telemetry?since=${encodeURIComponent(since)}`, { headers: { authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`the backend answered ${response.status}`);
  const { rows } = (await response.json()) as { rows: Row[] };
  // `--cases`: one row per `?perf=` fixture instead of one per session.
  console.log(JSON.stringify(process.argv.includes('--cases') ? byCase(rows) : summarise(rows), null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
