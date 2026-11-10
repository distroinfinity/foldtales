# Tabletop Theater

Our entry for the Meta VR Start Developer Competition, due Nov 18, 2026. A painted storybook on your real table, built with IWSDK and tested on a Quest 3.

Read `docs/prd.md`, `docs/technical-design.md`, `docs/design-language.md` and your ticket in `docs/sprint-plan.md` first.

- Do not publish anything to Claude artifacts or Claude Docs. Documents live as plain files in `docs/`.
- Commit or push only when asked.
- API keys stay in backend or local environment variables, never in the repo, the client bundle or the headset.
- `spikes/` is throwaway reference code. Do not import from it.
- No build ships with test visuals. Visual work follows `docs/design-language.md` and its look bar.
- v1 is frozen. New ideas go in `docs/v2-ideas.md`, not into tickets.
- Generated art is a product asset. Read `art/README.md` before painting anything: every run needs a plan first.
- IWSDK skills are in `.claude/skills/` and `.agents/skills/`. Use them for IWSDK work.
- This is a pnpm monorepo: `client`, `backend`, `contracts`. Run IWSDK CLI commands from `client/`. Shared shapes live in `contracts`, and a change to one is its own small PR.
- Each workspace has its own ports in `.env.ports`. Dev servers read `CLIENT_PORT` and `BACKEND_PORT` from it, and never hard-code a port.
