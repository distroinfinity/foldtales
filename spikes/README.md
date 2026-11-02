# Spikes

Throwaway experiments that settle technical questions. Nothing here is product code, so don't build on it.

- `quest-stack/`: can IWSDK on Quest 3 hold frame rate over passthrough, and do air-drawn strokes become a moving puppet in about 2 s? Run `quest-stack/run-on-quest.sh` with a Quest plugged in and Quest Browser open (`node open-on-quest.mjs` just reopens the page), then `node report.mjs` in that folder for results. `emulator-test.mjs` runs the same path with simulated hands, against a running dev session.
- `ai-probes/`: latency and quality of doodle reading, beat planning and character replies. Needs `npm install` and `ANTHROPIC_API_KEY`, and each run spends API credit. `doodle.mjs` and `stream.mjs` read images from `img/`, which `render.py` makes from Quick Draw samples in `qd-data/` (not committed). The `*.json` files and `haiku_rigs.png` are saved results.
