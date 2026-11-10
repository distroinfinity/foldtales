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

`.superset/setup.sh` gets a one-condition fix: it checks only the base port before allocating a block, so a taken `base + 1` would produce a workspace whose backend can't start. It will check both.

`tools/ports.ts` reads the workspace's `.env.ports` directly and throws with "run .superset/setup.sh" if the file or the key is missing. It never falls back to a number. It parses the file rather than using `process.loadEnvFile` or `--env-file`, because both let an inherited shell variable win, and one workspace's stray `BACKEND_PORT` would then collide with another's.

The backend's `dev` script passes `--dev`, which reads only the file and ignores any inherited `PORT`. Without `--dev` (production) it requires `PORT`, which Railway sets. The client's dev server proxies `/api` to `BACKEND_PORT`, so client code always calls a relative path and never holds a port.

### Keys

Three layers, the last being the proof:

1. `envPrefix: 'TT_PUBLIC_'` in Vite. Vite also exposes matching variables from the process environment, so moving `envDir` alone would not help on a CI runner. A prefix does. The repo root's `.env.local` is outside the client's `envDir` as well.
2. `contracts/src` and `client/src` may not mention `process.env`, enforced by a repo guard.
3. `scripts/check-bundle.ts` runs a real client build through Vite's API with planted canaries in the environment (`ANTHROPIC_API_KEY`, `VITE_ANTHROPIC_API_KEY`, `RUNWAYML_API_SECRET`, `TT_SECRET_CANARY`). A build-only plugin appends a read of each one through `import.meta.env`, because an empty app that never reads a variable would pass with any prefix. It then scans the output for those values, for every value in the real `.env.local`, and for key shapes (`sk-ant-`, `key_` plus long hex). It prints variable names and file names, never values. It builds to a temporary directory and writes no env file. Running it with `--weaken-prefix` widens the prefix to include `VITE_` and must fail, which proves the check can catch a leak.

### IWSDK scaffold

`client/` holds only: `package.json`, `vite.config.ts`, `tsconfig.json`, `iwsdk.config.json`, `index.html`, `src/{index,assets,components,vite-env.d}.ts`, `public/scenes/main.iwsdk.scene.json`. Empty asset and component registries and a scene with no nodes. Removed from the template: uikit packages, `@iwsdk/reference`, `@meta-quest/metavr` (agents already have the CLI globally), robot, panels, lights.

World config: `ar` mode, `handTracking`, `hitTest`, `anchors` on (Pip needs them next), no grabbing or spatial UI yet, Quest 3 emulator profile. The skills stay at the repo root. A repo guard fails if `client/.claude` or `client/.agents` ever appears, and if any package imports from `spikes/`.

`pnpm dev` runs both servers, with a visible browser. Agents use `pnpm --filter client dev:agent`, which is `iwsdk dev up --headless --no-open`.

### Contracts

Rules that apply to the whole package:

- **Nothing names Pip.** Cast, objects, marks, sets, cues and tags are validated strings. Whether an id exists is checked against a library at runtime, by pure functions. The fixture library in the tests is a made-up cast, so a hard-coded name would fail them.
- **What is code is closed, and what is content is open.** Actions and acting are code in the engine, so they are closed lists. Everything authored is data.
- **Every AI-facing field is required, never optional.** A value is nullable only where absence has a stated meaning, such as `speak.to` for "nobody in particular". The discriminator, the text and the ids it acts on are never null. Length limits the API can't express live in zod, which runs after parsing anyway.
- **Objects are `.strict()`.** A typo in a rig or event should fail, not vanish. The cost is that a new field needs a contract PR, which is the stated rule.
- **`CONTRACT_VERSION` is sent as a header on every call,** because PWA caching makes old-client, new-server real. A mismatch returns `contract_mismatch`, which takes the authored path like any other failure. Because schemas are strict, **any change to a wire shape bumps it, additive or not.** Client and backend ship together, so the only clients affected are stale caches, and those fall back to a complete authored show until they update. Persisted events carry their own `v`, and readers must keep parsing older ones.

#### Stage space

The expensive one to get wrong. Right-handed, y up, origin at the centre of the book's spine on the table, +z toward the host Reader. Units are metres at reference desk size. Each client maps this onto its own surface with one uniform scale, so Story Circle shares the same numbers for different tables. The director never writes coordinates, only marks and targets.

