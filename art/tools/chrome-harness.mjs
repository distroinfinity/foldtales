// Runs a page in headless Chrome and resolves with the JSON the page posts to /__result. Test tooling only.
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const TYPES = { ".html": "text/html", ".mjs": "text/javascript", ".js": "text/javascript", ".json": "application/json", ".wav": "audio/wav", ".mp3": "audio/mpeg" };

// A plain file server over one directory, for test pages only.
export function staticHandler(dir) {
  return (req, res) => {
    const name = path.basename(new URL(req.url, "http://x").pathname);
    const file = path.join(dir, name);
    if (!name || !fs.existsSync(file)) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { "content-type": TYPES[path.extname(name)] ?? "application/octet-stream" }).end(fs.readFileSync(file));
  };
}

export function runInChrome({ handler, path: pagePath, timeoutMs = 60000 }) {
  return new Promise((resolve, reject) => {
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), "chrome-harness-"));
    let chrome;
    let settled = false;
    let timer;
    const server = http.createServer((req, res) => {
      if (req.method === "POST" && req.url === "/__result") {
        let body = "";
        req.on("data", (chunk) => { body += chunk; });
        req.on("end", () => {
          res.writeHead(200).end();
          finish(null, JSON.parse(body));
        });
        return;
      }
      handler(req, res);
    });
    function finish(error, result) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      chrome?.kill("SIGKILL");
      server.closeAllConnections();
      server.close();
      fs.rmSync(profile, { recursive: true, force: true });
      if (error) reject(error);
      else resolve(result);
    }
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      chrome = spawn(CHROME, ["--headless=new", "--no-first-run", "--no-default-browser-check", "--disable-gpu", "--mute-audio", "--autoplay-policy=no-user-gesture-required", `--user-data-dir=${profile}`, `http://127.0.0.1:${port}${pagePath}`], { stdio: "ignore" });
      chrome.on("error", (e) => finish(e));
    });
    timer = setTimeout(() => finish(new Error(`no result from ${pagePath} after ${timeoutMs} ms`)), timeoutMs);
  });
}
