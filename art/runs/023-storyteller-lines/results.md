# Run 023: the Storyteller's recorded lines

Recorded Nov 17. The sprint master approved the four live voices for the owner, judging from the live voice proof: 67 live lines, about 2 s each to voice, no failures. The owner had delegated the call: "if they sound clear and okay we're good".

## What was made

- **The lines:** 13, in the live voices, as `plan.json` lists them.
  - Narrator: 7.
  - Pip: 2.
  - Moth: 3.
  - Each with `art/voice/live.json`'s voice, direction and speed, through OpenAI's `gpt-4o-mini-tts`.
- **Takes:** one take each, no retakes.
- **Where they are:**
  - Raw takes: in this folder.
  - Finished clips: `art/sound/storyteller/<id>.mp3`, served by the build now that `sound/storyteller` is in the show manifest's `artFolders`. `client/src/storyteller/recorded.ts` loads them by id.

## Spend

| | |
|---|---|
| Characters | 712 of the 2,000 cap |
| Audio | 64.4 s raw, 59.4 s finished |
| Calls | 13, each 1.2–2.1 s |
| Cost | about $0.016 at OpenAI's published prices (plan estimate: about $0.02) |
| Runway credits | none |

The ledger, with every request and its estimated cost, is `manifest.jsonl`.

## Checks (`finish.mjs`, written to `check.json`)

- **Every clip decodes start to finish** with no errors.
- **Every clip says its line.** Each was transcribed with the Storyteller's own listening model (Groq `whisper-large-v3-turbo`), and every word of the line is in it.
- **Levels match the chapters' lines:**
  - Narrator: -3 dB peak.
  - Pip: -5 dB.
  - Moth: -6 dB.
- **Silence at each end trimmed** to a short breath.
- **The 6 s limit:** 10 of 13 are under it. Three are slightly over, at the live voices' own unhurried pace:
  - `welcome-fallback` (Pip): 6.46 s.
  - `redirect-a` (narrator): 6.49 s.
  - `resting` (narrator): 6.36 s.

  They're kept: a faster retake would no longer match the same character live, which is the point of the run. Live lines run 5–15 s, and the client times a recorded line by its real length, so nothing depends on the 6 s.

## Learned

- **OpenAI's speech holds a voice between prepared and live lines** when the voice, direction and speed are the same. These sit beside the live proof's lines without a seam.
- **gpt-4o-mini-tts reads about 11 characters a second at the narrator's 0.95 speed,** with about 0.3 s of silence at each end. Budget a 6 s line at about 60 characters.
- **Transcribing each clip is a free check that it says its line.** Groq's turbo model costs a fraction of a cent for a whole run.