#### Stage actions

A union on `do`. Every member has `withPrev: boolean`, because a linear list can't express "Pip says this while Wick grumbles" and retrofitting concurrency would touch every beat.

**Timing is part of the contract,** so the simulator and the renderer can't disagree. A *group* is one action plus every following action with `withPrev: true`. The first action of a beat must have `withPrev: false`. A group starts together and ends when its longest member ends, and only then does the next group start. Durations: `speak` and `narrate` use `voice[lineId].durationMs`, `emote` uses the acting's `nominalMs`, `move` a nominal 1500 ms, `light` and `wait` their `seconds`, `give`, `use` and `place` a nominal 800 ms, `cue` its `nominalMs` from the library, `ask_reader` until answered or `waitSeconds`, and `music` and `resolve` zero. Preemption stops the beat at once, between frames, and lines not yet started don't count as used.

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

`linesOf(beat)` is the one list of a beat's utterances: `speak` and `ask_reader` under their `who`, and `narrate` under the reserved speaker `narrator`, which no cast member may use as an id.

A **ready beat** is `{ beat, voice: Record<LineId, VoiceAsset> }`. `VoiceAsset` is `{ url: string | null, durationMs }`, where a null url means captions only with an estimated duration. That makes "voice failed, show captions" the same type as success. `checkReady(ready)` reports a line with no asset or a non-positive duration, and a beat with unbound placeholders, so "validated and voiced" is one check.

#### Acting

A closed table of `idle, look, scared, raise, hop, turn, grumble, examine, reach, take, flutter, seek_light`. Each has a `summary` for the director's prompt, `takesTarget`, and `nominalMs` for the simulator. Talking isn't an action, because `speak` drives the mouth. Which character can do what is data: `CastMember.acting`.

#### Beats, spines and problems

- `Beat`: `id, source (authored|director|bridge), sceneId, estSeconds, actions, next, replaces`.
- `Spine`: `v, id, title, premise, source, targetSeconds, scenes, bridges`. The same shape for the flagship and a generated story.
- `Scene`: `id, setId, summary, objects[] {id, defId, origin}, problem, entry, beats`.
- `SceneProblem`: `id, summary, rules[] {id, anyTags, beat, outcome}, fallback {beat}, ignored {beat, afterSeconds}`. `fallback` and `ignored` are required, which puts the PRD's "an authored outcome always exists" and the doing-nothing path into the type.
- `pickProblemRule(problem, tags)` is total, first match wins, and it returns the fallback otherwise. It's here, not in ticket 2, because the show, the simulator and the validator must agree.

**Authored branches bind the gift at runtime.** A rule can't know which copy was handed over, so authored beats may use the placeholders `$offered`, `$receiver` and `$giver` wherever an object, cast or player id goes (`object:$offered`, `who: $receiver`, `player:$giver`). `bindBeat(beat, { offered, receiver, giver })` is a pure function that returns the concrete beat. `checkBeat` rejects placeholders in a director beat, since the director always knows the real ids. This is what lets the offline branch `use` and keep the exact copy a guest brought.

**Progression.** A spine plays its scenes in array order. Each scene starts at `entry` and follows `next` from beat to beat. `next: null` ends the scene, and the end of the last scene ends the episode. A problem's rule, fallback or ignored beat takes over the cursor at that point and continues along its own `next`, so branches can rejoin or end the scene. An `ask_reader` tied to a problem starts the `ignored` timer.

**A director beat stands in for an authored one.** `replaces` names the authored beat it takes the place of, or is null for an extra beat such as a reaction. The cursor moves as if the replaced beat had played. This is what makes the fallback one rule: if no director beat is ready at the deadline, the authored beat at the cursor plays, after at most one bridge. Authored beats have `replaces: null`, director beats have `next: null`.

`checkSpine` walks every path from each `entry` through `next` and all problem branches, and reports a cycle, a dangling reference, or a final scene path that never contains a `resolve`. That makes "the zero-input show ends and resolves" a data check. The time-box is still the simulator's to assert.

#### Objects and tags

