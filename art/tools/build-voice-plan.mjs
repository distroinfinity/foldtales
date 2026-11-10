// Writes a voice run's plan.json from the audition design. The first round covers every preset, and a shortlist adds the audition round.
// Usage, from the repo root: node art/tools/build-voice-plan.mjs art/runs/<id> [art/runs/<id>/shortlist.json]
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { PRESETS, validatePlan } from "./generate-voice.mjs";

const SWEEP_LINE = "Is somebody there? ... Oh! [laughs] It's only you. You gave me such a fright, I nearly dropped the lantern.";

const LINES = {
  pip: [
    ["fear", "Fear", "[whispers] Hello? ... It went out. It just... went out. [gulps] I don't like it when it's this dark."],
    ["relief", "Relief", "[exhales] Oh... oh, thank you. [laughs] It's warm again. I wasn't scared. [curious] Well. Only a bit."],
    ["wish", "Joke, and the wish", "One day I'll keep the lamp myself. [laughs] I just have to grow into the coat first."],
  ],
  wick: [
    ["grumble", "Grumble", "[sighs] Forty years I've kept this lamp, and not one soul has wiped their boots. Mind the step. No, the other step."],
    ["sight", "Sight, kept gentle", "[low, gravelly voice] Read it to me, would you? ... The page is fine. It's the ink. They make the ink too faint these days."],
    ["warmth", "Gruff warmth", "[sighs] That moth's in the jam again. ... Good lamp, that. You did all right, young one."],
  ],
  moth: [
    ["bright", "Bright!", "[excited] Oh! Ooh! Is that a light? Is it MY light? I'm coming, I'm coming, I'm... ow."],
    ["find", "Silly find", "[mischievously] I found you something! It's a button. Or a biscuit. [snorts] I licked it, and I'm still not sure."],
    ["sorry", "Sorry, not sorry", "Sorry! Sorry, sorry. I didn't mean to land in your soup. It was just so shiny. [laughs] Can I do it again?"],
  ],
  narrator: [
    ["opening", "Opening", "Everything lost in a house drifts, in the end, to the edge of the table. And at the edge of the table... there is a lighthouse."],
    ["aside", "Dry aside", "Now, Pip had been told, more than once, never to go out after dark. [pause] Pip had also been told not to sit in the jam."],
  ],
};

function seedFor(id) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i += 1) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

export function buildPlan(shortlist) {
  const jobs = PRESETS.map((presetId, i) => {
    const id = `sweep-${String(i + 1).padStart(2, "0")}`;
    return { id, phase: "sweep", role: null, option: null, beat: "sweep", beatLabel: "All voices", presetId, promptText: SWEEP_LINE, seed: seedFor(id) };
  });
  for (const [role, beats] of Object.entries(LINES)) {
    (shortlist?.[role] ?? []).forEach((presetId, i) => {
      const option = "ABC"[i];
      for (const [beat, beatLabel, promptText] of beats) {
        const id = `${role}-${option.toLowerCase()}-${beat}`;
        jobs.push({ id, phase: "audition", role, option, beat, beatLabel, presetId, promptText, seed: seedFor(id) });
      }
    });
  }
  return {
    id: "005-voice-audition",
    question: "Which voices from Runway's eleven_v4 presets carry Pip, Wick, Moth and the narrator with radio-play warmth?",
    why: "Runway publishes no descriptions for its 49 presets and samples for only 4, so we can't cast by name. The audition is judged by ear on the Quest's speakers.",
    decideBy: ["The user picks by ear, on the headset, from three options per role reading the same acting lines.", "Fear, grumbling, relief and a joke must feel cozy, not robotic, through the paper-radio chain."],
    learnEvenIfRejected: "How each preset sounds, the sweep's measured register for all 49, and how well audio tags act on short lines. This feeds any future casting.",
    reusableOutput: "The chosen voices and chain settings, for pre-render and live lines. All clips stay as reference takes, and the chain is code in art/voice/.",
    capCredits: 100,
    model: "eleven_v4",
    settings: { stability: 0.4, similarityBoost: 0.75, languageCode: "en" },
    jobs,
  };
}

function main() {
  const [runDir, shortlistPath] = process.argv.slice(2);
  if (!runDir) {
    console.error("usage: build-voice-plan.mjs <runDir> [shortlist.json]");
    process.exit(2);
  }
  const plan = buildPlan(shortlistPath ? JSON.parse(fs.readFileSync(shortlistPath, "utf8")) : null);
  validatePlan(plan);
  fs.mkdirSync(runDir, { recursive: true });
  fs.writeFileSync(path.join(runDir, "plan.json"), `${JSON.stringify(plan, null, 2)}\n`);
  console.log(`wrote plan with ${plan.jobs.length} jobs`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) main();
