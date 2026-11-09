# Ticket 0, Repo and contracts: design

Task `t0-repo-contracts`. Read with `docs/prd.md`, `docs/technical-design.md` and ticket 0 in `docs/sprint-plan.md`.

## What this is for

Every workstream that isn't art or voice waits on this. It delivers a pnpm monorepo, the frozen shapes that the director, show simulator, puppets, memory, art and Story Circle will all build on, and a mock for every backend call.

**Done means:** the client boots an empty scene in the IWSDK emulator, the backend runs against the mocks, two workspaces run side by side on their own ports, the contracts have tests, and no key can reach the client bundle.

**Not here:** CI, Railway, Cloudflare, real keys, quotas (Deploy and backend). Hit-test placement and Pip (Pip on the table). Anything in `art/` or audio. The scheduler, validator pacing rules, canon derivation and real relay (later tickets).

## Facts checked before designing

Probed with a throwaway project in the session scratchpad, on Node 24.22 and pnpm 10.30.

| Question | Result | What it decides |
|---|---|---|
| What does `create @iwsdk` emit? | `.claude/`, `.agents/`, `.cursor/`, `.github/`, `.codex/`, `AGENTS.md`, `CLAUDE.md`, a nested `pnpm-workspace.yaml`, robot, panel, plinths | Don't run it inside `client`. Keep an allowlist of its files |
| Does `iwsdk dev` rewrite those agent files? | No. Only `.iwsdk/` appears. `adapter sync` is a separate command | No regeneration risk |
| Two `iwsdk dev up` runtimes at once? | Yes, on separate ports, each with its own socket under `/tmp/iwsdk-501/` | The port file is enough |
| Does the plugin fall back to another port? | No. A configured port is strict and fails if taken | Matches the ticket's warning |
| Can Node run the backend's TypeScript through a pnpm workspace link? | Yes. Node resolves the link's real path, which isn't in `node_modules` | No build step and no `tsx` |
| Does a client build work with overrides at the workspace root, no uikit, and an empty scene document? | Yes | Smaller client |

Claude structured outputs accept `enum`, `const`, `anyOf`, `$ref`. They do not accept numeric or string length constraints. This shapes how stage actions are written.

## Decisions

### Repo

```
client/      IWSDK app, boots an empty AR scene
backend/     Hono on Node, serves the route table from a BackendApi object
contracts/   zod schemas, pure checks, route table, mocks (subpath), data/tags.json
tools/ports.ts   reads .env.ports, shared by vite config and backend dev
tests/repo.test.ts   repo guards
scripts/check-bundle.ts   the key scan
```

- **pnpm workspace with exactly `client`, `backend`, `contracts`.** `spikes/` has its own `package.json` and workspace file, so the globs are explicit. Overrides and the build allowlist live in the root `pnpm-workspace.yaml`, because pnpm ignores package-level overrides in a workspace. `packageManager` is pinned to pnpm 10.30.3. `.nvmrc` and `engines` say Node 24.
- **TypeScript source is the package format.** `contracts` exports `./src/*.ts` and nothing is built. Vite, vitest and Node all read it directly. This needs `erasableSyntaxOnly` and explicit `.ts` import paths in `contracts` and `backend`. *Rejected:* a `tsup` build (adds a stale-output failure mode to the one package everyone depends on) and `tsx` (a dependency that does what Node already does).
- **Backend framework: Hono.** Small, typed, has SSE helpers, and `app.request()` lets every route be tested without a port. *Rejected:* Fastify (more than we need), bare `node:http` (Deploy would rewrite middleware by hand).
- **TypeScript stays on 5.x and Vite on 7.** The IWSDK template pins those and the spike proved them on the device. TypeScript 7 and Vite 8 are out, but moving is a risk with no payoff by Nov 18.
- **No linter or formatter.** `tsc` strict plus tests. Nobody will wish for a lint config this week.

### Ports

`tools/ports.ts` reads the workspace's `.env.ports` directly and throws with "run .superset/setup.sh" if the file or the key is missing. It never falls back to a number. It parses the file rather than using `process.loadEnvFile` or `--env-file`, because both let an inherited shell variable win, and one workspace's stray `BACKEND_PORT` would then collide with another's.

The backend's production entry reads `PORT` first (Railway sets it), then the file. The client's dev server proxies `/api` to `BACKEND_PORT`, so client code always calls a relative path and never holds a port.

### Keys

Three layers, the last being the proof:

1. `envPrefix: 'TT_PUBLIC_'` in Vite. Vite also exposes matching variables from the process environment, so moving `envDir` alone would not help on a CI runner. A prefix does. The repo root's `.env.local` is outside the client's `envDir` as well.
2. `contracts/src` and `client/src` may not mention `process.env`, enforced by a repo guard.
3. `scripts/check-bundle.ts` builds the client with planted canaries in the environment (`ANTHROPIC_API_KEY`, `VITE_ANTHROPIC_API_KEY`, `TT_SECRET_CANARY`) and a planted `client/.env.local` removed afterward, then scans `dist/` for those values, for every value in the real `.env.local`, and for key shapes (`sk-ant-`, `key_` plus long hex). It prints variable names and file names, never values.

