# Repo and contracts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A pnpm monorepo with `client`, `backend` and `contracts`, the frozen shared contracts, and a mock for every backend call.

**Architecture:** `contracts` is TypeScript source consumed directly by Vite, vitest and Node, with no build. `backend` is a Hono app that mounts a route table over a `BackendApi` object, which is the mock for now. `client` is the smallest IWSDK app that boots an empty AR scene.

**Tech Stack:** Node 24, pnpm 10.30.3, TypeScript 5.9, zod 4, Hono 4, vitest (4.x, the line that supports Vite 7), Vite 7, IWSDK 1.1.0-rc.2.

**Spec:** `docs/superpowers/specs/2026-11-09-repo-and-contracts-design.md`. Executors read it first. Field lists there are normative and are not repeated here.

## Global Constraints

- Node 24 (`.nvmrc`, `engines`). `packageManager: pnpm@10.30.3`. Workspace globs are exactly `client`, `backend`, `contracts`.
- `contracts` and `backend` use `erasableSyntaxOnly` and explicit `.ts` import paths.
- Never import from `spikes/`. Never touch `art/` or audio. Never publish to Claude artifacts or Docs.
- Never print, copy or commit a key. Do not open `.env.local` except through `scripts/check-bundle.ts`, which reads values without printing them.
- No port number is hard-coded anywhere. Dev servers read `CLIENT_PORT` and `BACKEND_PORT` from `.env.ports`.
- No name from the flagship cast appears in `contracts/src`, `backend/src` or `client/src`.
- Nothing on the Quest. Emulator only.
- Commit on this branch after each task. Do not push, merge or open a PR.

## Review Focus

1. `.env.ports` missing, or missing a key: dev servers stop with "run .superset/setup.sh", never pick a number. (Task 1)
2. A reply stream that closes with no terminal chunk, or a network failure mid-stream: the caller gets one `upstream_failed` error chunk, never a hang or a throw. (Task 6)
3. A request with no contract header, an old one, or a body that isn't valid JSON: a typed error body with the right status, never a 500. (Task 8)
4. A server response that doesn't match the schema: the client throws `invalid_output` rather than passing bad data to the show. (Task 6)
5. A client production build where `.env.ports` doesn't exist, as on a CDN builder: the build succeeds. (Task 9)

---

## File map

| Path | Responsibility |
|---|---|
| `package.json`, `pnpm-workspace.yaml`, `.nvmrc`, `tsconfig.json`, `tsconfig.base.json`, `vitest.config.ts` | Root tooling |
| `tools/ports.ts` | Reads `.env.ports` |
| `scripts/scan-secrets.ts`, `scripts/check-bundle.ts` | Key scan, and the build that feeds it |
| `tests/repo.test.ts`, `tests/ports.test.ts`, `tests/scan-secrets.test.ts` | Repo guards and tool tests |
| `contracts/src/version.ts` | `CONTRACT_VERSION` |
| `contracts/src/primitives.ts` | Ids, targets, moods, `Vec3`, `Issue` |
| `contracts/src/acting.ts` | Acting table |
| `contracts/src/stage-actions.ts` | `StageAction`, JSON Schema export |
| `contracts/src/objects.ts` | `ObjectDef`, `ShowObject`, `ArtRef`, tags |
| `contracts/src/rig.ts` | `Rig` |
| `contracts/src/library.ts` | `CastMember`, `SetDef`, `StageLibrary`, `checkLibrary`, `checkCastRig` |
| `contracts/src/beats.ts` | `Beat`, `Scene`, `Spine`, `ReadyBeat`, `VoiceAsset`, `lineIdOf`, `estimateSpeechMs`, `pickProblemRule`, `bindBeat`, `checkBeat`, `checkSpine` |
| `contracts/src/events.ts` | `CanonEntry`, `Page`, `ShowEvent` |
| `contracts/src/telemetry.ts` | `TelemetryBatch` |
| `contracts/src/relay.ts` | Relay wire messages |
| `contracts/src/api.ts` | Route table, `BackendApi`, `BackendError`, `ReplyChunk`, `createHttpBackend` |
| `contracts/src/index.ts` | Barrel |
| `contracts/src/mocks/{index,backend,relay,fixtures}.ts` | Mocks, exported as `@tabletop/contracts/mocks` |
| `contracts/data/tags.json` | Seed tag vocabulary |
| `backend/src/app.ts`, `backend/src/server.ts` | `createApp(api)`, process entry |
| `client/…` | The allowlist in the spec, plus `src/backend.ts` |

