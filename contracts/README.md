# Contracts

The shapes every workstream shares: stage actions, the acting list, beats, objects, tags, rigs, events, telemetry, relay messages and the backend API, plus a mock for every backend call.

Import from `@tabletop/contracts`. Mocks and fixtures are in `@tabletop/contracts/mocks`, which stays out of the client bundle.

## Rules

- **Characters, objects and scene problems are data.** No name from the flagship cast appears in this package, and the test fixtures are an invented cast to prove it.
- **What is code is a closed list, and what is content is open.** Actions and acting are closed because each is engine code. Cast, objects, marks, sets, cues and tags are validated strings, checked against a library by `checkLibrary`, `checkBeat` and `checkSpine`.
- **A change to any wire shape bumps `CONTRACT_VERSION`,** additive or not, because schemas are strict. It's its own small PR, never part of a feature branch.
- **New tags go in `data/tags.json`,** one line each.

## For the art library

Each object is an `art/objects/<id>/object.json` matching `ObjectDef`, using only tags from `data/tags.json`. `pnpm test` checks those files and every `art/cast/*/rig.json`.

## What's where

| File | Holds |
|---|---|
| `src/stage-actions.ts` | `StageAction`, the timing rules, `stageActionsJsonSchema()` |
| `src/acting.ts` | The acting table |
| `src/beats.ts` | `Beat`, `Spine`, `ReadyBeat`, `lineIdOf`, `pickProblemRule`, `bindBeat`, the checks |
| `src/objects.ts`, `src/rig.ts`, `src/library.ts` | Objects, rigs, cast, sets |
| `src/events.ts`, `src/telemetry.ts`, `src/relay.ts` | The log, telemetry and Story Circle messages |
| `src/api.ts` | Route table, `BackendApi`, `createHttpBackend` |
| `src/mocks/` | `createMockBackend`, `createMockRelay`, fixtures |
