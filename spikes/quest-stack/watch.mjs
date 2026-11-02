// Prints what matters from the headset as it happens. Usage: tail -n0 -f spike-telemetry.jsonl | node watch.mjs
import readline from "node:readline";
let lastPerf = 0;
readline.createInterface({ input: process.stdin }).on("line", (line) => {
  let e;
  try { e = JSON.parse(line); } catch { return; }
  const at = `${Math.round((e.t ?? 0) / 1000)}s`;
  if (e.kind === "perf") {
    const bad = e.fps < 80 || e.worstMs > 60;
    if (bad || e.t - lastPerf > 45000) { lastPerf = e.t; console.log(`${at} ${bad ? "PERF DIP" : "perf"} fps ${e.fps} worst ${e.worstMs}ms load ${e.load} puppets ${e.puppets} calls ${e.calls} ${e.vis}`); }
  } else if (e.kind === "doodle") {
    console.log(`${at} DOODLE ${e.label} / ${e.locomotion} joints ${e.joints} gait ${e.gaitMs}ms rig ${e.rigMs}ms strokes ${e.strokes} finished by ${e.finishedBy}`);
  } else {
    const { kind, t, png, ua, rig, ...rest } = e;
    console.log(`${at} ${kind} ${JSON.stringify(rest).slice(0, 180)}`);
  }
});
