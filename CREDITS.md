# Credits

Foldtales, made for the Meta VR Start Developer Competition, 2026. Re-check each licence at release.

## Art, voices and sound

- **Painted art** (cast, sets, book, objects, the reading room): generated with Seedream through Runway from our own designs and references, then cut out, finished and rigged by us. Every run's plan, prompts and results are in `art/runs/`. Runway's terms say outputs are owned by the user; re-check before release.
- **Chapter voices:** ElevenLabs presets (eleven_v4) through Runway, recorded before release. Run 005 chose the cast, and runs 010 and 012 made chapter 1's lines.
- **Sound effects:** made through Runway (runs 009, 010 and 016).
- **The AI Storyteller, live:** stories by Anthropic's Claude; voices by OpenAI (`gpt-4o-mini-tts`), disclosed to readers as AI-generated, as OpenAI's terms require; speech in by Groq (Whisper); live pictures by Runway (`seedream5_flash`), credited "Powered by Runway" where they appear. Each service's terms, and what they ask of us, are in `docs/legal-copy.md`.

## Terms we rely on (read Nov 16, 2026)

- **Runway** ([Terms of Use](https://runway.com/terms-of-use), Oct 23, 2026): no ownership claimed in outputs, and commercial use not restricted (§4.4); "Powered by Runway", linked, where its service is used (§1); our readers bound by terms at least as protective (§2.5), met by our Terms page. Runway may train on inputs and outputs.
- **OpenAI:** generated speech disclosed as AI-generated (Service Terms). API data not used for training.
- **Groq:** API data not used for training; Zero Data Retention available as a setting.
- **Evidence:** every Runway run's plan, prompts, model, cost and outputs are in `art/runs/<id>/` (`plan.json`, `manifest.jsonl`, `results.md`).

## Type

- Fraunces, SIL Open Font License 1.1.
- Atkinson Hyperlegible Next, SIL Open Font License 1.1.
- Cormorant Garamond, SIL Open Font License 1.1.

## Code

| Package | Licence |
|---|---|
| Immersive Web SDK (`@iwsdk/*`), Three.js | MIT |
| troika-three-text | MIT |
| Basis Universal transcoder (shipped in `basis/`) | Apache-2.0 |
| `@elevenlabs/client`, LiveKit client (while bundled) | MIT, Apache-2.0 |
| React, React DOM | MIT |
| Motion | MIT |
| Tailwind CSS | MIT |
| clsx, tailwind-merge | MIT |
| Zod | MIT |
| Hono | MIT |
| Better Auth | MIT |
| Magic UI components (Blur Fade, Text Animate, Shimmer Button, Particles), adapted in `client/src/landing/ui/` | MIT |

Every third-party licence, in full, ships with the site as `notices.txt` (built by `client/vite/notices-plugin.ts` from the modules actually bundled, plus the Basis Universal transcoder (Apache-2.0, with its NOTICE), Tailwind's generated CSS and the adapted Magic UI components). Licence files for packages that ship none are kept in `client/vite/licences/`. **Gap:** `@drawcall/uikitml` (pulled in by IWSDK) publishes no licence.

The lamp beam and the lantern's pool on the web page are our own CSS, after the idea of Aceternity UI's Lamp and Spotlight. No Aceternity code is used.