- `ObjectDef`: `id, name, description, tags, art, size {heightM}, pivot, provenance (library|live)`. The art agent writes one per object. `history` is *not* on it, as the tech design sketch has it, because it belongs to one copy, not the design.
- **`ShowObject` is one copy on this stage:** `{ id, def: ObjectDef, owner: PlayerId | null, origin: 'set' | 'drawer' | 'satchel', history[] {episodeId, text} }`. Two friends can each bring a kite, and those are two `ShowObject`s with one definition. Everything on stage, every action and every event addresses the `ShowObject` id. The `def` is inline, so a live-painted find or a reloaded log needs no lookup. A satchel is the player's `ShowObject`s with `origin: 'satchel'`.
- `art` is `{ kind: 'asset', path }` or `{ kind: 'url', url }`, so a live-painted find fits without a schema change.
- **Tags are a data file,** `contracts/data/tags.json`: a seed vocabulary with one-line meanings. An object or rule using a tag outside the vocabulary fails `checkLibrary` or `checkSpine`, because a free string `flying` beside a rule for `flies` would silently never match. New tags are a one-line PR. Live objects are checked the same way.
- **The tech design's example tag `light` is renamed `lightweight`.** Beside `glows` and a whole lighting system, `light` is ambiguous, and the object's tags go straight into a prompt.

#### Rigs and cast

`Rig` accepts the three real files as they are: `parts` (with optional `rotation`, `mirrored`), optional `head` (Moth has none), optional `chinShadow`, and optional prose `note` and `rules` (Wick and Moth have no `rules`). Two meanings are pinned in the schema's comments: `mirrored: true` means the part is painted once and the renderer also draws its opposite-side counterpart, and `head.files` is a template in which `<name>` expands to each key of `offsets`. A test loads every `art/cast/*/rig.json` and checks that each referenced file exists and each head offset has an image. It also picks up `art/objects/*/object.json` once those exist.

`CastMember` is new, because nothing in `rig.json` says what a character is: `id, name, description, persona, voice (null means silent), rig, acting, heightM, facing (left|right), anatomy, actingHeads`.

- `facing` is what `prototype.html` calls `flip`, which today exists only in Wick's `note`.
- **`anatomy` connects generic acting to a specific rig:** `{ torso, grip, held, arms[], tail, wings[] }`, each a part name from that character's rig or null, except `grip`. Pip's lantern and arm and Wick's two arms are different part names doing the same job, and this keeps the puppet system from learning either.
- **`grip` is `{ part, at: [x%, y%] }` or null.** A rig's pivots are joints, such as shoulders, not where a paw holds a thing. `at` is a percentage of the part's own image, the same convention as a rig pivot, and it mirrors with the part. The rigs stay unchanged.
- **`actingHeads`** maps an acting id to a head name, such as `scared` for Pip and `grumpy` for Wick.

`checkCastRig(cast, rig)` reports any anatomy or head name the rig doesn't have. A test binds all three real characters against their real rigs. The real cast records are content, and arrive with ticket 1.

`StageLibrary` is `{ version, cast, objects, sets, cues[] {id, summary, nominalMs}, tags }`. `SetDef` is `id, name, description, marks[] {id, label, position}`. Painted layers are left for ticket 1 to add, since its stage kit decides their shape.

`checkLibrary`, `checkBeat(beat, library, objects, scene)` and `checkSpine(spine, library)` return issue lists. They cover references, the timing rule on the first action, and progression. Unknown ids, acting a character lacks and a silent character speaking are all issues. Pacing and repetition are ticket 3's.

#### Events

Every event: `v, id` (client-generated, so reconnect resends are idempotent), `seq` (see below), `seriesId, episodeId, actor` (player, app or director), `showMs` (the scheduler clock, which stops while paused), `at` (wall clock), `type, data`.

`Player` is `{ id, name }`. `entity` is a target limited to `cast:<id>` or `object:<id>`.