---

### Task 1: Workspace and ports

**Files:** Create the root tooling above, `tools/ports.ts`, `tests/ports.test.ts`, and empty package manifests for `contracts` and `backend`. Modify `.gitignore`, `.superset/setup.sh:60`.

**Interfaces:**
- Produces: `readPorts(file?: string): { CLIENT_PORT: number; BACKEND_PORT: number }`. Package names `@tabletop/contracts`, `@tabletop/backend`, `@tabletop/client`. Root scripts `dev`, `test`, `typecheck`, `check:bundle`, `check`.

- [ ] **Step 1: Write the root files.** `pnpm-workspace.yaml` carries `packages: [client, backend, contracts]`, overrides `sharp: 0.35.4` and `three: npm:super-three@0.185.0`, `onlyBuiltDependencies: [esbuild, protobufjs, sharp]`, `ignoredBuiltDependencies: [onnxruntime-node]`. Root scripts: `dev` is `pnpm --parallel --filter @tabletop/backend --filter @tabletop/client dev`, `test` is `vitest run`, `typecheck` is `pnpm -r typecheck && tsc -p .`, `check:bundle` is `node scripts/check-bundle.ts`, `check` runs the three. `.gitignore` adds `node_modules/`, `.iwsdk/`, `*.tsbuildinfo`, `coverage/`. `vitest.config.ts` includes `contracts/test/**/*.test.ts`, `backend/test/**/*.test.ts`, `tests/**/*.test.ts`.

- [ ] **Step 2: Write `tests/ports.test.ts`**

```ts
test('reads both ports from the file', () => { /* temp file 'PORT_BASE=6100\nCLIENT_PORT=6100\nBACKEND_PORT=6101\n' */
  expect(readPorts(file)).toEqual({ CLIENT_PORT: 6100, BACKEND_PORT: 6101 }); });
test('an inherited environment variable does not win', () => { process.env.BACKEND_PORT = '1'; expect(readPorts(file).BACKEND_PORT).toBe(6101); });
test('a missing file throws and names setup.sh', () => expect(() => readPorts('/nope')).toThrow(/\.superset\/setup\.sh/));
test('a missing key throws and names setup.sh', () => /* file with only CLIENT_PORT */ expect(() => readPorts(file)).toThrow(/\.superset\/setup\.sh/));
test('a non-numeric port throws', () => /* BACKEND_PORT=abc */ expect(() => readPorts(file)).toThrow(/BACKEND_PORT/));
```

- [ ] **Step 3: Run it and see it fail.** `pnpm install && pnpm vitest run tests/ports.test.ts`. Expected: fails, no `tools/ports.ts`.

- [ ] **Step 4: Implement `readPorts`.** The default path is resolved from `import.meta.url` to the repo root's `.env.ports`.

- [ ] **Step 5: Fix `.superset/setup.sh`.** The allocator's `while` also tests `lsof -nP -iTCP:"$((base + 1))" -sTCP:LISTEN`.

- [ ] **Step 6: Run.** `pnpm vitest run tests/ports.test.ts`. Expected: 5 pass. `bash -n .superset/setup.sh` exits 0.

- [ ] **Step 7: Commit** with the lockfile. Message: "Set up the workspace and port reading".

---

### Task 2: Primitives, acting and stage actions

**Files:** Create `contracts/src/{version,primitives,acting,stage-actions,index}.ts`, `contracts/test/stage-actions.test.ts`, `contracts/tsconfig.json`. Add `zod` and the `exports` map (`.`, `./mocks`, `./version`).

