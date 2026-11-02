# Spikes

Throwaway experiments that settled early technical questions. Nothing here is product code, so don't build on it. The results are in `docs/technical-design.md`, marked *measured*.

Air drawing has since left the product, so the drawing and doodle-reading parts are history. The rest still applies.

- `quest-stack/`: IWSDK on Quest 3 over passthrough. Still useful for frame rate, the mic after a pause, placement, and how to reach the headset. Run `npm install`, then `run-on-quest.sh` with a Quest plugged in and Quest Browser open (`node open-on-quest.mjs` just reopens the page). `node report.mjs` in that folder prints results. `emulator-test.mjs` runs the same path with simulated hands, against a running dev session.
- `ai-probes/`: latency and quality of beat planning and character replies, plus doodle reading. Needs `npm install` and `ANTHROPIC_API_KEY`, and each run spends API credit. The `*.json` files are saved results.