| Type | `data` |
|---|---|
| `session.paused` | `reason` (`book_closed`, `ribbon`, `headset_off`, `hands_lost`) |
| `session.resumed` | none |
| `episode.started` | `spine, libraryVersion, objects, players` |
| `episode.ended` | `outcome` (`resolved`, `abandoned`), `durationMs` |
| `beat.queued` | `ready` |
| `beat.started` | `beatId`, `fallback` (`slow`, `failed`, `cap`, `offline`, or null when the planned beat played) |
| `beat.completed` | `beatId` |
| `beat.preempted` | `beatId`, `byEventId` |
| `entity.grabbed` | `entity, playerId` |
| `entity.placed` | `entity, playerId, at` (`Vec3` in stage space) |
| `drawer.opened` | `by` (`beat`, `player`) |
| `drawer.closed` | none |
| `object.added` | `object` |
| `object.handed` | `objectId, toCast, playerId` |
| `object.used` | `objectId, beatId, problemId` (nullable) |
| `object.kept` | `objectId, playerId, history` (the one sentence the app wrote) |
| `problem.attempted` | `problemId, objectId, playerId, ruleId` (null means the fallback) |
| `problem.resolved` | `problemId, outcome, objectId` (null when nothing was given) |
| `talk.heard` | `castId, playerId, text` |
| `canon.recorded` | `entry` |
| `canon.reverted` | `entryId` |
| `page.composed` | `page` |
| `player.joined` | `player` |
| `player.left` | `playerId` |
| `host.changed` | `playerId, resumeBeatId` (nullable) |
| `ownership.granted`, `ownership.released` | `entity, playerId` |
| `speaker.locked` | `playerId, castId` |
| `speaker.unlocked` | `playerId` |
| `fairness.credited` | `playerId, eventId` |

**`seq` is one series-wide counter.** A series has one log and one sequence, from its first solo event onward. Solo, the local log assigns the next number. A Story Circle room plays the host's series and is opened with `startSeq`, the host's last `seq` plus one, and from then on the relay assigns numbers. Guests store the room's events under the host's `seriesId`, so a guest's own series is untouched and its cursor is separate. When the room ends the host's log carries on from where the relay stopped. Memory keeps the numbers it's given, and a duplicate `id` is ignored and returns the existing `seq`.

**What makes a log replayable.** `episode.started` holds `{ spine, libraryVersion, objects: ShowObject[], players }`, so the generated story and every object copy survive a reload or a host promotion. `object.added {object}` covers anything that joins mid-show. `beat.queued` holds the whole ready beat. Per-frame poses never enter the log.

`CanonEntry` is `{ id, kind (cast|relationship|event|keepsake), text, episodeId, sourceEventId }`. `Page` is `{ episodeId, title, text[], art: ArtRef[], keepsakes: ShowObjectId[] }`. Deriving canon is ticket 3's. These shapes are here because events carry them.

#### Telemetry

A batch `{ v, buildId, sessionId, events[] }`. Each event has `at` (ISO time) and a `kind`. Strict, so a transcript has nowhere to go.

| `kind` | Fields |
|---|---|
| `session` | `xrMode` (`ar`, `vr`, `none`), `device`, `passthrough` |
| `frame_summary` | `windowSeconds, medianFps, lowFps, drawCalls, triangles` |
| `hitch` | `ms, phase` |
| `ai_call` | `route` (a route name), `ms`, `outcome` (`ok` or an error code) |
| `beat_gap` | `ms` |
| `fallback` | `reason` (as `beat.started.fallback`), `beatId` |
| `error` | `where, message` |
| `stage_fit` | `surface` (`hit_test`, `plane`, `fallback`), `widthM, scale` |

#### API and mocks

A route table in `contracts/api.ts` gives each call a path, a request schema and a response schema. `BackendApi` is derived from it. All routes are POST with JSON, except that the two streaming replies respond with SSE.

| Call | Route | Request | Response |
|---|---|---|---|
| Device token | `/v1/device` | `{}` | `{ deviceId, token, expiresAt }` |
| Next beat | `/v1/director/beat` | `BeatRequest` | `ReadyBeat` |
| New story spine | `/v1/director/spine` | `{ seriesId, library, objects, canon, premise }` | `Spine` |
| Object reaction | `/v1/objects/react` | `{ objectId, castId, problem, library, objects, canon }` | `ReplyChunk` stream |
| Character reply | `/v1/characters/reply` | `{ castId, playerId, heard, sceneSummary, library, objects, canon, recent }` | `ReplyChunk` stream |
| Live voice | `/v1/voice/line` | `{ speaker, text, mood }` | `VoiceAsset` |
| Speech token | `/v1/speech/token` | `{}` | `{ provider, token, expiresAt }`. Opaque, since the vendor is undecided |
| Memory append | `/v1/memory/append` | `{ seriesId, events }` | `{ lastSeq }`. Idempotent on event `id` |
| Memory read | `/v1/memory/read` | `{ seriesId, afterSeq }` | `{ events }` |
| Memory delete | `/v1/memory/delete` | `{ seriesId }` | `{ deleted }` |
| Telemetry | `/v1/telemetry` | `TelemetryBatch` | `{ accepted }` |

