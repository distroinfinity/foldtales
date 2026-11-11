# Ticket 0: Foundations, the rest of it (ends at M0)

> **For agentic workers:** executed in one workspace with `superpowers:executing-plans`. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A link opens on the Quest, and Pip stands on your real table, breathing, with the lantern glowing. Behind it: CI, a preview URL per branch, and a live backend that holds no AI keys yet and enforces its caps.

**Architecture:** Repo and contracts is merged, so this plan is the other two workstreams, *Pip on the table* and *Deploy and backend*, as one ticket. The client gets a thin data-driven puppet and hit-test placement. The backend keeps its mock AI routes, gains device tokens, caps, real memory and telemetry on SQLite, and deploys to Railway. The client deploys to Cloudflare Pages from GitHub Actions.

**Tech stack:** IWSDK 1.1.0-rc.2 (WebXR, Three r185), Hono 4, `node:sqlite` (Node 24), vitest, GitHub Actions, Wrangler, Railway CLI.

**Spec:** `docs/sprint-plan.md` (ticket 0, M0), `docs/technical-design.md` (Stage and your room, Puppet system, Backend and hosting), `docs/design-language.md`, `docs/superpowers/specs/2026-11-09-repo-and-contracts-design.md` (what Deploy inherits). The approved motion is `art/cast/prototype.html`.

## Global Constraints

- No flagship name in `client/src`, `backend/src` or `contracts/src` (`tests/repo.test.ts` enforces it). The cast's folder comes from data.
- `contracts` isn't touched. A contract change is its own small PR, so if one proves necessary, stop and raise it.
- Never import from `spikes/`. Spike logic is rewritten, not copied.
- Keys only in `.env.local`, Railway variables or GitHub secrets. Never print, copy or commit one. The client only sees `TT_PUBLIC_*`.
- No literal ports. Dev servers read `.env.ports`.
- Nothing on the Quest without the owner. Agents use the emulator; the headset test is the owner's.
- No test visuals in any build. Nothing goes out with debug labels, axes or placeholder art.
- Hands-first: no controller code paths.
- No documents published to Claude artifacts or Docs. Commits go on `ticket-0-foundations`; push and PR only when the owner asks (deploy steps need the push, so Task 7 asks).
- Free tiers first, an estimate before anything paid, hard caps always.

## Not in this ticket

Belongs to ticket 1 (Painted Stage Kit, Stage and room): KTX2 and atlases, the full acting list, card yaw toward you, moods, room dim, depth occlusion, moving the stage, the landing page, the frame guard, resume. No real AI handlers or Anthropic key either: those come with the routes that use them (ticket 3), so **the Anthropic key isn't needed yet.**

## Review Focus

Each line has a test in the task that owns it.

1. Nothing to hit (bare floor, looking away, no table): Pip appears at the fallback spot, then moves once to a real surface if one turns up.
2. The backend is down or slow: Pip still places and animates, and telemetry is dropped silently.
3. A stored device token is expired or rejected: the client gets a new one once, and doesn't loop.
4. A shelf above your eyes or a floor hit: never chosen as the table.
5. An art file fails to load: no half-built puppet on the table. The error is reported and nothing appears.

---

### Task 1: Serve cast art to the client

The client can't reach `art/` today: `publicDir` is `client/public`. Copying the whole of `art/` would ship every run's sheets.

**Files:** Create `client/public/stage.json`, `client/vite/art-plugin.ts`. Modify `client/vite.config.ts`. Test `tests/art-plugin.test.ts`.

**Interfaces:** Produces `client/public/stage.json`:
```json
{ "cast": "cast/pip", "heightM": 0.17, "glow": { "x": 96, "y": -215, "sizePx": 620 }, "shadow": { "widthM": 0.085, "depthM": 0.03 } }
```
And `artPlugin({ artRoot, folders })`, a Vite plugin: in `serve` it answers `/art/<folder>/...` from `art/<folder>`, and in `build` it calls `this.emitFile({ type: 'asset', fileName: 'art/...', source })` in `generateBundle`, so the files honour whatever `outDir` is resolved and survive Vite's output cleanup. `scripts/check-bundle.ts` overrides `outDir`, so this also puts art inside what it scans. `folders` is read from `stage.json`'s `cast`.

