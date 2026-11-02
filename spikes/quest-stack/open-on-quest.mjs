// Points the headset's open Quest Browser tab at the spike, since it ignores Android open-URL requests.
// Usage: node open-on-quest.mjs [url]
import { execFileSync } from "node:child_process";
const url = process.argv[2] ?? "https://localhost:8081/";
const adb = (...a) => execFileSync("adb", a, { encoding: "utf8" });
const serial = adb("devices").split("\n").slice(1).map((l) => l.split("\t")).find((p) => p[1] === "device")?.[0];
if (!serial) { console.error("No authorized headset."); process.exit(1); }
adb("-s", serial, "reverse", "tcp:8081", "tcp:8081");
adb("-s", serial, "forward", "tcp:9222", "localabstract:chrome_devtools_remote");
const tabs = async () => (await (await fetch("http://127.0.0.1:9222/json")).json()).filter((t) => t.type === "page");
try {
  const tab = (await tabs())[0];
  if (!tab) { console.error("No open browser tab. Open Quest Browser first."); process.exit(1); }
  await new Promise((resolve, reject) => {
    const ws = new WebSocket(tab.webSocketDebuggerUrl);
    ws.onopen = () => ws.send(JSON.stringify({ id: 1, method: "Page.navigate", params: { url } }));
    ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id === 1) { console.log("navigate:", JSON.stringify(m.result ?? m.error)); ws.close(); resolve(); } };
    ws.onerror = () => reject(new Error("could not reach the tab"));
  });
  await new Promise((r) => setTimeout(r, 4000));
  for (const t of await tabs()) console.log("tab:", t.title.slice(0, 60), "|", t.url.slice(0, 80));
} finally {
  adb("-s", serial, "forward", "--remove", "tcp:9222");
}