### IWSDK scaffold

`client/` holds only: `package.json`, `vite.config.ts`, `tsconfig.json`, `iwsdk.config.json`, `index.html`, `src/{index,assets,components,vite-env.d}.ts`, `public/scenes/main.iwsdk.scene.json`. Empty asset and component registries and a scene with no nodes. Removed from the template: uikit packages, `@iwsdk/reference`, `@meta-quest/metavr` (agents already have the CLI globally), robot, panels, lights.

World config: `ar` mode, `handTracking`, `hitTest`, `anchors` on (Pip needs them next), no grabbing or spatial UI yet, Quest 3 emulator profile. The skills stay at the repo root. A repo guard fails if `client/.claude` or `client/.agents` ever appears, and if any package imports from `spikes/`.

`pnpm dev` runs both servers, with a visible browser. Agents use `pnpm --filter client dev:agent`, which is `iwsdk dev up --headless --no-open`.

### Contracts

Rules that apply to the whole package:

- **Nothing names Pip.** Cast, objects, marks, sets, cues and tags are validated strings. Whether an id exists is checked against a library at runtime, by pure functions. The fixture library in the tests is a made-up cast, so a hard-coded name would fail them.
- **What is code is closed, and what is content is open.** Actions and acting are code in the engine, so they are closed lists. Everything authored is data.
- **All AI-facing fields are required and nullable,** never optional, and carry no length limits the API can't express. Full zod runs after parsing anyway.
- **Objects are `.strict()`.** A typo in a rig or event should fail, not vanish. The cost is that a new field needs a contract PR, which is the stated rule.
- **`CONTRACT_VERSION` is sent as a header on every call.** PWA caching makes old-client, new-server real. A mismatch returns `contract_mismatch`, which takes the authored path like any other failure. Additive changes don't bump it. Persisted events carry their own `v`.

#### Stage space

The expensive one to get wrong. Right-handed, y up, origin at the centre of the book's spine on the table, +z toward the host Reader. Units are metres at reference desk size. Each client maps this onto its own surface with one uniform scale, so Story Circle shares the same numbers for different tables. The director never writes coordinates, only marks and targets.

#### Stage actions

A union on `do`. Every member has `withPrev: boolean`, because a linear list can't express "Pip says this while Wick grumbles" and retrofitting concurrency would touch every beat.

| `do` | Fields |
|---|---|
| `speak` | `who, text, mood, to` |
| `narrate` | `text, mood` |
| `place` | `what` (cast or object ref), `at` (mark) |
| `move` | `who, to` |
| `emote` | `who, acting, target` |
| `give` | `from, to, object` |
| `use` | `who, object, on, problem` |
| `light` | `mood` (`dusk`, `night`, `gold`), `seconds` |
| `music` | `mood` |
| `cue` | `cue, target` |
| `ask_reader` | `who, player, problem, text, mood, opensDrawer, waitSeconds` |
| `wait` | `seconds` |
| `resolve` | `problem, outcome` |

- **`cue` is the escape hatch.** The beam, the relit lamp and page turns are authored effects named in the library, so a new effect doesn't change the contract.
- **`ask_reader.player`** is nullable, for "whoever's there" solo, and names someone in Story Circle, so fairness can be directed.
- **`use` exists** because "used in a beat, so it moves to the satchel" and "every gift acknowledged" both need a marker, and neither can be inferred from dialogue.
- **Targets are prefixed strings:** `reader`, `player:<id>`, `cast:<id>`, `object:<id>`, `mark:<id>`. Compact for the model, simple to check.
- `stageActionsJsonSchema()` exports the union with `anyOf` and stripped constraints, tested against the API's supported keywords. Ticket 3 uses it directly and needn't invent a flatter shape.

#### Lines and voice

`speak` and `narrate` carry text only. **Line identity is a pure function:** `lineIdOf(speaker, text)` hashes the speaker and the normalised text. The pre-render pipeline, the audio lookup and the repetition ledger all compute the same id, and "same words from the same speaker" is exactly what the ledger is meant to block. AI output then needs no id field and is byte-for-byte a stage action.

A **ready beat** is `{ beat, voice: Record<LineId, VoiceAsset> }`. `VoiceAsset` is `{ url: string | null, durationMs }`, where a null url means captions only with an estimated duration. That makes "voice failed, show captions" the same type as success.

#### Acting