- [ ] Write `tests/art-plugin.test.ts`: `art/cast/pip/rig.json` parses as `Rig` and every file it names exists; `resolveArtPath('/art/cast/pip/rig.json', ...)` returns the file; `/art/runs/001/x.png`, `/art/cast/pip/../../../.env.local` and an absolute path return `null`.
- [ ] Run it and see it fail.
- [ ] Implement `resolveArtPath(url, artRoot, folders): string | null` and the plugin. Reject anything that resolves outside an allowed folder.
- [ ] Add two integration cases to that test, through Vite's API: a build with an overridden temporary `outDir` contains `art/cast/pip/rig.json` and no `art/runs`, and leaves `client/dist` alone; a dev server's middleware answers the rig with 200 and `/art/runs/...` with no art file.
- [ ] Run it and see it pass. `pnpm check:bundle` still passes.
- [ ] Commit.

### Task 2: Puppet geometry and idle motion, as pure code

**Files:** Create `client/src/puppet/layout.ts`, `client/src/puppet/idle.ts`. Test `tests/puppet.test.ts`.

**Interfaces:**
- `layoutCards(rig: Rig, sizes: Record<string, [number, number]>, heightM: number): CardLayout[]`, where `CardLayout = { name, file, pivot: [x, y, z] (m), size: [w, h] (m), anchor: [x, y] (m, card centre from pivot) }`. Heads are named `head:<face>`.
- `metresPerPixel(rig, heightM)`: `heightM / rigHeightPx`, with `rigHeightPx = -min(y of parts and head)` (905 for this rig).
- `idlePose(t: number): IdlePose`, where `IdlePose = { rotationsDeg: Record<string, number>, breatheScaleY: number, face: 'forward' | 'blink', glowScale: number }`.

Rig maths, from the prototype's `add` and `heads`: a part's box is `(x, y, w*scale, h*scale)` in rig pixels, y down, feet at the origin. Its pivot is at `pivot%` of that box. A head adds `offset*scale` to `x, y`. Three.js Y is `-y`, and a CSS clockwise angle is a negative `rotation.z`. Depth is `z * 1 mm`.

Idle values, from `prototype.html`'s `draw`: time is stepped to 12 poses a second. `sway = sin(1.1t)`, `breathe = sin(1.9t)`, `flick = sin(2.7t)`. `coat` scaleY `1 + .008*breathe`, `arm` `2*sway`, `tail` `5*flick`, `lantern` `2.2*sin(2.2t)`, `head` `1.5*sway`, blink while `t % 4.1 < .17`, glow size `1 + .05*sin(7t)`.

- [ ] Write tests against the real rig: the top of `head:forward` lands at `heightM` within 1 mm; the feet origin is y=0; `coat` pivot is at rig (`-238 + w/2`, `-730 + h`) converted to metres; `lantern`'s size is `.78` of its image; z order puts `arm` in front of `coat`; head offsets move `head:up` by `-43*.7` px; `idlePose(1.0)` equals `idlePose(1.0 + 1/40)` (stepped), blink is on at `t=0.1` and off at `t=1`.
- [ ] Run, see them fail, implement, see them pass, commit.

### Task 3: The puppet on screen

**Files:** Create `client/src/puppet/puppet.ts`, `client/src/puppet/soft-sprites.ts`.

**Interfaces:** `loadPuppet(base: string, stage: StageConfig): Promise<Puppet>`, where `Puppet = { root: Group, update(t: number): void }`. It rejects if `rig.json` or any used PNG fails. Only the two faces idle uses (`forward`, `blink`) are loaded.

