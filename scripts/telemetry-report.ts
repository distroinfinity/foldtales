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

async function main(): Promise<void> {
  const url = process.env.BACKEND_URL;
  const token = process.env.TT_ADMIN_TOKEN;
  if (!url || !token) throw new Error('needs BACKEND_URL and TT_ADMIN_TOKEN in the environment');
  const since = process.argv[2] ?? new Date(Date.now() - 86_400_000).toISOString();
  const response = await fetch(`${url}/admin/telemetry?since=${encodeURIComponent(since)}`, { headers: { authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`the backend answered ${response.status}`);
  const { rows } = (await response.json()) as { rows: Row[] };
  console.log(JSON.stringify(summarise(rows), null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
