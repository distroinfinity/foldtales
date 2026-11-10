# Tabletop Theater

An AI-directed painted storybook that opens on your real table. Hand the characters anything, and the story bends around it and remembers. Our entry for the Meta VR Start Developer Competition, due Nov 18, 2026.

**Status:** plan and cast art are frozen as v1. The workspace and contracts are in place, and the client boots an empty scene. Tickets are in `docs/sprint-plan.md`.

## Running it

Use Node 24 and pnpm. In a Superset workspace, `.superset/setup.sh` has already installed everything and written this workspace's ports to `.env.ports`.

| Command | Does |
|---|---|
| `pnpm dev` | Runs the client in the IWSDK emulator and the backend against the mocks |
| `pnpm --filter @tabletop/client dev:agent` | Runs the client headless, for agents |
| `pnpm check` | Typecheck, tests, and the scan that keeps keys out of the client bundle |

`MOCK_PROFILE` picks how the mock backend behaves: `normal`, `slow`, `fail` or `cap`.

## Where things are

| Folder | Is |
|---|---|
| `client/` | The IWSDK app |
| `backend/` | The Hono server, running over the mocks for now |
| `contracts/` | The shared shapes and mocks. Start with `contracts/README.md` |

| Read this | For |
|---|---|
| `docs/prd.md` | What we're building |
| `docs/hackathon.md` | Competition rules and hard constraints |
| `docs/technical-design.md` | How we're building it, and why |
| `docs/design-language.md` | How it looks, sounds and feels |
| `docs/sprint-plan.md` | Tickets, milestones and setup |
| `docs/v2-ideas.md` | What we'll consider after v1 |
| `art/README.md` | How art gets planned and painted |

To see the approved acting, run `python3 -m http.server` in `art/cast/` and open `/prototype.html`.