- Cards: one `PlaneGeometry` per part, in a `Group` at the pivot, mesh offset by `anchor`. `MeshBasicMaterial`, `map` sRGB with mipmaps and anisotropy 4, `alphaToCoverage: true`, `alphaTest: 0.5`, `transparent: false`, `side: DoubleSide`, `toneMapped: false`. The `alphaTest` is the fallback: with coverage, Three's shader turns it into a soft edge and discards fully transparent texels, and if the XR framebuffer turns out not to be multisampled, coverage does nothing and the same discard gives a hard edge. So transparent margins never write depth either way. The owner's checklist covers overlapping cards and edges.
- Contact shadow: horizontal `CanvasTexture` ellipse from `stage.shadow`, `rgba(10,8,12,.55)` fading to 0 at 70%, 1 mm above the surface, `depthWrite: false`.
- Chin shadow: `rig.chinShadow`'s ellipse at its position and z, `rgba(38,26,34,.5)`, `.28` at 45%, 0 at 72%, `transparent`, `depthWrite: false`. Skipped if the rig has none.
- Lantern glow: a plane at `stage.glow`, radial warm `rgb(255,214,130)`, `NormalBlending` with alpha `.35` at the centre, `.12` at 45%, 0 at 70%, `depthWrite: false`, drawn after the cards, scaled by `glowScale`. CSS `screen` doesn't translate: additive blending adds alpha too, so over passthrough it can dim the room instead of lightening it. Normal blending composites predictably. The peak is a starting value, and the owner's checklist tries it against a bright wall and a dark one.
- [ ] Add `tests/puppet.test.ts` cases: `loadPuppet` rejects when a file 404s (with a stub loader), and every card's material has `alphaTest > 0`.
- [ ] Implement, typecheck, commit. The visual check is in Task 4, once something can show it.

### Task 4: Placement on the real table

**Files:** Create `client/src/stage/surface.ts` (pure), `client/src/stage/placement-system.ts`. Modify `client/src/index.ts`, `client/index.html`. Test `tests/surface.test.ts`.

**Interfaces:**
- `Hit = { position: Vec3, normalY: number }`, where `normalY` is the Y of the hit pose's up axis (a WebXR hit pose's Y axis is the surface normal).
- `pickSurface(hits: Hit[], head: Vec3): Vec3 | null`
- `horizontalForward(forward: Vec3, up: Vec3): Vec3`
- `fallbackSpot(head: Vec3, forward: Vec3): Vec3`
- `createPlacement(): { step(nowMs: number, input: { head: Vec3 | null, forward: Vec3 | null, hits: Hit[] }): PlacementDecision }`, pure and clock-injected. `PlacementDecision = { state: 'searching' | 'fallback' | 'placed', moveTo: Vec3 | null, surface: 'hit_test' | 'fallback' | null }`.
- `PlacementSystem`, an IWSDK system: it owns the hit-test sources and one `createPlacement()` per session.

Rules for `pickSurface`: a hit counts if `normalY >= 0.9` (facing up), it's within **0.6 m** horizontally of the head (the design's reach rule, tighter than the spike's 0.8 m), `y > 0.35`, `y < head.y - 0.1`, and its straight-line distance from the eyes is at least **0.5 m**. Hits too close are dropped, not pushed outward, so Pip is never moved off the surface that was found. Group by connection: hits within 3 cm of height and 20 cm of a neighbour. A group needs at least 3 hits. Take the highest group, and return **the member nearest the group's centroid**, which is a point that was actually hit, not a centroid over empty space.

`horizontalForward` flattens `forward`, and if you're looking almost straight down (flattened length under 0.2) uses the flattened `up` instead, which points where your face points. `fallbackSpot` is 0.55 m along that, 0.4 m below the head.

The machine: a **fixed 5 s deadline from session start**, which unstable or intermittent hits can't postpone. A surface must hold within 2 cm for 0.5 s before it locks. At the deadline with no lock, and once a head pose exists, Pip appears at the fallback, and the first stable real surface after that moves him once and locks. Null head poses (tracking lost) don't advance stability. Pip faces the head at placement (yaw only) and stays put. Each placement sends a `stage_fit` event.