- `BeatRequest` is `{ episodeId, spine, library, objects, position { sceneId, cursor, elapsedSeconds }, show, canon, recent (at most 40 events), trigger, usedLineIds, owedPlayers }`.
- `show` is the durable state of this episode, which the client reduces from its log, so an intervention can't age out of `recent`: `{ problems[] { problemId, status (open|solved|failed|ignored), objectId, ruleId }, holding[] { castId, objectId }, used[] }`.
- `trigger` is `{ kind: 'lookahead' }`, `{ kind: 'gift', objectId, castId, playerId }` or `{ kind: 'talk', castId, playerId, text }`.
- `premise` is `{ kind: 'object', objectId }` or `{ kind: 'spoken', text }`.
- `ReplyChunk` is `delta { text }`, `final { line { who, text, mood }, voice, changesScene }`, `redirect { text }` (moderation's in-story narrator line) or `error { code, message }`. A stream ends with exactly one of the last three. A stream that closes without one counts as `upstream_failed`.

Errors are `{ error: { code, retryable, message } }` with codes `upstream_failed, quota_exceeded, invalid_output, unauthorized, contract_mismatch, moderated, bad_request`, and they throw a `BackendError` in the client.

The request carries the library, rather than the backend holding its own copy, so the backend validates against exactly what this client can stage.

`createMockBackend(options)` from `@tabletop/contracts/mocks` implements `BackendApi` in-process. It's in `contracts`, because the headless simulator and the backend both need it, and the subpath keeps it out of the client bundle. It builds beats from the request's own library. Options: per-route latency, per-route failure (`upstream_failed`, `quota_exceeded`, `invalid_output`, `moderated`), and an injected `sleep`, so the simulator can use a virtual clock. The backend picks a profile from `MOCK_PROFILE` (`normal`, `slow`, `fail`, `cap`).

`createHttpBackend` is the same interface over HTTP. A test runs every route through it against the Hono app, which is what keeps the table, the server and the client honest.

#### Story Circle

Beyond the event fields above, `relay.ts` has the wire messages, a union on `kind`.

| Direction | `kind` | Fields |
|---|---|---|
| Client | `join` | `room, player, afterSeq` (nullable), `startSeq` and `seriesId` (both nullable, used only by the first joiner, who opens the room) |
| Client | `append` | `event` |
| Client | `pose` | `part` (an `entity`, or `head`, `hand_left`, `hand_right`), `position, rotation` (quaternion) |
| Client | `request_grab`, `release_grab` | `entity` |
| Client | `request_speak` | `castId` |
| Client | `release_speak` | none |
| Server | `joined` | `room, hostId, players, lastSeq` |
| Server | `event` | `event` |
| Server | `pose` | `playerId, part, position, rotation` |
| Server | `error` | `code` (`grab_denied`, `speak_denied`, `room_full`, `bad_message`), `message` |

Rooms hold at most four. `createMockRelay()` assigns `seq`, replays from `afterSeq`, grants locks by appending events, and promotes a host on leave. It's in-process only. The WebSocket belongs to ticket 5, but these semantics let bot-Reader tests start early.

### What each later ticket gets

| Consumer | From this ticket |
|---|---|
| Show and simulator | `Spine` with progression and timing rules, `pickProblemRule`, mock with virtual clock and failure injection, events with `showMs` |
| Director | `StageAction` JSON Schema, `ReadyBeat`, `checkBeat`, `lineIdOf`, request shape with used lines and owed players |
| Puppets | `Rig`, `CastMember.heightM/facing/acting/anatomy/actingHeads`, closed acting table |
| Hands and objects | `ObjectDef`, `ShowObject`, `entity.*` and `object.*` events, stage space |
| Memory | Append-only events, `canon.recorded/reverted`, memory routes |
| Story Circle | `seq`, `actor`, idempotent ids, per-copy object ids, replayable `episode.started`, relay messages and mock, `ask_reader.player`, `fairness.credited` |
| Art | `ObjectDef` format, tag vocabulary, a test that checks their files |
| Deploy | Route table to mount middleware on, `PORT`, `BackendApi` to swap real handlers into route by route, telemetry and error shapes, bundle check to run in CI |

## Where I depart from the docs

- **Live painter routes are left out.** The sprint plan says mocks for every backend call, but live art is an "if there's time" item. Adding the route later is additive, and freezing a shape for something unbuilt is how a wrong shape gets frozen.
- **`POST /v1/moderate` is left out.** Moderation happens inside the routes that take user text, and comes back as `redirect` or `moderated`. No client flow needs it standalone.
- **`history` moves off `ObjectDef` onto `ShowObject`,** and `light` becomes `lightweight`, as above.
- **`CastMember` is added** even though the ticket doesn't list it, because the rig can't carry persona, voice or height.

## Testing

| What | How |
|---|---|
| Schemas accept and reject | Vitest in `contracts`, with one valid and one invalid case per action, event, telemetry kind and relay message |
| Real rigs | Loads `art/cast/*/rig.json` and checks referenced files |
| Characters are data | Fixture library with an invented cast passes every check and mock |
| `pickProblemRule` is total | Any tags always yield a branch |
| Progression | `checkSpine` rejects a cycle, a dangling branch and a final path with no `resolve` |
| Object copies | Two players with the same definition stay distinct through `checkBeat`, `bindBeat` and the relay mock, with the mock backend off |
| Sequence | Relay mock: solo log, open at `startSeq`, reconnect from `afterSeq`, a duplicate append returns the same `seq`, then the host continues |
| Cast against rigs | `checkCastRig` binds all three real characters to their real rigs |
| JSON Schema | `stageActionsJsonSchema` has no unsupported keywords |
| Every route, both directions | `createHttpBackend` against the Hono app, with failure profiles |
| Relay mock | Ordering, resume from `afterSeq`, lock grant, host promotion |
| Repo guards | No `spikes/` imports, no `process.env` in client or contracts, no skills in `client` |
| Keys | `pnpm check:bundle` |
| Boot | Emulator run: enter XR, assert `xr status` shows an active session, then console logs, a screenshot and the page's contract marker |
| Side by side | A temporary second worktree set up by `setup.sh`, both workspaces' backends and clients running at once, and each client's `/api` proxy reaching its own backend (stopping one backend fails only that client's proxy), and the allocator skipping a block whose backend port is taken, then removed |

None of this needs the headset. M0 sign-off belongs to Pip on the table.

## Review log

Codex reviewed the first draft. Everything below was accepted, with these notes on how.

| Finding | Outcome |
|---|---|
| API was only route names | Request, response and stream shapes now specified |
| Acting had no link to anatomy | `anatomy` and `actingHeads` added. Kept to six slots |
| Definitions and owned copies conflated | `ShowObject`, with per-copy ids |
| Spine progression undefined, `stepId` dangling | Progression rules, `replaces` instead of `stepId`, path checks in `checkSpine` |
| A ready beat alone doesn't preserve a generated episode | `episode.started` holds the spine and objects, `object.added`, canon and page shapes |
| Strict schemas contradict additive versioning | Any wire change bumps the version |
| `withPrev` ambiguous | Group timing rule and durations |
| Universal nullability | Null only where absence has a stated meaning |
| Key check could disturb local env | No file is written |
| Rig precision | `rules` optional, `mirrored` and `head.files` defined |
| Port allocator hole | Fixed in `setup.sh`, and the side-by-side check covers the proxy |

Codex confirmed the live-art and standalone moderation cuts as reasonable.

A second pass on the revised spec found four more, all accepted. The fixes were small, so no third pass.

| Finding | Outcome |
|---|---|
| Authored branch can't bind the handed-over copy | `$offered`, `$receiver`, `$giver` and `bindBeat` |
| Current-episode state ages out of `recent` | `BeatRequest.show`, and character replies now get canon. Its suggested test of an intervention surviving 40 events needs the ticket 3 reducer, so it belongs there |
| A grip part isn't an attachment point | `grip { part, at }` |
| `seq` scope undefined | One series-wide counter, with `startSeq` opening a room |

Codex then reviewed the plan with this spec. Nine of ten findings were accepted, and they are folded into both files: payload fields for every event, telemetry kind and relay message, `linesOf` and `checkReady`, the production and dev port split, a bundle probe that actually reads the planted variables, a real XR session in the boot check, and sharper side-by-side and allocator checks. One was rejected: it said per-task commits break the `AGENTS.md` rule "commit or push only when asked", but this task's brief explicitly asks for commits to the branch as work goes.