A closed table of `idle, look, scared, raise, hop, turn, grumble, examine, reach, take, flutter, seek_light`. Each has a `summary` for the director's prompt, `takesTarget`, and `nominalMs` for the simulator. Talking isn't an action, because `speak` drives the mouth. Which character can do what is data: `CastMember.acting`.

#### Beats, spines and problems

- `Beat`: `id, source (authored|director|bridge), sceneId, estSeconds, actions, next, stepId`.
- `Spine`: `v, id, title, premise, source, targetSeconds, scenes, bridges`. The same shape for the flagship and a generated story.
- `Scene`: `id, setId, summary, problem, entry, beats`.
- `SceneProblem`: `id, summary, rules[] {id, anyTags, beat, outcome}, fallback {beat}, ignored {beat, afterSeconds}`. `fallback` and `ignored` are required, which puts the PRD's "an authored outcome always exists" and the doing-nothing path into the type.
- `pickProblemRule(problem, tags)` is total, first match wins, and it returns the fallback otherwise. It's here, not in ticket 2, because the show, the simulator and the validator must agree.

#### Objects and tags

- `ObjectDef`: `id, name, description, tags, art, size {heightM}, pivot, provenance (library|live)`. The art agent writes one per object. `history` is *not* on it, as the tech design sketch has it, because it's only true of a satchel item.
- `SatchelItem`: `{ object, playerId, history[] {episodeId, text} }`.
- `art` is `{ kind: 'asset', path }` or `{ kind: 'url', url }`, so a live-painted find fits without a schema change.
- **Tags are a data file,** `contracts/data/tags.json`: a seed vocabulary with one-line meanings. An object or rule using a tag outside the vocabulary fails `checkLibrary` or `checkSpine`, because a free string `flying` beside a rule for `flies` would silently never match. New tags are a one-line PR. Live objects are checked the same way.
- **The tech design's example tag `light` is renamed `lightweight`.** Beside `glows` and a whole lighting system, `light` is ambiguous, and the object's tags go straight into a prompt.

#### Rigs and cast

`Rig` accepts the three real files as they are: `parts` (with optional `rotation`, `mirrored`), optional `head` (Moth has none), optional `chinShadow`, and prose `note` and `rules`. A test loads every `art/cast/*/rig.json` and checks that each referenced file exists and each head offset has an image. It also picks up `art/objects/*/object.json` once those exist.

`CastMember` is new, because nothing in `rig.json` says what a character is: `id, name, description, persona, voice (null means silent), rig, acting, heightM, facing (left|right)`. `facing` is what `prototype.html` calls `flip`, which today exists only in Wick's `note`. The director, Characters and the puppet system all read it.

`StageLibrary` is `{ cast, objects, sets, cues, tags }`. `SetDef` is `id, name, description, marks[] {id, label, position}`. Painted layers are left for ticket 1 to add, since its stage kit decides their shape.

`checkLibrary`, `checkBeat(beat, library, scene)` and `checkSpine(spine, library)` return issue lists. They cover references only: unknown ids, acting a character lacks, a silent character speaking. Pacing and repetition are ticket 3's.

#### Events

Every event: `v, id` (client-generated, so reconnect resends are idempotent), `seq` (null until ordered: the server assigns it in Story Circle, the local log does solo), `seriesId, episodeId, actor` (player, app or director), `showMs` (the scheduler clock, which stops while paused), `at` (wall clock), `type, data`.

| Group | Types |
|---|---|
| Session | `session.paused {reason}`, `session.resumed` |
| Episode | `episode.started`, `episode.ended` |
| Beat | `beat.queued {ready}`, `beat.started {beatId, fallback}`, `beat.completed`, `beat.preempted` |
| Reach | `entity.grabbed`, `entity.placed {at}`, `drawer.opened`, `drawer.closed` |
| Objects | `object.handed {objectId, toCast}`, `object.used`, `object.kept {history}` |
| Story | `problem.attempted {problemId, objectId, ruleId}`, `problem.resolved`, `talk.heard {castId, text}` |
| Canon | `canon.recorded {entry}`, `canon.reverted {entryId}`, `page.composed {page}` |
| Circle | `player.joined`, `player.left`, `host.changed`, `ownership.granted`, `ownership.released`, `speaker.locked`, `speaker.unlocked`, `fairness.credited` |

`beat.queued` holds the whole ready beat. Without it a reload can't replay a generated beat and a promoted host can't continue. Per-frame poses never enter the log.

#### Telemetry

A batch `{ v, buildId, sessionId, events[] }` of `frame_summary`, `hitch`, `ai_call`, `beat_gap`, `fallback`, `error`, `session`, `stage_fit`. Strict, so a transcript has nowhere to go.

#### API and mocks

A route table in `contracts/api.ts` gives each call a path, a request schema and a response schema. `BackendApi` is derived from it. All routes are POST with JSON, except the two streaming replies, which respond with SSE.