The system runs 12 viewer-space hit-test rays per frame. Sources are created once per session and cancelled at its end, and a request that finishes after its session ended is ignored. If hit-test is unsupported or the request rejects, the machine simply gets no hits and reaches the fallback. Leaving and re-entering makes a new machine. `index.html` gets a plain page colour and one line of text, since the real landing page is ticket 1.

- [ ] Write `tests/surface.test.ts`: Review Focus 1 and 4: no hits gives `null`; two hits don't make a group; a shelf above the head and a floor hit are ignored; vertical-wall hits (`normalY` 0) are ignored; the highest group wins; two disconnected patches at one height aren't merged and the result is a real hit; beyond 0.6 m is ignored; a surface 0.3 m from the eyes is rejected, not moved; a tray edge returns a point on the tray; a pitched head still gets a good `horizontalForward`, including looking straight down.
- [ ] Write machine tests with a fake clock: no hits reaches fallback at exactly 5 s; flickering hits don't delay it; jitter over 2 cm restarts stability only; a stable surface before the deadline locks with no fallback; a late surface moves him exactly once and later surfaces don't; a null head pose at the deadline delays the fallback until a pose exists; a new machine starts clean.
- [ ] Run, see them fail, implement, see them pass.
- [ ] Wire `loadPuppet` and `PlacementSystem` into `index.ts`. A failed load reports an `error` event and leaves the stage empty (Review Focus 5).
- [ ] Emulator: `pnpm --filter @tabletop/client dev:agent`, enter AR, then confirm with `iwsdk xr status` that the session is active, Pip's root exists at a surface height in the hierarchy, and the pose changes over time. Then one screenshot, checked against the design language's look bar.
- [ ] `pnpm typecheck`, `pnpm test`, commit.

### Task 5: The backend for real

**Files:** Create `backend/src/tokens.ts`, `backend/src/store.ts`, `backend/src/guard.ts`, `backend/src/real-routes.ts`. Modify `backend/src/app.ts`, `backend/src/server.ts`. Test `backend/test/guard.test.ts`, `backend/test/store.test.ts`.

**Interfaces:**
- `issueToken(secret, now, deviceId?): { deviceId, token, expiresAt }` and `verifyToken(secret, token, now, { allowExpired? }): string | null`. HMAC-SHA256 over `deviceId.expiry`, 30 days, compared in constant time.
- `openStore(path): Store`, on `node:sqlite` (`:memory:` in tests). Methods: `countUse(day, scope, feature): number` (increments and returns), `appendEvents`, `readEvents`, `deleteSeries`, `addTelemetry`, `readTelemetry(sinceIso)`.
- `guard(store, config): MiddlewareHandler`, run before any route. `currentDevice(): string`, from `AsyncLocalStorage`.
- `realRoutes(store, secret): Pick<BackendApi, 'issueDevice' | 'memoryAppend' | 'memoryRead' | 'memoryDelete' | 'sendTelemetry'>`. `server.ts` merges these over the mock.

