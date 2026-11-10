// Sets each chain setting's outputDb so it matches Dry in level, without passing the peak ceiling, using a run's audition clips.
// Usage, from the repo root: node art/tools/calibrate-chain.mjs art/runs/<id>
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { runInChrome as defaultRunInChrome } from "./chrome-harness.mjs";

const voiceDir = fileURLToPath(new URL("../voice/", import.meta.url));

export async function calibrate({ clips, chainJson, runInChrome = defaultRunInChrome }) {
  const job = { clips: clips.map((clip, i) => ({ url: `/clip/${i}`, trimDb: clip.trimDb })), chainJson };
  const handler = (req, res) => {
    const url = req.url.split("?")[0];
    if (url === "/job") {
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(job));
    } else if (url === "/calibrate.html") {
      res.writeHead(200, { "content-type": "text/html" }).end(fs.readFileSync(path.join(voiceDir, "calibrate.html")));
    } else if (url === "/chain.mjs") {
      res.writeHead(200, { "content-type": "text/javascript" }).end(fs.readFileSync(path.join(voiceDir, "chain.mjs")));
    } else if (url.startsWith("/clip/")) {
      res.writeHead(200, { "content-type": "application/octet-stream" }).end(clips[Number(url.slice(6))].bytes);
    } else {
      res.writeHead(404).end();
    }
  };
  const result = await runInChrome({ handler, path: "/calibrate.html", timeoutMs: 120000 });
  if (result.error) throw new Error(result.error);
  return result;
}

async function main() {
  const runDir = process.argv[2];
  if (!runDir) {
    console.error("usage: calibrate-chain.mjs <runDir>");
    process.exit(2);
  }
  const chainPath = path.join(voiceDir, "chain.json");
  const chainJson = JSON.parse(fs.readFileSync(chainPath, "utf8"));
  const index = JSON.parse(fs.readFileSync(path.join(runDir, "clips.json"), "utf8"));
  const clips = index.roles.flatMap((role) => role.beats.flatMap((beat) => Object.values(beat.clips))).map((clip) => ({ bytes: fs.readFileSync(path.join(runDir, clip.file)), trimDb: clip.trimDb }));
  if (!clips.length) throw new Error("no audition clips in clips.json");
  const result = await calibrate({ clips, chainJson });
  for (const [name, r] of Object.entries(result.settings)) {
    chainJson.settings[name].outputDb = r.outputDb;
    console.log(`${name}: outputDb ${r.outputDb}, RMS ${r.rmsDeltaDb.toFixed(2)} dB from Dry, peak ${r.peakDb.toFixed(2)} dBFS${r.peakLimited ? ", PEAK LIMITED" : ""}`);
  }
  fs.writeFileSync(chainPath, `${JSON.stringify(chainJson, null, 2)}\n`);
  fs.writeFileSync(path.join(runDir, "calibration.json"), `${JSON.stringify({ clips: clips.length, ...result }, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) await main();
