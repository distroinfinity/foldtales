import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { auditionHandler, readClientPort } from "./serve-audition.mjs";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "serve-"));
const voiceDir = path.join(root, "voice");
const runDir = path.join(root, "run");
fs.mkdirSync(voiceDir);
fs.mkdirSync(runDir);
fs.writeFileSync(path.join(voiceDir, "audition.html"), "<!doctype html>page");
fs.writeFileSync(path.join(voiceDir, "chain.mjs"), "export {}");
fs.writeFileSync(path.join(voiceDir, "chain.json"), "{}");
fs.writeFileSync(path.join(runDir, "clips.json"), '{"roles":[]}');
fs.writeFileSync(path.join(runDir, "sweep-01.mp3"), Buffer.from("0123456789"));
fs.writeFileSync(path.join(runDir, "plan.json"), '{"secret":"map"}');
fs.writeFileSync(path.join(runDir, "manifest.jsonl"), "{}\n");
fs.writeFileSync(path.join(root, ".env.local"), "KEY=x");
fs.writeFileSync(path.join(root, "AGENTS.md"), "agents");

let server;
let base;
before(async () => {
  server = http.createServer(auditionHandler({ voiceDir, runDir }));
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = { port: server.address().port };
});
after(() => server.close());

// Plain http.request so paths like /../x reach the server unnormalized.
function get(pathname, headers = {}) {
  return new Promise((resolve, reject) => {
    http.get({ host: "127.0.0.1", port: base.port, path: pathname, headers }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString() }));
    }).on("error", reject);
  });
}

test("serves the allowlisted paths with correct content types", async () => {
  const cases = [["/", "text/html"], ["/chain.mjs", "text/javascript"], ["/chain.json", "application/json"], ["/run/clips.json", "application/json"], ["/run/sweep-01.mp3", "audio/mpeg"]];
  for (const [url, type] of cases) {
    const r = await get(url);
    assert.equal(r.status, 200, url);
    assert.match(r.headers["content-type"], new RegExp(type), url);
  }
});

test("404s /.env.local, /plan.json, /run/plan.json, /run/manifest.jsonl, /../AGENTS.md, and %2e%2e-encoded traversal", async () => {
  for (const url of ["/.env.local", "/plan.json", "/run/plan.json", "/run/manifest.jsonl", "/../AGENTS.md", "/run/../.env.local", "/run/%2e%2e/.env.local", "/run/..%2f.env.local", "/run/%2e%2e%2fAGENTS.mp3", "/run/sweep-01.txt"]) {
    const r = await get(url);
    assert.equal(r.status, 404, url);
  }
});

test("Range request returns 206 with the right bytes", async () => {
  const r = await get("/run/sweep-01.mp3", { Range: "bytes=2-5" });
  assert.equal(r.status, 206);
  assert.equal(r.body, "2345");
  assert.equal(r.headers["content-range"], "bytes 2-5/10");
});

test("a missing allowlisted clip is a 404, not a crash", async () => {
  assert.equal((await get("/run/nothing.mp3")).status, 404);
});

test("readClientPort reads the value and throws when missing, with no default", () => {
  const file = path.join(root, ".env.ports");
  fs.writeFileSync(file, "PORT_BASE=5120\nCLIENT_PORT=5120\nBACKEND_PORT=5121\n");
  assert.equal(readClientPort(file), 5120);
  fs.writeFileSync(file, "BACKEND_PORT=5121\n");
  assert.throws(() => readClientPort(file), /CLIENT_PORT/);
  assert.throws(() => readClientPort(path.join(root, "nope")), /CLIENT_PORT|\.env\.ports|no such/i);
});