Behaviour:
- `/healthz` and `/v1/device` need no token. Every other `/v1/*` route needs a valid bearer, or it's `unauthorized` (401).
- **Renewal keeps the identity.** `/v1/device` with a correctly signed bearer, even an expired one, returns a new token for the same `deviceId`, so a device's memory stays readable. The request body is still `{}`, so no contract change. Only a missing or forged bearer gets a new identity.
- New identities are throttled to 20 per day per client address (from Railway's `X-Real-IP`, stored as an HMAC, never raw). The device cap is per installation, not verified hardware; the global caps are the hard money guard. A throttled caller gets `quota_exceeded` and plays the authored path.
- Middleware order: CORS, then body limit, then contract header, then auth, then caps. CORS first or preflight fails. Allowed origins compare the parsed hostname with `TT_CLIENT_HOST` or a true subdomain of it, https only. Allowed headers are `content-type`, `authorization` and the contract header.
- Request bodies over 512 KB are refused before buffering (Hono `bodyLimit`), as `bad_request`.
- Caps, per UTC day, checked before the handler. A hit returns `quota_exceeded` (429): 

| Scope | Default | Env |
|---|---|---|
| Each AI feature, per device | 200 calls | `CAP_DEVICE_FEATURE` |
| Each AI feature, overall | 2,000 calls | `CAP_FEATURE` |
| All AI routes, overall | 5,000 calls | `CAP_GLOBAL` |
| New identities, overall | 1,000 | `CAP_DEVICES` |
| `memoryAppend`, per device | 2,000 calls | `CAP_MEMORY_DEVICE` |
| `sendTelemetry`, per device | 2,000 calls | `CAP_TELEMETRY_DEVICE` |
| Persistence writes, overall | 200,000 calls | `CAP_WRITES` |

AI routes: `planBeat`, `planSpine`, `reactToObject`, `replyAsCharacter`, `speakLine`, `speechToken`. A failed count must fail closed, so an AI route never runs uncounted.
- Memory is keyed by device and series, so another device's series reads as empty. Append is idempotent on `(deviceId, seriesId, event.id)`, as the contract's envelope comment and the mock say: a resend keeps the original. Two different ids with one `seq` are both kept, since the contract says memory keeps what it's given. An event whose `seriesId` differs from the request's is `bad_request`. Reads match the mock (`seq > afterSeq`, null `seq` not returned, ordered by `seq`).
- Bounds: 500 events per append (`bad_request` over that), 20,000 events per device (`quota_exceeded`), a read page of 5,000 events, extended to include every event tied at the page's last `seq`, so paging with `afterSeq` can never skip one. Telemetry older than 14 days is pruned on write, and the admin read returns at most 10,000 rows.
- `GET /admin/telemetry?since=` needs `Authorization: Bearer $TT_ADMIN_TOKEN`, is outside `/v1`, and returns 404 if the token isn't configured.
- `DATA_DIR` picks the database location. Production refuses to start without `TT_TOKEN_SECRET`.

- [ ] Write tests with `app.request()` and `createHttpBackend` pointed at the app: a missing, tampered or expired token is refused on an AI route; `/v1/device` works without one; renewing with an expired but valid token keeps the `deviceId`, and memory is still readable after; a forged bearer gets a new identity; the 21st new identity from one address is throttled and renewals aren't counted; a full browser preflight (with `content-type`, `authorization` and the contract header requested) passes from an allowed origin and the authenticated POST then works; `evil-tabletop-theater.pages.dev` and an http origin get no CORS header; each cap, including a cap of 0, returns `quota_exceeded`, as `BackendError` on a JSON route and an `error` chunk on a stream; the caps reset the next UTC day; device B can't read device A's series; a resent event id adds nothing; a null `seq` and two ids sharing a `seq` behave as above; a mismatched `seriesId` and an oversized body are refused; 501 events is `bad_request`; 5,001 events tied at one `seq`, appended over several requests, all come back from paged reads.
- [ ] Run, see them fail, implement, see them pass. `tests/repo.test.ts` and existing `backend/test/app.test.ts` stay green.
- [ ] Commit.

### Task 6: Client telemetry and device token

**Files:** Create `client/src/telemetry.ts`. Modify `client/src/backend.ts`. Test `tests/telemetry.test.ts`.

**Interfaces:**
- `getBackend(deps?): Promise<BackendApi | null>`: reads a stored token, and if it's missing or within a day of expiry calls `issueDevice` with the old token as bearer (renewal keeps the identity) and stores the result. Single-flight, so overlapping callers and overlapping `unauthorized` replies make one request. `null` when the backend can't be reached.
- Every backend call goes through a `fetch` wrapper with an 8 s deadline (`AbortSignal.timeout`). The contract's HTTP client has none, and changing it is out of scope.
- `aiOrAuthored<T>(call: () => Promise<T>, authored: () => T, onFallback: (reason: FallbackReason) => void): Promise<T>`: the boundary ticket 2's scheduler will use, in `client/src/ai-or-authored.ts`. `quota_exceeded` is `cap`, a network failure or no backend is `offline`, a deadline is `slow`, and anything else is `failed`.
- `createTelemetry(send, clock): Telemetry` with `record(event)`, `frame(deltaMs, renderInfo)`, `flush()`.

Sends a `session` event, a `frame_summary` every 10 s, a `hitch` for any frame over 100 ms, `error` from `window.onerror` and rejected promises, and `stage_fit`. Flushes every 10 s and on `visibilitychange`. Batches stay within the contract's 500-event limit. At most one send is in flight, and the queue holds at most 500 events, dropping the oldest. Nothing here can throw into the frame loop, and nothing is awaited by the stage.

- [ ] Write tests: Review Focus 2 (a rejecting `send` is swallowed, a never-settling `send` leaves one in flight and a bounded queue, and placement's frame path never waits on it) and 3 (an `unauthorized` reply re-issues exactly once, including with overlapping replies); median and low fps from known frame times; a batch over 500 is split.
- [ ] Write the `aiOrAuthored` tests: each error maps to its reason, and against the real app (`createApp` from Task 5, `CAP_GLOBAL=0`) a `planBeat` call through `createHttpBackend` returns the authored fixture with reason `cap`. This is the ticket's "a hit cap falls back to authored".
- [ ] Run, see them fail, implement, see them pass, commit.

### Task 7: CI, hosting and the first deploy

**Files:** Create `.github/workflows/ci.yml`, `railway.json`, `scripts/telemetry-report.ts`. Test `tests/telemetry-report.test.ts`.

- **CI, every push and PR:** `pnpm install --frozen-lockfile`, `pnpm check` (typecheck, tests, bundle key scan). Node from `.nvmrc`.
- **Client, after CI passes on any branch:** `pnpm --filter @tabletop/client build` with `TT_PUBLIC_BACKEND_URL` and `TT_PUBLIC_BUILD_ID`, then `wrangler pages deploy client/dist --project-name tabletop-theater --branch <branch>`. Main is production and each branch gets its preview URL, written to the job summary.
- **Backend, after CI passes on main:** `railway up --service backend --ci`. `railway.json` sets the Node build, `pnpm --filter @tabletop/backend start`, and the `/healthz` health check. One volume at `/data`, `DATA_DIR=/data`. US region.
- **`scripts/telemetry-report.ts`:** reads `/admin/telemetry` and prints per session: device, median and low fps, hitches, errors, placement surface. Reads `TT_ADMIN_TOKEN` from the environment and never prints it.

- [ ] Test the report's summary with fixture events. Write the workflow and `railway.json`. Commit.
- [ ] **Stop for the owner.** Show the estimate (Railway about $7 a month, part or all covered by plan credit; Cloudflare Pages and GitHub Actions free tiers) and get a yes. The owner creates two tokens in the dashboards, since a CLI login can't mint them: a Cloudflare API token with Pages edit, and a Railway project token. They go straight into GitHub secrets (`gh secret set`, values typed by the owner, never through an agent).
- [ ] Create the Pages project and Railway service with the logged-in CLIs. Generate `TT_TOKEN_SECRET` and `TT_ADMIN_TOKEN` with `openssl rand`, written straight to Railway variables and `.env.local` without being displayed. Set `TT_CLIENT_HOST`. Attach the volume at `/data` and generate the public domain.
- [ ] **Bootstrap deploy, covered by the owner's yes above:** run `railway up --service backend` once from this reviewed branch, since CI only deploys the backend from main. Confirm `/healthz`. Store the URL as the GitHub variable `BACKEND_URL`.
- [ ] Push the branch, which the owner asks for at this step. Confirm CI is green, the preview URL (built against `BACKEND_URL`) serves `art/cast/pip/rig.json`, and the preview can reach the backend. From here on, the backend deploys only from main.
- [ ] From this machine, against the live URL: get a token, send a telemetry batch, and read it back with the report. Confirm a request with no token is refused. Temporarily set `CAP_GLOBAL=0` on Railway, confirm `quota_exceeded`, then restore it. Confirm the per-address throttle sees a real `X-Real-IP` by checking that two calls from this machine share one bucket.
- [ ] Scan the deployed bundle for key shapes, using `scripts/scan-secrets.ts`'s rules.

### Task 8: M0 sign-off

- [ ] Agent checks, all reported with evidence: `pnpm check` green in CI, Pip boots in the emulator, keys absent from the bundle, the cap test from Task 7.
- [ ] Give the owner the preview link, with no USB needed, and a short headset checklist: the link opens and offers AR; Pip lands on the table within a few seconds; is he at the right size (170 mm) and sitting on the surface with a shadow; does he breathe, blink, and does the lantern glow and flicker, against a bright wall and a dark one; do the card edges look clean where parts overlap, with no boxes around them; how does he hold up walking around to the side; frame rate from telemetry. The test only the owner can pass: **does Pip feel alive in your real room?**
- [ ] Write what the owner says in `docs/playtest-notes.md`. A sign-off unblocks ticket 1.

## Done means

M0 signed off by the owner on the Quest, from a preview link. CI green. Backend live with caps proven. All of this on `ticket-0-foundations`, with a PR when the owner asks.

## Review

Codex reviewed this plan before any code was written. It found one P0, eleven P1s and three P2s. Every one is answered in the tasks above.

1. **P0, the first backend deploy had no path** (CI deploys only from main). *Fixed:* an owner-approved bootstrap `railway up` from this branch, then main only.
2. **P1, renewal changed the identity that owns memory.** *Fixed:* a signed bearer, even expired, renews the same device. Body stays `{}`, so the contract is untouched.
3. **P1, anonymous issuance bypassed the device quota.** *Fixed:* 20 new identities a day per address, and the device cap is described as per installation.
4. **P1, no resource caps on memory or telemetry.** *Fixed:* a 512 KB body limit before buffering, per-device and overall write caps, storage and read bounds, 14-day telemetry retention.
5. **P1, idempotency on `seq` contradicted the contract.** *Fixed in part:* it's on event `id`, and mismatched series ids are refused. *Not taken:* rejecting `seq` conflicts, because the contract says memory keeps what it's given.
6. **P1, `alphaToCoverage` assumed multisampling.** *Fixed:* `alphaTest: 0.5` in the same material, which works with or without it, and the owner checks edges.
7. **P1, additive blending isn't `screen` over passthrough.** *Fixed:* normal blending with a deliberate alpha, tried against bright and dark backgrounds.
8. **P1, height alone doesn't make a table.** *Fixed:* upward normals, connected groups, and a point that was actually hit.
9. **P1, the comfort push could move Pip off the table.** *Fixed:* too-close hits are filtered by eye distance, and looking straight down is handled.
10. **P1, the fallback wasn't specified or tested.** *Fixed:* a pure clock-injected machine with a fixed deadline and tests, with sources created once per session.
11. **P1, the art plugin ignored the resolved output directory.** *Fixed:* `emitFile`, with integration tests through Vite.
12. **P1, no deadline on a hanging backend.** *Fixed:* an 8 s deadline, single-flight tokens, one send in flight and a bounded queue.
13. **P2, the cap check didn't prove the authored fallback.** *Fixed:* a small `aiOrAuthored` boundary, tested against the real app at cap.
14. **P2, the approved chin shadow was missing.** *Fixed:* drawn from the rig.
15. **P2, the preflight test was too weak.** *Fixed:* a full preflight then the POST, CORS first, and real hostname comparison.

A second Codex pass checked the fixes and accepted the declined item. It found one new P1: the read limit could skip events tied at one `seq`. *Fixed:* a page extends to include every tie, with a regression test. No P0 or P1 remains.