| Call | Route | Notes |
|---|---|---|
| Device token | `/v1/device` | Mock issues anything |
| Next beat | `/v1/director/beat` | Request: spine, library, position, canon, satchel, recent events, trigger, used line ids, owed players |
| New story spine | `/v1/director/spine` | Tonight's lost thing |
| Object reaction | `/v1/objects/react` | Stream |
| Character reply | `/v1/characters/reply` | Stream |
| Live voice | `/v1/voice/line` | Returns `VoiceAsset` |
| Speech token | `/v1/speech/token` | Opaque, since the vendor is undecided |
| Memory append, read, delete | `/v1/memory/*` | Events only, canon is derived |
| Telemetry | `/v1/telemetry` | |

Errors are `{ error: { code, retryable, message } }` with codes `upstream_failed, quota_exceeded, invalid_output, unauthorized, contract_mismatch, moderated`, and they throw a `BackendError` in the client. Stream chunks are `delta`, `final`, `redirect` (moderation's in-story narrator line) and `error`.

The request carries the library, rather than the backend holding its own copy, so the backend validates against exactly what this client can stage.

`createMockBackend(options)` from `@tabletop/contracts/mocks` implements `BackendApi` in-process. It's in `contracts`, because the headless simulator and the backend both need it, and the subpath keeps it out of the client bundle. It builds beats from the request's own library. Options: per-route latency, per-route failure (`upstream_failed`, `quota_exceeded`, `invalid_output`, `moderated`), and an injected `sleep`, so the simulator can use a virtual clock. The backend picks a profile from `MOCK_PROFILE` (`normal`, `slow`, `fail`, `cap`).

`createHttpBackend` is the same interface over HTTP. A test runs every route through it against the Hono app, which is what keeps the table, the server and the client honest.

#### Story Circle

Beyond the event fields above, `relay.ts` has the wire messages: client sends `join {room, player, afterSeq}`, `append`, `pose`, `request_grab`, `release_grab`, `request_speak`, `release_speak`. Server sends `joined`, `event`, `pose`, `error`. `createMockRelay()` assigns `seq`, replays from `afterSeq`, grants locks by appending events, and promotes a host on leave. It's in-process only. The WebSocket belongs to ticket 5, but these semantics let bot-Reader tests start early.

### What each later ticket gets

| Consumer | From this ticket |
|---|---|
| Show and simulator | `Spine`, `pickProblemRule`, mock with virtual clock and failure injection, events with `showMs` |
| Director | `StageAction` JSON Schema, `ReadyBeat`, `checkBeat`, `lineIdOf`, request shape with used lines and owed players |
| Puppets | `Rig`, `CastMember.heightM/facing/acting`, closed acting table |
| Hands and objects | `ObjectDef`, `entity.*` and `object.*` events, stage space |
| Memory | Append-only events, `canon.recorded/reverted`, memory routes |
| Story Circle | `seq`, `actor`, idempotent ids, relay messages and mock, `ask_reader.player`, `fairness.credited` |
| Art | `ObjectDef` format, tag vocabulary, a test that checks their files |
| Deploy | Route table to mount middleware on, `PORT`, `BackendApi` to swap real handlers into route by route, telemetry and error shapes, bundle check to run in CI |

## Where I depart from the docs

- **Live painter routes are left out.** The sprint plan says mocks for every backend call, but live art is an "if there's time" item. Adding the route later is additive, and freezing a shape for something unbuilt is how a wrong shape gets frozen.
- **`POST /v1/moderate` is left out.** Moderation happens inside the routes that take user text, and comes back as `redirect` or `moderated`. No client flow needs it standalone.
- **`history` moves off `ObjectDef`,** and `light` becomes `lightweight`, as above.
- **`CastMember` is added** even though the ticket doesn't list it, because the rig can't carry persona, voice or height.

## Testing

| What | How |
|---|---|
| Schemas accept and reject | Vitest in `contracts`, with one valid and one invalid case per action and event |
| Real rigs | Loads `art/cast/*/rig.json` and checks referenced files |
| Characters are data | Fixture library with an invented cast passes every check and mock |
| `pickProblemRule` is total | Any tags always yield a branch |
| JSON Schema | `stageActionsJsonSchema` has no unsupported keywords |
| Every route, both directions | `createHttpBackend` against the Hono app, with failure profiles |
| Relay mock | Ordering, resume from `afterSeq`, lock grant, host promotion |
| Repo guards | No `spikes/` imports, no `process.env` in client or contracts, no skills in `client` |
| Keys | `pnpm check:bundle` |
| Boot | Emulator run with `iwsdk browser logs` and a screenshot, plus a check that the page set its contract marker |
| Side by side | A temporary second worktree running both servers at once, then removed |

None of this needs the headset. M0 sign-off belongs to Pip on the table.
