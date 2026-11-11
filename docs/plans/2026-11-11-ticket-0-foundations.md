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
And `artPlugin({ artRoot, folders })`, a Vite plugin: in `serve` it answers `/art/<folder>/...` from `art/<folder>`, and in `build` it copies those folders to `dist/art/`. `folders` is read from `stage.json`'s `cast`.

- [ ] Write `tests/art-plugin.test.ts`: `art/cast/pip/rig.json` parses as `Rig` and every file it names exists; `resolveArtPath('/art/cast/pip/rig.json', ...)` returns the file; `/art/runs/001/x.png`, `/art/cast/pip/../../../.env.local` and an absolute path return `null`.
- [ ] Run it and see it fail.
- [ ] Implement `resolveArtPath(url, artRoot, folders): string | null` and the plugin. Reject anything that resolves outside an allowed folder.
- [ ] Run it and see it pass. `pnpm --filter @tabletop/client build`, then confirm `client/dist/art/cast/pip/rig.json` exists and `client/dist/art/runs` doesn't.
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

- Cards: one `PlaneGeometry` per part, in a `Group` at the pivot, mesh offset by `anchor`. `MeshBasicMaterial`, `map` sRGB with mipmaps and anisotropy 4, `alphaToCoverage: true`, `transparent: false`, `side: DoubleSide`, `toneMapped: false`.
- Contact shadow: horizontal `CanvasTexture` ellipse from `stage.shadow`, `rgba(10,8,12,.55)` fading to 0 at 70%, 1 mm above the surface, `depthWrite: false`.
- Lantern glow: a plane at `stage.glow`, radial `rgba(255,214,130,.62)`, `.2` at 45%, 0 at 70%, `AdditiveBlending`, `depthWrite: false`, scaled by `glowScale`.
- [ ] Add a `tests/puppet.test.ts` case that `loadPuppet` rejects when a file 404s (with a stub loader).
- [ ] Implement, typecheck, commit. The visual check is in Task 4, once something can show it.

### Task 4: Placement on the real table

**Files:** Create `client/src/stage/surface.ts` (pure), `client/src/stage/placement-system.ts`. Modify `client/src/index.ts`, `client/index.html`. Test `tests/surface.test.ts`.

**Interfaces:**
- `pickSurface(hits: Vec3[], head: Vec3): Vec3 | null`
- `fallbackSpot(head: Vec3, forward: Vec3): Vec3`
- `keepComfortable(point: Vec3, head: Vec3): Vec3`
- `PlacementSystem`, an IWSDK system that owns a `state: 'searching' | 'fallback' | 'placed'`.

Rules: a hit counts if it's within **0.6 m** horizontally of the head (the design's reach rule, tighter than the spike's 0.8 m), `y > 0.35`, and `y < head.y - 0.1`. Group within 3 cm of height, need at least 3 hits, take the highest group's centroid. `keepComfortable` pushes the point away horizontally until it's at least 0.5 m from the eyes. `fallbackSpot` is 0.55 m ahead, 0.4 m below the head.

The system runs a fan of 12 viewer-space hit-test rays, per frame. A surface must hold within 2 cm for 0.5 s before it locks. After 5 s with none, Pip appears at the fallback, and the first real surface after that moves him once and locks. Pip faces the head at placement (yaw only) and stays put. Each placement sends a `stage_fit` event. Leaving and re-entering the session places him again. `index.html` gets a plain page colour and one line of text, since the real landing page is ticket 1.