**Interfaces:**
- Produces: `CONTRACT_VERSION = 1`. `Id` (`/^[a-z][a-z0-9_-]*(#[a-z0-9_-]+)?$/`). Placeholder-aware `CastRef`, `ObjectRef`. `Target` (`reader`, or `player:`, `cast:`, `object:`, `mark:` followed by an id or placeholder). `Mood` (`neutral, warm, tense, wonder, silly, sad, relief`). `LightMood` (`dusk, night, gold`). `Vec3`. `type Issue = { code: string; path: string; message: string }`. `ACTING` (spec's twelve ids, each `{ summary, takesTarget, nominalMs }`), `ActingId`. `StageAction` as a `z.discriminatedUnion('do', …)` of the spec's thirteen members, `.strict()`. `stageActionsJsonSchema(): object`.

- [ ] **Step 1: Write the failing tests.** One accepted example and one rejected example per `do`.

```ts
test.each(validActions)('$do accepts', (a) => expect(StageAction.safeParse(a).success).toBe(true));
test('unknown do is rejected', …);
test('unknown field is rejected (strict)', …);
test('speak with null who is rejected', …);
test('speak with null to is accepted', …);
test('acting outside the table is rejected', () => /* acting: 'somersault' */);
test('a coordinate on move is rejected', () => /* to: [0,0,0] */);
test('placeholders parse: object:$offered, who $receiver, player:$giver', …);

const FORBIDDEN = ['oneOf','minimum','maximum','exclusiveMinimum','exclusiveMaximum','multipleOf','minLength','maxLength','pattern'];
test('the JSON Schema uses only what structured outputs accept', () => {
  walk(stageActionsJsonSchema(), (node) => {
    for (const k of FORBIDDEN) expect(node).not.toHaveProperty(k);
    if (node.type === 'object') expect(node.additionalProperties).toBe(false);
    if (node.type === 'array') expect(node.minItems ?? 0).toBeLessThanOrEqual(1);
  });
});
```

- [ ] **Step 2: Run and see it fail.** `pnpm vitest run contracts/test/stage-actions.test.ts`.

- [ ] **Step 3: Implement.** Text limit 240 characters, `seconds` 0 to 30, `waitSeconds` 1 to 30, array at most 40 actions. `stageActionsJsonSchema` runs `z.toJSONSchema(z.array(StageAction))`, renames `oneOf` to `anyOf`, and strips the forbidden keywords. Durations in the spec's timing rule go in a comment beside `withPrev`, plus exported `MOVE_MS = 1500` and `HANDLING_MS = 800`.

- [ ] **Step 4: Run.** Expected: all pass. Commit: "Add stage actions and the acting list".

---

### Task 3: Objects, rigs and library

**Files:** Create `contracts/data/tags.json`, `contracts/src/{objects,rig,library}.ts`, `contracts/test/{rig,library}.test.ts`, `contracts/src/mocks/fixtures.ts`.

**Interfaces:**
- Consumes: Task 2 primitives.
- Produces: `ArtRef`, `ObjectDef`, `ShowObject`, `TagDef { id, meaning }`, `TAG_VOCABULARY`. `Rig`. `CastMember` (with `anatomy`, `grip { part, at }`, `actingHeads`), `SetDef`, `Cue`, `StageLibrary`. `checkLibrary(lib): Issue[]`. `checkCastRig(cast, rig): Issue[]`. `fixtureLibrary(): StageLibrary`, with an invented speaking hedgehog `bramble`, an invented silent `quill`, set `glade` with marks `stump` and `brook`, objects `tin-whistle` (tag `makes-sound`) and `string` (tags `ties`, `rope`), cue `sparkle`, and the tag vocabulary.

- [ ] **Step 1: Write `tags.json`.** Ids: `flies, floats, climbs, spans, rope, ties, cuts, digs, pushes, carries, holds-water, soft, warm, glows, makes-sound, sticky, heavy, lightweight, fragile, catches-wind, bends, opens, shiny, edible, rolls`. A one-line meaning each.

- [ ] **Step 2: Write the failing tests.**

```ts
// rig.test.ts, against the real files
test.each(['pip','wick','moth'])('%s rig parses', …Rig.parse(JSON.parse(readFileSync(`art/cast/${who}/rig.json`))));
test.each(casts)('%s referenced files exist', …); // every parts[].file and heads/<offset key>.png
test('a typo in a part is rejected', () => /* pviot */);
test('art/objects/*/object.json parse when present', …); // globs, passes vacuously today

const BINDINGS = { // test data only, the real records arrive with ticket 1
  pip:  { torso:'coat', grip:{part:'arm',at:[50,90]}, held:'lantern', arms:['arm'], tail:'tail', wings:[] },
  wick: { torso:'body', grip:{part:'armRight',at:[50,90]}, held:'logbook', arms:['armLeft','armRight'], tail:'tail', wings:[] },
  moth: { torso:'body', grip:null, held:null, arms:[], tail:null, wings:['lowerWing','upperWing'] },
};
test.each(entries(BINDINGS))('%s binds to its rig', (who, anatomy) => expect(checkCastRig(castFor(who, anatomy), rigOf(who))).toEqual([]));
test('anatomy naming a part the rig lacks is an issue', …);
test('actingHeads naming a head the rig lacks is an issue', …);

// library.test.ts
test('the fixture library is clean', () => expect(checkLibrary(fixtureLibrary())).toEqual([]));
test('an object tag outside the vocabulary is an issue', …);
test('duplicate cast, object, set or cue ids are issues', …);
test('history is rejected on ObjectDef', …);
test('two ShowObjects can share one def', …);
test('art accepts asset and url forms', …);
```

- [ ] **Step 3: Run and see it fail.**

- [ ] **Step 4: Implement.** Comment the two meanings the spec pins on `mirrored` and `head.files`. `at` and `pivot` are `[0..100, 0..100]`.

- [ ] **Step 5: Run.** Expected: all pass. Commit: "Add objects, rigs and the stage library".

---

### Task 4: Beats, spines and their checks

**Files:** Create `contracts/src/beats.ts`, `contracts/test/beats.test.ts`.

**Interfaces:**
- Consumes: Tasks 2 and 3.
- Produces: `Beat`, `SceneProblem`, `Scene`, `Spine`, `VoiceAsset`, `ReadyBeat`, `LineId`. `lineIdOf(speaker: string, text: string): LineId`. `NARRATOR = 'narrator'`. `linesOf(beat): { speaker: string; text: string; lineId: LineId }[]`. `checkReady(ready: ReadyBeat): Issue[]`. `estimateSpeechMs(text: string): number` (60 ms a character, minimum 800). `pickProblemRule(problem, tags): { kind:'rule', rule } | { kind:'fallback', beat }`. `bindBeat(beat, { offered, receiver, giver }): Beat`. `checkBeat(beat, library, objects, scene): Issue[]`. `checkSpine(spine, library): Issue[]`. Also add `fixtureSpine(): Spine` to `mocks/fixtures.ts`, one scene with an `ask_reader` entry, a tag rule, a fallback and an ignored beat, each ending in `resolve`.

- [ ] **Step 1: Write the failing tests.**

```ts
test('lineIdOf ignores case, punctuation and spacing', () => expect(lineIdOf('a','Hello, there!')).toBe(lineIdOf('a',' hello   there')));
test('lineIdOf differs by speaker and by words', …);
test('lineIdOf treats leading and trailing space as nothing', …);
test('lineIdOf is stable across unicode forms', () => /* café in NFC and NFD */);

test('linesOf covers speak, ask_reader and narrate under narrator', …);
test('checkReady passes a captions-only asset with a duration', …);
test.each([['a missing asset', 'missing_voice'], ['a zero duration', 'bad_duration'], ['an unbound placeholder', 'unbound_placeholder']])('checkReady: %s', …);
test('a cast member named narrator is a checkLibrary issue', …);  // add to Task 3's checkLibrary

test('first matching rule wins', …);
test('no match returns the fallback', …);
test('empty tags return the fallback', …);
test('any generated tag list yields a branch', () => /* 200 random tag lists */);

test('bindBeat replaces every placeholder', …);  // object:$offered, who:$receiver, player:$giver
test('bindBeat throws when a needed binding is null', …);
test('bindBeat leaves other ids alone and does not mutate', …);
test('two copies of one def bind to distinct beats', …);

test('the fixture spine is clean', () => expect(checkSpine(fixtureSpine(), fixtureLibrary())).toEqual([]));
test.each([
  ['first action withPrev true', …, 'first_with_prev'],
  ['unknown cast', …, 'unknown_cast'],
  ['acting the character lacks', …, 'acting_unavailable'],
  ['silent character speaks', …, 'silent_speaker'],
  ['unknown object copy', …, 'unknown_object'],
  ['unknown mark', …, 'unknown_mark'],
  ['unknown cue', …, 'unknown_cue'],
  ['resolve on another scene problem', …, 'unknown_problem'],
  ['placeholder in a director beat', …, 'placeholder_in_director'],
])('checkBeat: %s', …);
test.each([
  ['next cycle', …, 'cycle'],
  ['dangling next', …, 'unknown_beat'],
  ['dangling rule beat', …, 'unknown_beat'],
  ['final path without resolve', …, 'unresolved_path'],
  ['a tag outside the vocabulary in a rule', …, 'unknown_tag'],
  ['a problem nothing asks about', …, 'problem_never_asked'],
  ['a director-source beat in a spine', …, 'director_in_spine'],
  ['unknown set', …, 'unknown_set'],
  ['scene object with an unknown def', …, 'unknown_object_def'],
])('checkSpine: %s', …);
```

- [ ] **Step 2: Run and see it fail.**

- [ ] **Step 3: Implement.** `lineIdOf`: NFKC, lowercase, remove `[^\p{L}\p{N}\s]`, collapse whitespace, trim, then `line_` plus cyrb53 of `speaker + '\0' + text` in base 36. `checkSpine`'s successors of a beat are `next` when non-null, plus every rule, fallback and ignored beat when the beat has an `ask_reader` for the scene's problem. A depth-first walk with colours finds cycles. `resolves(beat)` is true if the beat has a `resolve` action, or it has successors and all of them resolve, memoised.

- [ ] **Step 4: Run.** Expected: all pass. Commit: "Add beats, spines and their checks".

---

### Task 5: Events, telemetry and relay messages

**Files:** Create `contracts/src/{events,telemetry,relay}.ts`, `contracts/test/{events,telemetry}.test.ts`. Modify `contracts/src/index.ts`.

**Interfaces:**
- Consumes: Tasks 2 to 4.
- Produces: `CanonEntry`, `Page`, `ShowEvent` (`z.discriminatedUnion('type', …)` over the spec's envelope and event table, `v: 1`), `TelemetryBatch`, `RelayClientMessage`, `RelayServerMessage`.

- [ ] **Step 1: Write the failing tests.** One accepted example and one malformed payload per event `type`, per telemetry `kind` and per relay `kind`, driven from tables so a new variant without both fails.

```ts
test('every event type has a valid and an invalid example', () => { expect(new Set(valid.map(e=>e.type))).toEqual(new Set(eventTypes)); expect(new Set(invalid.map(e=>e.type))).toEqual(new Set(eventTypes)); });
test.each(valid)('$type accepts', …); test.each(invalid)('$type rejects a malformed payload', …);
test.each(relayValid)('relay $kind accepts', …); test.each(relayInvalid)('relay $kind rejects', …);
test('a null seq is accepted, a negative one is not', …);
test('episode.started needs the spine and the objects', …);
test('beat.queued needs a whole ready beat', …);
test('an unknown type is rejected', …);
test('a telemetry field not in the schema is rejected', () => /* transcript: 'hello' on ai_call */);
```

- [ ] **Step 2: Run and see it fail.**

- [ ] **Step 3: Implement** from the spec's tables. Export `eventTypes` from `events.ts`.

- [ ] **Step 4: Run.** Expected: all pass. Commit: "Add events, telemetry and relay messages".

---

### Task 6: API contract and HTTP client

**Files:** Create `contracts/src/api.ts`, `contracts/test/api.test.ts`. Modify `contracts/src/index.ts`.

**Interfaces:**
- Consumes: Tasks 3 to 5.
- Produces: `routes`, keyed `issueDevice, planBeat, planSpine, reactToObject, replyAsCharacter, speakLine, speechToken, memoryAppend, memoryRead, memoryDelete, sendTelemetry`, each `{ path, request, response }` or `{ path, request, stream: true }`. `RouteName`. `BackendApi` derived from `routes`. `ErrorCode` (the spec's six plus `bad_request`). `ErrorBody`. `class BackendError extends Error { code; retryable }`. `ReplyChunk`, `BeatRequest`, and `isTerminal(chunk)`. `CONTRACT_HEADER = 'x-tabletop-contract'`. `createHttpBackend({ baseUrl, token?, fetch? }): BackendApi`.

- [ ] **Step 1: Write the failing tests** against an injected `fetch`.

```ts
test('sends the contract header and the bearer token', …);
test('a typed error body throws BackendError with its code', …);
test('a response that fails the schema throws invalid_output', …);
test('a network failure throws upstream_failed, retryable', …);
test('a non-JSON error body throws upstream_failed', …);
test('a stream yields deltas then its terminal chunk', …);
test('a stream that closes with no terminal chunk yields one upstream_failed error chunk', …);
test('a network failure mid-stream yields one upstream_failed error chunk', …);
test('a typed HTTP error on a stream route yields one error chunk with that code', …);
test('a malformed SSE line yields one invalid_output error chunk', …);
test('every route path is unique and starts with /v1/', …);
```

- [ ] **Step 2: Run and see it fail.**

- [ ] **Step 3: Implement.** Streaming methods are `async function*` and never throw. SSE parsing splits on blank lines and reads `data:` lines. Add a note in `api.ts` that a change to any wire shape bumps `CONTRACT_VERSION`.

- [ ] **Step 4: Run.** Expected: all pass. Commit: "Add the API contract and HTTP client".

---

### Task 7: Mocks

**Files:** Create `contracts/src/mocks/{backend,relay,index}.ts`, `contracts/test/{mock-backend,mock-relay}.test.ts`.

**Interfaces:**
- Consumes: Tasks 3 to 6.
- Produces: `createMockBackend(options?: MockOptions): BackendApi`, where `MockOptions = { latencyMs?: number | Partial<Record<RouteName, number>>; failure?: Partial<Record<RouteName, MockFailure>>; sleep?: (ms: number) => Promise<void> }` and `MockFailure = 'upstream_failed' | 'quota_exceeded' | 'invalid_output' | 'moderated'`. `MOCK_PROFILES: Record<'normal'|'slow'|'fail'|'cap', MockOptions>`. `createMockRelay(): { connect(onMessage): { send(msg): void; close(): void } }`.

- [ ] **Step 1: Write the failing tests.**

```ts
test('planBeat builds a beat from the request library alone', async () => {
  const { beat, voice } = await mock.planBeat(requestWith(fixtureLibrary()));
  expect(checkBeat(beat, fixtureLibrary(), req.objects, scene)).toEqual([]);
  expect(Object.keys(voice)).toContain(lineIdOf('bramble', spokenText(beat))); });
test('planBeat with another library uses that library', …);
test('planBeat never returns a line in usedLineIds', …);
test('planBeat sets replaces to the cursor on lookahead', …);
test('a gift trigger uses the offered copy', …);
test('every voice asset is captions-only with an estimated duration', …);
test('planSpine returns a spine that passes checkSpine', …);
test('react and reply end with one final chunk', …);
test.each(routeNames)('%s honours latency through the injected sleep', …);
test.each(routeNames)('%s honours quota_exceeded', …);        // BackendError, or error chunk on stream routes
test('invalid_output on planBeat returns a beat checkBeat rejects', …);
test('moderated on a reply yields a redirect chunk', …);
test('memory append is idempotent on id and keeps seq', …);
test('memory read honours afterSeq, delete empties it', …);

// relay
test('the first joiner opens the room at startSeq and events count up from it', …);
test('every member receives events in the same order', …);
test('a reconnect with afterSeq replays only later events', …);
test('a duplicate append returns the existing seq and is not re-broadcast', …);
test('solo log, room, then the host continues from the relay seq', …);
test('two grabs on one copy: first gets ownership.granted, second gets an error', …);
test('two players with same-def copies can hold them at once', …);
test('speaker lock is exclusive and released on leave', …);
test('host leaving promotes another member with host.changed', …);
test('pose messages reach others and are not logged', …);
```

- [ ] **Step 2: Run and see it fail.**

- [ ] **Step 3: Implement.** Mock text is built from a counter and the request's names, and never from a constant cast. `slow` sets 8000 ms on `planBeat`, `reactToObject`, `replyAsCharacter`. `fail` and `cap` set `upstream_failed` and `quota_exceeded` on every route except `issueDevice`.

- [ ] **Step 4: Run.** Expected: all pass. Commit: "Add backend and relay mocks".

---

### Task 8: Backend

**Files:** Create `backend/package.json` scripts, `backend/tsconfig.json`, `backend/src/{app,server}.ts`, `backend/test/app.test.ts`.

**Interfaces:**
- Consumes: `routes`, `BackendApi`, `createHttpBackend`, `createMockBackend`, `MOCK_PROFILES`, `readPorts`.
- Produces: `createApp(api: BackendApi): Hono`. `resolveListen(argv: string[], env: Record<string, string | undefined>, readPorts): { port: number; host: string }`. Scripts `dev` (`node --watch src/server.ts --dev`), `start` (`node src/server.ts`), `typecheck`.

- [ ] **Step 1: Write the failing tests.** All through `app.request`, by passing it to `createHttpBackend` as `fetch`.

```ts
test.each(routeNames)('%s round-trips through HTTP', …);       // valid request from fixtures, parsed response
test('reactToObject streams SSE ending in final', …);
test.each(['upstream_failed','quota_exceeded','moderated'])('failure %s reaches the client typed', …);
test('MOCK cap profile: planBeat throws quota_exceeded', …);
test('no contract header returns contract_mismatch, 409', …);
test('an old contract header returns contract_mismatch, 409', …);
test('a body that is not JSON returns bad_request, 400', …);
test('a body that fails the schema returns bad_request, 400', …);
test('an unexpected exception returns upstream_failed, 502, with no stack', …);
test('GET /healthz needs no header and reports the version', …);
test('--dev reads the port file and ignores an inherited PORT, on 127.0.0.1', …);
test('production uses PORT on 0.0.0.0', …);
test('production with no PORT throws', …);
```

- [ ] **Step 2: Run and see it fail.**

- [ ] **Step 3: Implement.** Status map: `bad_request` 400, `unauthorized` 401, `contract_mismatch` 409, `moderated` 422, `quota_exceeded` 429, `upstream_failed` and `invalid_output` 502. `resolveListen` lives in `app.ts` so it can be tested without binding. The profile is `process.env.MOCK_PROFILE ?? 'normal'`, and an unknown profile throws.

- [ ] **Step 4: Run.** Expected: all pass. Then start it for real: `pnpm --filter @tabletop/backend dev`, and in another shell `curl -s 127.0.0.1:$BACKEND_PORT/healthz`. Expected: `{"ok":true,"contract":1}`. Stop it.

- [ ] **Step 5: Commit.** "Add the backend over the mocks".

---

### Task 9: Client scaffold

Invoke the `iwsdk-dev` skill first.

**Files:** Create the spec's client allowlist and `client/src/backend.ts`.

**Interfaces:**
- Consumes: `readPorts`, `CONTRACT_VERSION` from `@tabletop/contracts/version`, `createHttpBackend`.
- Produces: `client/src/backend.ts` exports `backend: BackendApi`, with `baseUrl` from `import.meta.env.TT_PUBLIC_BACKEND_URL ?? '/api'`. Scripts `dev`, `dev:agent`, `dev:down`, `dev:status`, `build`, `typecheck`.

- [ ] **Step 1: Write the files from the generator's template.** Generate into the scratchpad (`npm create @iwsdk@1.1.0-rc.2 client -- --yes --target ar --no-install --no-git`) and copy only the allowlist. Remove uikit, `@iwsdk/reference`, `@meta-quest/metavr`, and the package-level `overrides`. `iwsdk.config.json` per the spec. The scene document is `{ version:'iwsdk.scene.v1', units:'meters', components:{}, resources:{}, nodes:[], authoring:{views:[]} }`. `index.html` is titled "Tabletop Theater". `src/index.ts` runs `World.create`, then sets `document.documentElement.dataset.contract = String(CONTRACT_VERSION)`.

- [ ] **Step 2: Write `vite.config.ts`.** `defineConfig(({ command }) => …)`. Only `command === 'serve'` calls `readPorts`, so a production build needs no `.env.ports`. `server: { host: '127.0.0.1', port, proxy: { '/api': { target: 'http://127.0.0.1:' + backendPort, rewrite: strip '/api' } } }`. `envPrefix: 'TT_PUBLIC_'`. Keep the template's `build`, `esbuild` and `optimizeDeps`, minus uikit.

- [ ] **Step 3: Verify.** `pnpm --filter @tabletop/client typecheck` exits 0. `mv .env.ports .env.ports.moved && pnpm --filter @tabletop/client build; mv .env.ports.moved .env.ports`. Expected: the build succeeds with no port file, and the second `mv` runs regardless.

- [ ] **Step 4: Boot in the emulator.** From `client/`: `pnpm dev:agent`, wait until `npx iwsdk runtime status` reports a connected browser, then `npx iwsdk xr enter`, then `npx iwsdk xr status`. Expected: an active immersive AR session on the Quest 3 profile. Then `npx iwsdk browser logs` shows no errors, `npx iwsdk browser screenshot` shows an empty room with no robot or panel, and the page's `document.documentElement.dataset.contract` is `1`. Finish with `pnpm dev:down`.

- [ ] **Step 5: Commit.** "Add the client scaffold with an empty scene".

---

### Task 10: Keys and repo guards

**Files:** Create `scripts/scan-secrets.ts`, `scripts/check-bundle.ts`, `tests/scan-secrets.test.ts`, `tests/repo.test.ts`.

**Interfaces:**
- Consumes: the client build from Task 9.
- Produces: `scanDir(dir, needles: {name: string; value: string}[], patterns: {name: string; re: RegExp}[]): {file: string; name: string}[]`. `parseEnvValues(path): {name, value}[]`. CLI flag `--weaken-prefix`. Add `vite` as a root devDependency at the client's version.

- [ ] **Step 1: Write the failing tests.**

```ts
// scan-secrets
test('finds a planted value and reports its name and file', …);
test('the report never contains the value', () => expect(JSON.stringify(hits)).not.toContain(secret));
test('finds a key shape with no needle', () => /* 'sk-ant-' + 40 chars */);
test('walks nested directories and sourcemaps', …);
test('a clean directory yields nothing', …);
test('values under 8 characters are skipped as needles', …);

// repo
test('client carries no agent scaffolding', () => for (const d of ['.claude','.agents','.cursor','.codex','.github','AGENTS.md','CLAUDE.md','pnpm-workspace.yaml']) expect(existsSync(`client/${d}`)).toBe(false));
test('no package imports from spikes', …);     // tracked .ts files in client, backend, contracts, tools
test('client and contracts never read process.env', …);
test('no flagship name in product source', () => /* /\b(pip|wick|moth)\b/i over contracts/src, backend/src, client/src */);
test('no literal port in dev config', () => /* /port:\s*\d/ over client/vite.config.ts and backend/src */);
```

- [ ] **Step 2: Run and see it fail.**

- [ ] **Step 3: Implement.** `check-bundle.ts` generates random canaries for the spec's four names, sets them in `process.env`, then calls Vite's `build()` with `root: 'client'`, the client's own config file, `build.outDir` in a fresh temporary directory, and an inline plugin (`enforce: 'pre'`) that appends a `console.log` of `import.meta.env.<NAME>` for each canary to `src/index.ts`. `--weaken-prefix` sets `envPrefix: ['TT_PUBLIC_', 'VITE_']` on that inline config. It scans the output for the canaries, the `.env.local` values, `/sk-ant-[\w-]{20,}/` and `/key_[0-9a-f]{32,}/`, prints hits as `name in file`, exits 1 on any, prints `bundle clean` otherwise, and always removes the temporary directory. It writes no env file.

- [ ] **Step 4: Run.** `pnpm vitest run tests/` passes. `pnpm check:bundle` prints `bundle clean`.

- [ ] **Step 5: Prove the check can fail.** `node scripts/check-bundle.ts --weaken-prefix`. Expected: exit 1 naming `VITE_ANTHROPIC_API_KEY`, and no other changes to the tree (`git status --short` unchanged).

- [ ] **Step 6: Commit.** "Guard keys and the repo layout".

---

### Task 11: Side by side, docs, full check

**Files:** Create `contracts/README.md`. Modify `README.md`, `AGENTS.md`, and the spec's error-code line.

- [ ] **Step 1: Prove two workspaces run together.** All earlier tasks are committed, so a worktree of `HEAD` has the code. In bash:
  1. `git worktree add <scratchpad>/wt2 -b t0-sidebyside HEAD`.
  2. Allocator regression: compute the candidate base the way `setup.sh` does (first multiple-of-10 block from 5100 not in any worktree's `.env.ports` and not listening), hold `candidate + 1` open with `python3 -m http.server`, run `.superset/setup.sh` in `wt2`, and require `wt2`'s `PORT_BASE` to differ from `candidate`. Stop the holder. Setup also installs from the committed lockfile with `--frozen-lockfile`, which proves later workspaces can.
  3. Read each workspace's ports with `set -a; . ./.env.ports; set +a` in a subshell.
  4. Start both backends and both clients with `dev:agent`. `curl -sk https://127.0.0.1:$CLIENT_PORT/api/healthz` from each workspace returns `{"ok":true,"contract":1}`.
  5. Stop only our backend. Our client's `/api/healthz` now fails with a 5xx and `wt2`'s still returns ok, which proves each proxy targets its own backend.
  6. Stop everything, `git worktree remove`, `git branch -D t0-sidebyside`. Expected: nothing left listening on either block, `git worktree list` is back to what it was.

- [ ] **Step 2: Write the docs.** `contracts/README.md`: what's in the package, the rules (data not code, closed vs open lists, a wire change bumps the version and is its own small PR), and how art validates its files. Root `README.md`: replace the "no product code yet" status, add `pnpm dev`, `pnpm check`. `AGENTS.md`: one line saying IWSDK commands run from `client/`.

- [ ] **Step 3: Run everything.** `pnpm check`. Expected: typecheck clean, all tests pass, `bundle clean`.

- [ ] **Step 4: Check git.** `git status --short` is clean after commit, and `git ls-files | grep -E 'node_modules|\.iwsdk|\.env'` prints nothing.

- [ ] **Step 5: Commit.** "Document the workspace".
