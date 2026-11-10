// Serves the listening page and one run's audio on the LAN, so it can be opened in Quest Browser.
// Only the paths below are served. The plan, manifest and everything else in the repo stay private.
// Usage, from the repo root: node art/tools/serve-audition.mjs [art/runs/<id>]
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const AUDIO_TYPES = { mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg" };

export function readClientPort(portsFilePath) {
  const text = fs.readFileSync(portsFilePath, "utf8");
  const port = Number(text.match(/^CLIENT_PORT=(\d+)\s*$/m)?.[1]);
  if (!port) throw new Error(`CLIENT_PORT is missing from ${portsFilePath}`);
  return port;
}

function route({ voiceDir, runDir }, pathname) {
  if (pathname === "/") return { file: path.join(voiceDir, "audition.html"), type: "text/html; charset=utf-8" };
  if (pathname === "/chain.mjs") return { file: path.join(voiceDir, "chain.mjs"), type: "text/javascript; charset=utf-8" };
  if (pathname === "/chain.json") return { file: path.join(voiceDir, "chain.json"), type: "application/json" };
  if (pathname === "/run/clips.json") return { file: path.join(runDir, "clips.json"), type: "application/json" };
  const audio = pathname.match(/^\/run\/([a-z0-9A-Z-]+)\.(mp3|wav|ogg)$/);
  if (audio) return { file: path.join(runDir, `${audio[1]}.${audio[2]}`), type: AUDIO_TYPES[audio[2]] };
  return null;
}

export function auditionHandler({ voiceDir, runDir }) {
  return (req, res) => {
    // The raw request path is matched as-is. Encoded dots and slashes never match the allowlist.
    const pathname = req.url.split("?")[0];
    const target = route({ voiceDir, runDir }, pathname);
    if (!target || !fs.existsSync(target.file)) {
      res.writeHead(404).end();
      return;
    }
    const bytes = fs.readFileSync(target.file);
    const range = req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
    if (range) {
      const start = Number(range[1]);
      const end = range[2] ? Math.min(Number(range[2]), bytes.length - 1) : bytes.length - 1;
      if (start > end) {
        res.writeHead(416, { "content-range": `bytes */${bytes.length}` }).end();
        return;
      }
      res.writeHead(206, { "content-type": target.type, "content-range": `bytes ${start}-${end}/${bytes.length}`, "accept-ranges": "bytes", "content-length": end - start + 1 });
      res.end(bytes.subarray(start, end + 1));
      return;
    }
    res.writeHead(200, { "content-type": target.type, "accept-ranges": "bytes", "content-length": bytes.length, "cache-control": "no-store" });
    res.end(bytes);
  };
}

function main() {
  const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
  const port = readClientPort(path.join(repoRoot, ".env.ports"));
  const runDir = path.resolve(process.argv[2] ?? path.join(repoRoot, "art/runs/005-voice-audition"));
  const voiceDir = path.join(repoRoot, "art/voice");
  http.createServer(auditionHandler({ voiceDir, runDir })).listen(port, "0.0.0.0", () => {
    console.log(`listening on port ${port}`);
    for (const nets of Object.values(os.networkInterfaces())) {
      for (const net of nets ?? []) if (net.family === "IPv4" && !net.internal) console.log(`http://${net.address}:${port}/`);
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) main();