- [ ] Write tests: Review Focus 1 and 4 (no hits gives `null`; two hits don't make a group; a shelf above the head and a floor hit are ignored; the highest group wins; beyond 0.6 m is ignored; a surface 0.3 m from the eyes is pushed to 0.5 m).
- [ ] Run, see them fail, implement, see them pass.
- [ ] Wire `loadPuppet` and `PlacementSystem` into `index.ts`. A failed load reports an `error` event and leaves the stage empty (Review Focus 5).
- [ ] Emulator: `pnpm --filter @tabletop/client dev:agent`, enter AR, then confirm with `iwsdk xr status` that the session is active, Pip's root exists at a surface height in the hierarchy, and the pose changes over time. Then one screenshot, checked against the design language's look bar.
- [ ] `pnpm typecheck`, `pnpm test`, commit.

### Task 5: The backend for real

**Files:** Create `backend/src/tokens.ts`, `backend/src/store.ts`, `backend/src/guard.ts`, `backend/src/real-routes.ts`. Modify `backend/src/app.ts`, `backend/src/server.ts`. Test `backend/test/guard.test.ts`, `backend/test/store.test.ts`.

**Interfaces:**
- `issueToken(secret, now): { deviceId, token, expiresAt }` and `verifyToken(secret, token, now): string | null`. HMAC-SHA256 over `deviceId.expiry`, 30 days, compared in constant time.
- `openStore(path): Store`, on `node:sqlite` (`:memory:` in tests). Methods: `countUse(day, scope, feature): number` (increments and returns), `appendEvents`, `readEvents`, `deleteSeries`, `addTelemetry`, `readTelemetry(sinceIso)`.
- `guard(store, config): MiddlewareHandler`, run before any route. `currentDevice(): string`, from `AsyncLocalStorage`.
- `realRoutes(store, secret): Pick<BackendApi, 'issueDevice' | 'memoryAppend' | 'memoryRead' | 'memoryDelete' | 'sendTelemetry'>`. `server.ts` merges these over the mock.

Behaviour:
- `/healthz` and `/v1/device` need no token. Every other `/v1/*` route needs a valid bearer, or it's `unauthorized` (401).
- CORS runs **before** the contract-header check, or preflight fails. Allowed origins: `TT_CLIENT_HOST` and its `*.` subdomains over https. Allowed headers include the contract header and `authorization`.
- Caps, per UTC day, checked before the handler. A hit returns `quota_exceeded` (429): 

| Scope | Default | Env |
|---|---|---|
| Each AI feature, per device | 200 calls | `CAP_DEVICE_FEATURE` |
| Each AI feature, overall | 2,000 calls | `CAP_FEATURE` |
| All AI routes, overall | 5,000 calls | `CAP_GLOBAL` |
| `issueDevice`, overall | 1,000 | `CAP_DEVICES` |

AI routes: `planBeat`, `planSpine`, `reactToObject`, `replyAsCharacter`, `speakLine`, `speechToken`. A failed count must fail closed, so an AI route never runs uncounted.
- Memory is keyed by device and series, so another device's series reads as empty. Append is idempotent on `seq`.
- `GET /admin/telemetry?since=` needs `Authorization: Bearer $TT_ADMIN_TOKEN`, is outside `/v1`, and returns 404 if the token isn't configured.
- `DATA_DIR` picks the database location. Production refuses to start without `TT_TOKEN_SECRET`.

- [ ] Write tests with `app.request()` and `createHttpBackend` pointed at the app: a missing or tampered or expired token is refused; `/v1/device` works without one; an OPTIONS preflight from an allowed origin passes without the contract header, and one from another origin gets no CORS header; the cap returns `quota_exceeded`, surfacing as `BackendError` with that code on a JSON route and as an `error` chunk on a stream; the caps reset the next UTC day; device B can't read device A's series; re-appending a `seq` adds nothing; a batch with an invalid body is `bad_request`.
- [ ] Run, see them fail, implement, see them pass. `tests/repo.test.ts` and existing `backend/test/app.test.ts` stay green.
- [ ] Commit.

### Task 6: Client telemetry and device token

**Files:** Create `client/src/telemetry.ts`. Modify `client/src/backend.ts`. Test `tests/telemetry.test.ts`.

**Interfaces:**
- `getBackend(deps?): Promise<BackendApi | null>`: reads a stored token, and if it's missing or within a day of expiry calls `issueDevice` and stores the result. `null` when the backend can't be reached.
- `createTelemetry(send, clock): Telemetry` with `record(event)`, `frame(deltaMs, renderInfo)`, `flush()`.

Sends a `session` event, a `frame_summary` every 10 s, a `hitch` for any frame over 100 ms, `error` from `window.onerror` and rejected promises, and `stage_fit`. Flushes every 10 s and on `visibilitychange`. Batches stay within the contract's 500-event limit. Nothing here can throw into the frame loop, and nothing is awaited by the stage.

- [ ] Write tests: Review Focus 2 (a rejecting `send` is swallowed and doesn't grow the queue without limit) and 3 (an `unauthorized` reply clears the token and re-issues exactly once); median and low fps from known frame times; a batch over 500 is split.
- [ ] Run, see them fail, implement, see them pass, commit.

### Task 7: CI, hosting and the first deploy

**Files:** Create `.github/workflows/ci.yml`, `railway.json`, `scripts/telemetry-report.ts`. Test `tests/telemetry-report.test.ts`.

- **CI, every push and PR:** `pnpm install --frozen-lockfile`, `pnpm check` (typecheck, tests, bundle key scan). Node from `.nvmrc`.
- **Client, after CI passes on any branch:** `pnpm --filter @tabletop/client build` with `TT_PUBLIC_BACKEND_URL` and `TT_PUBLIC_BUILD_ID`, then `wrangler pages deploy client/dist --project-name tabletop-theater --branch <branch>`. Main is production and each branch gets its preview URL, written to the job summary.
- **Backend, after CI passes on main:** `railway up --service backend --ci`. `railway.json` sets the Node build, `pnpm --filter @tabletop/backend start`, and the `/healthz` health check. One volume at `/data`, `DATA_DIR=/data`. US region.
- **`scripts/telemetry-report.ts`:** reads `/admin/telemetry` and prints per session: device, median and low fps, hitches, errors, placement surface. Reads `TT_ADMIN_TOKEN` from the environment and never prints it.

- [ ] Test the report's summary with fixture events. Write the workflow and `railway.json`. Commit.
- [ ] **Stop for the owner.** Show the estimate (Railway about $7 a month, part or all covered by plan credit; Cloudflare Pages and GitHub Actions free tiers) and get a yes. The owner creates two tokens in the dashboards, since a CLI login can't mint them: a Cloudflare API token with Pages edit, and a Railway project token. They go straight into GitHub secrets (`gh secret set`, values typed by the owner, never through an agent).
- [ ] Create the Pages project and Railway service with the logged-in CLIs. Generate `TT_TOKEN_SECRET` and `TT_ADMIN_TOKEN` with `openssl rand`, written straight to Railway variables and `.env.local` without being displayed. Set `TT_CLIENT_HOST`.
- [ ] Push the branch, which the owner asks for at this step. Confirm CI is green, the preview URL serves `art/cast/pip/rig.json`, and `/healthz` answers from Railway.
- [ ] From this machine, against the live URL: get a token, send a telemetry batch, and read it back with the report. Confirm a request with no token is refused. Temporarily set `CAP_GLOBAL=0` on Railway, confirm `quota_exceeded`, then restore it.
- [ ] Scan the deployed bundle for key shapes, using `scripts/scan-secrets.ts`'s rules.

### Task 8: M0 sign-off

- [ ] Agent checks, all reported with evidence: `pnpm check` green in CI, Pip boots in the emulator, keys absent from the bundle, the cap test from Task 7.
- [ ] Give the owner the preview link, with no USB needed, and a short headset checklist: the link opens and offers AR; Pip lands on the table within a few seconds; is he at the right size (170 mm) and sitting on the surface with a shadow; does he breathe, blink, and does the lantern glow and flicker; how does he hold up walking around to the side; frame rate from telemetry. The test only the owner can pass: **does Pip feel alive in your real room?**
- [ ] Write what the owner says in `docs/playtest-notes.md`. A sign-off unblocks ticket 1.

## Done means

M0 signed off by the owner on the Quest, from a preview link. CI green. Backend live with caps proven. All of this on `ticket-0-foundations`, with a PR when the owner asks.
