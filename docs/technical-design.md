# Tabletop Theater: technical design

How we build it, and why. Read with `prd.md` (what), `hackathon.md` (constraints), `design-language.md` (how it looks) and `sprint-plan.md` (the order). Numbers marked *measured* come from `spikes/` or `art/runs/`, on the real Quest 3 or the live API. Everything else is an estimate or a decision.

## The rule the whole design follows

**The show never waits on AI.** The Stage plays authored beats with no network. AI only adds beats that are already validated and voiced before their slot arrives. Slow AI, failed AI, a hit spending cap and no internet all take the same path: the authored beat plays. That one rule covers the take-it-away test, the no-stall promise and the budget.

## Stack

**IWSDK 1.x (WebXR, Three.js r185, TypeScript), a Node backend on Railway, and static hosting on a free CDN.** Submit the hosted link. Package as a PWA for instant repeat launches.

| Option | For this product | For agents | Verdict |
|---|---|---|---|
| **IWSDK** | Painted cards and layers are plain Three.js. Hosted link has no install step. Hands, gaze-and-pinch, hit-test and depth are built in. No store-grade native scene features | Emulator with scripted hands, CLI and MCP on one surface, TypeScript across client and backend, cheap per-agent checkouts | **Chosen** |
| Unity | Strongest MR kit (MRUK, ISDK) and art tools | On Mac: simulator only and a full APK build per headset test. Operator is experimental, and each agent needs a heavy editor | Rejected: slows the headset loop you'll live in |
| Unreal | Best visuals on paper, which our art doesn't need | Heavy, weak on Mac, heavier per-agent | Rejected |
| Spatial SDK | Good native panels | Kotlin, little agent automation | Rejected |

*Measured on the Quest:* median 90 fps at every load level, low of 83 at the heaviest (105 draw calls, 56k triangles). Hitches only at session start and load changes (up to about 280 ms), so scenes are built before they appear. Nothing measured favored Unity.

**Known costs of this choice.** The browser owns its Resume/Quit dialog, which froze twice. There's no eye tracking on Quest 3, so gaze is head-gaze there and is tested with the `metaVRGlasses` emulator device. The judging text names ISDK and MRUK, so our submission describes the IWSDK equivalents directly.

## System shape

```
 Hands · head gaze · voice
        │
 Intent router ──► Object system ───────────┐
        │          (set, drawer, satchel)   ▼
 Show scheduler ◄── beat queue ◄── Beat   Stage + Puppet system
 (client, owns clock)   ▲        validator  (book, sets, characters, light, sound)
        │               │                   ▲
        └── event log ──┤                   │ stage actions only
              │         │                   │
        Series memory   └── Backend on Railway: Director, Characters,
        (IndexedDB +         live painter, voice, quotas, Story Circle relay
         server mirror)
```

- **Contracts first.** One TypeScript package defines stage actions, beats, objects, rigs, events and telemetry. Client and backend share it, and every module builds against mocks of it.
- **Everything is an event.** Grabs, gifts, beats and canon changes append to one log. That log gives us pause and resume, crash recovery, Story Circle replication, and a headless simulator.
- **Characters, objects and scene problems are data, not code.** Nothing in the engine knows the name Pip. This keeps a new cast or world cheap later (`v2-ideas.md`), and it costs nothing now.
- **The AI's only output is stage actions.** It stages from our library. It cannot place text in the world, move the camera, write canon, or name art that doesn't exist. The validator rejects anything else.

## Stage and your room

- **Placement:** environment hit-test, with no room scan needed. Keep the highest cluster within 0.6 m reach (the 2-foot airplane rule) and above floor height, fall back to a spot in front of you, and use scanned planes when they exist. *Measured:* worked on a freshly reset headset with zero planes or meshes.
- **Move and fit:** drag by the spine. Stage size adapts from tray to desk, and edges come from the found surface or the book's own bounds.
- **Comfort:** book center at least 0.5 m from your eyes, nothing head-locked. Key action and captions fit the VR Glasses view (37° left and right, 25° up, 43° down), checked with `fieldOfViewMask`.
- **Room dim:** a sphere around your head, drawn once, with alpha rising away from the book. It's a single layer of blending, and it goes over passthrough only. Fragment cost gets measured in P5.
- **The beam, without depth data:** the lamp's beam is a soft sector cut out of that same sphere, with a warm tint, sweeping around the room. Your real walls appear to light up as it passes, with no room scan. A faint cone adds the beam in the air. If P5 shows it's convincing, there's no need to touch depth.
- **Occlusion:** depth occlusion through `DepthOccludable`. The painted material extends Three.js standard materials so depth injection still works, because a fully custom shader may not. Needs a device check (P5).
- **No passthrough:** the same stage on a table in a small painted room.
- **Resilience:** any frame error is caught, reported and survived, since one uncaught error froze the spike's whole render loop. State saves on each event, so a forced quit reloads to the same beat. *Measured:* pause and resume kept all puppets, and a mic stream did not survive a pause.

## Puppet system

A character is a stack of textured cards, driven by code at 12 poses a second. `art/cast/prototype.html` is the approved acting, and `art/cast/<who>/rig.json` holds each fit. *Measured in a desktop browser only.*

- **Cards:** one quad per part, with small real gaps in depth, and a shared atlas per character. Mipmaps on, since a painted head of about 300 px covers roughly 90 to 200 px at book distance.
- **Edges:** `alphaToCoverage` over MSAA, which keeps soft fur edges without blended sorting or overdraw. MSAA is on by default in IWSDK. Fall back to alpha test if it costs too much.
- **Facing:** the character's root card yaws toward you, up to a limit, so nothing goes edge-on as you lean. A pop-up book's flatness is part of the charm, but P0 tests that it holds up.
- **Heads:** a matched set per speaking character, swapped by visibility. *Measured:* talking and blinking heads from one sheet land within 5 pixels of the forward head, and the offsets are in the rig.
- **Talking:** mouth swaps follow the voice's loudness. There's no lip-sync model, since Web Audio's analyser is enough at 12 poses a second.
- **Actions:** a named list shared with the director (`look`, `scared`, `raise`, `hop`, `turn`, `grumble`, `examine`, and so on). Each one is code, so any action can start instantly. That's why this method won: a pre-rendered video couldn't react to you.
- **Lighting:** the art carries its own painted light. A single tint uniform moves the mood from dusk to night to gold, the lantern adds a glow sprite and one light, and contact shadows are simple blobs. Textures are KTX2.
- **A new character is cheap:** one parts sheet and one heads sheet, about 10 credits and 4 minutes (*measured*). So the library can hold visitors.

## Objects: how the story bends

This replaces drawing, and it's the core of the product. **An object is a painted piece plus data the show can reason about:**

```ts
{ id, name, art, size, description,   // "A small red kite with a torn tail"
  tags,                               // ["flies", "light", "catches-wind", "fragile"]
  history }                           // What it did in earlier stories. Satchel objects only
```

When you hand an object to a character:

| When | What happens | Where it comes from |
|---|---|---|
| At release | The character takes it and turns it over, with a small sound | Authored, no AI |
| Within a frame | The scene's authored rules match its tags to the current problem, which picks a fallback branch | Authored, no AI |
| About 1 to 2 s | A line about this exact object, voiced ("A kite? In this wind?") | Haiku, streamed |
| About 5 to 6 s | The next beat, built around the object | Sonnet, ahead of need |

Turning the object over isn't filler. It's the acting that covers the wait, and if AI fails, the authored branch plays straight after it.

- **Every scene problem is written in tags, not objects.** "The gap" accepts `flies`, `climbs`, `spans`, `rope`, and anything else gets a funny failure, with Pip keeping it anyway. That gives every object a real branch with AI off, without a table of every object against every scene.
- **Use it and you can keep it.** When an object is used in a beat, it moves to your satchel, with one sentence of history written by the app from the event log.
- **The satchel carries across stories.** It lives in series memory, and the director gets its contents as things it can bring back: the kite from last week is tangled on the lighthouse, and its owner has come looking.
- **The drawer holds presets for this story,** and it opens when a beat asks or when you pull it.

## Director: live beats that never stall

The scheduler runs on the client and owns the clock.

1. A beat counts as **ready** only once it's validated and its voice lines are rendered.
2. The queue always looks ahead. Sonnet plans the next beat while the current one plays. *Measured:* 4.6–5.8 s for a beat of about 30 s, against Haiku's 3.6–4.9 s with weaker writing and Opus's 7.5–10.6 s.
3. At each deadline: play the next ready beat. If there's none, play **one** unused pre-rendered narrator bridge, then the scene's authored beat. A ledger blocks any repeated line.
4. Gifts and other interventions preempt: an authored reaction plays instantly, and the AI follow-up joins the queue.
5. The app enforces the 5–7 minute time-box, resolution and Story Circle fairness, and tells the director what's still owed.
6. The director gets a spine (authored for the flagship, generated at start for a new story, with fallback beats), the library, canon and the satchel.

**Guardrails from probes:** Sonnet tends to resolve the problem in one beat, so the validator enforces pacing against the spine. Strip stage directions like `*grumbles*`. Handle `stop_reason: refusal` as a failure path. Use streaming with `output_config.format`, with `thinking: disabled` on Haiku and `between_tools` on Sonnet, since Sonnet 5.5 returns 400 on `disabled`.

**Testing:** a headless Node simulator runs whole shows with scripted Readers and injected slowness and failure. It asserts no gap over the bridge limit, no repeated line, time-box met, and every gift acknowledged. This is P4. P2 tests the separate question of whether an object really changes the story.

## Talk

Mic permission is asked on the landing page before XR, because the first prompt in XR ended the session (*measured*, twice). After that, each listen opens a fresh stream (*measured:* 36 ms in-session) and closes it afterward, and the paper ear shows it's live. Browser voice processing stays on: both modes transcribed correctly, and it should reduce show audio bleed.

Speech to text streams to the backend, Haiku replies in character (*measured* first text about 1 s, full reply 1.6–2 s), and a fast voice reads it. A short acknowledging sound or gesture from the character fills the first second. Talking stays optional, and a mute is always available. Measure the first second of capture in this ticket, since both test clips started with about 1 s of near silence, which may simply be when speech began.

## Voice and music

Direction is radio-play warmth. Decisions:

- **Prepared lines and effects through Runway,** because your credits already pay for them: `eleven_v4` at 5 credits per 1,000 characters, and sound effects at 1 credit a second (vendor price list). It can't be assumed fast enough for live replies, since Runway's image jobs run as queued tasks.
- **Live speech decided by test.** The voice ticket measures Runway's text to speech first. If it's too slow for replies, live lines use ElevenLabs' fast model directly. Runway lists no speech to text, so that's ElevenLabs Scribe or OpenAI, whichever a blind test favors. Each needs a paid account with an estimate first.
- **Coziness comes from the chain, not the model:** a paper-radio EQ and gentle saturation on every voice, shared room tone, foley for objects, and pacing control. The chain is applied in Web Audio, so all sources match.
- **Music:** pre-made small-ensemble stems in one key and tempo, crossfaded on the bar by mood. Never generated live. Runway lists no music model, though an unlabeled `seed_audio` is on its price list and is worth one planned test. If that fails, use a licensed library, and check the terms. You judge by ear.

Audio mix is checked in the headset. *Measured:* the Quest recorder captures footage, but its audio track was too faint to judge, so retest with real show audio before the video.

## Live painter

Live painting happens only where lateness is natural. `seedream5_flash` costs 2 credits and takes under 30 s (*measured*), through Runway on the backend.

| Use | How it hides the wait | If it fails |
|---|---|---|
| **Moth's odd find:** a new object, described by the director | Moth flies off, and comes back when it's ready | Moth brings something from the library |
| **Storybook page** | The page paints in while the book closes, and you reread it later | A page composed from the episode's own puppet and object art |
| **New visitor** | Painted between episodes, and shown as a single-piece card with simple motion | A prepared visitor from the library |

- Painting happens on flat paper, then the backend cuts it out with the same logic as `art/tools/cutout.py`, ported to Node. A check on piece count and coverage rejects bad results.
- The client never calls Runway, and a per-session cap applies.
- Jointed visitors are all prepared ahead. Automatic rigging of live characters stays out of scope, though the recipe makes it possible later.
- This whole section is an "if there's time" item in `sprint-plan.md`, because composed pages and the prepared library keep the promise without it.

## Story Circle

**One sync path for both modes.** All positions are stage coordinates, and each client maps the stage onto its own surface.

- **Relay:** one Node process on Railway holds rooms in memory, with snapshots to its volume. Invites are unguessable codes, with no matchmaking.
- **Authority:** the host's scheduler and director drive the show. The server keeps the ordered event log, grants ownership tokens for grabs, and holds the single speaker lock. If the host drops, the server promotes another client, which continues from the last completed beat. Railway [documents reconnects as necessary](https://docs.railway.com/guides/socketio) because deploys can drop sockets, so clients always resume from their last log position.
- **Same room:** WebXR Shared Spaces sits behind a browser flag, so judges won't have it. Guests instead overlay their book on a ghost of the host's and pinch to lock. Proof P3 tests this with two headsets.
- **Remote:** WebRTC mesh for voice, with a free STUN and a TURN fallback. Paper avatars sit at the book's edge. If voice fails, the show continues with captions.
- **Fairness:** the app tracks who has changed the scene and tells the director who's owed a moment. Each person's satchel joins the story, so friends bring things to each other's series.
- **Solo judges and agents:** a bot Reader joins as a second client, so Story Circle can be shown and tested alone.

## Memory

The series is an append-only event log plus derived canon, in IndexedDB with `navigator.storage.persist()`, mirrored to the server by a device ID. Only the app writes canon. Pages are composed from the episode's own art and record what lasts, and undo appends a reversal so later episodes change for real. "Changes, not mentions" is tested by comparing simulated next episodes with and without the consequence. Voice recordings are never stored on the server, and canon can be deleted from the book.

## Backend and hosting

- **Railway:** one Node service for API proxy, relay and persistence, with API keys only here. [WebSockets are exempt from its request timeouts](https://docs.railway.com/networking/public-networking/specs-and-limits). Check the available regions at setup, and prefer the one closest to judges (US).
- **Static client:** free CDN (Cloudflare Pages unless its limits disagree), because cold start is a hard constraint and we couldn't confirm a Railway CDN. Every branch gets a preview URL, so testing doesn't need USB.
- **Cost guard:** device-token quotas, per-feature daily caps, and a global cap. Hitting any cap means the authored path.

**Budget rule, from you:** free tiers first, an estimate before anything paid, hard caps always. These are estimates, not quotes:

| Item | Estimate | Basis |
|---|---|---|
| Railway | About $7/month at 0.5 GB RAM and 0.1 vCPU; your plan credit covers some or all of it | [Metered rates](https://docs.railway.com/pricing/plans) |
| Live AI text per episode | $0.25–0.50 flagship, about $0.80 for a new story | *Measured* token sizes |
| Prepared art | About 500 credits ($5) for all sets, objects and visitors. 192 credits spent so far | *Measured* rate of 5 credits a sheet |
| Prepared voice | About 15 credits ($0.15) per episode's script | Vendor list price, about 3,000 characters |
| Live art per episode | About 4 credits ($0.04) | *Measured* |
| Live speech | Per-minute and per-character rates, once the test picks a vendor | Estimate before buying |

Credits come from your Runway balance of 112,226 ($1,122 at list price).

## AI pieces at a glance

| Piece | Model or service | Runs | Latency | How it fails | How we test it |
|---|---|---|---|---|---|
| Director | `claude-sonnet-5-5` | Backend, ahead of need | 4.6–5.8 s, hidden by queue | One bridge, then authored | Simulator, plus a story rubric you spot-check |
| Object reaction | `claude-haiku-5-5` | Backend, streamed | About 1 s to first text | Authored reaction and tag branch | Set of objects against each scene problem, with a rubric |
| Characters | `claude-haiku-5-5` | Backend, streamed | About 1 s to first text | Short in-character line, story continues | Scripted conversations, in-character and safety rubric |
| Moderation | Haiku classifier and refusal handling | Backend | Under 1 s | Narrator redirects in-story | Red-team set in CI |
| Speech to text | Scribe or OpenAI, by test | Backend-issued token | Measured in ticket | "Couldn't hear you", silent play intact | Recorded clips, plus you in the room |
| Prepared voices | `eleven_v4` through Runway | Build-time | Doesn't matter | Captions | Your ears, plus a line-render check |
| Live voices | Runway or ElevenLabs, by test | Backend | Measured in ticket | Captions and authored line | Your ears |
| Live painter | `seedream5_flash` through Runway | Backend, async | Under 30 s, hidden | Library art or composed page | Look bar review, plus rejection-rate check |
| Music | None, authored stems | Client | Instant | Can't fail mid-show | Your ears |

## What stays authored or thin

- **Authored:** flagship beats, branches, tag rules, sets, cast art, the object library, bridges, reactions, music, foley.
- **Thin but real:** a new story uses the same world, cast and library. AI writes the story, and only pages, odd finds and a few visitor cards are painted live.
- **Dropped:** drawing, doodle reading, highlight clip.

Promises still kept: lean-back works with zero input, what you give changes the ending, objects come back with history, and everyone in the Circle changes the scene.

## Must-pass mapping

| Constraint | How |
|---|---|
| Hands-first | No controller code paths, and emulator flows use hand poses only |
| Airplane seat | Book, drawer and satchel within 0.6 m, tested at tray size |
| Bus stop | CDN and PWA cache, one-tap landing page, book starts opening at once, event-log resume |
| Take-it-away | Authored show with tag branches runs with the backend off, and CI runs the simulator offline |
| ≥60 fps | Preloaded scenes, telemetry in every build, frame budget in CI scenes, tested in your rooms |

## Riskiest things and early proofs

| # | Question | How we prove it | If it fails |
|---|---|---|---|
| P0 | Do painted puppets hold up in the headset, including from the side and in your room? | The first 30 seconds with final art, in the headset | Lower yaw limit, thicker card edges, more layers. Hire an illustrator only if the paintings themselves fail |
| P1 | Does handing over small objects feel good? | Grab from the drawer and hand to Pip, with you and at least one other person | Bigger snap radius, bigger objects, or pinch an object then pinch a character |
| P2 | Does what you give really change the story? | Library objects against each scene problem, scored by a rubric, and you play the best and worst | Stronger spine, more scene problems, or a Sonnet object reaction in place of Haiku |
| P3 | Can two headsets share one stage in one room? | Thin relay and alignment, built early | Line-up by matching two table points, or same-room runs as remote |
| P4 | Can the director run with no stall or repeat? | Hundreds of simulated shows | More authored beats, longer lookahead, simpler model output |
| P5 | Do room dim, beam and occlusion hold on device? | Dim sphere, beam sector and painted material inside P0 | Soft overlay near the book, a beam in the air only, and hard occlusion |

## How work gets verified

| An agent can check alone | Needs you in the headset |
|---|---|
| Types, contracts, simulator, AI evals, offline run | Whether it looks and feels right, the final call on the look |
| Emulator flows with scripted hands, glasses FOV, placement logic | Handing objects, comfort, grabbing feel |
| Screenshots against the look bar, frames pulled from your recordings | Voice, music and mix taste |
| Telemetry from your sessions: fps, timings, errors | Real rooms, passthrough quality, the beam, depth |
| Two-client sync using a bot | Same-room alignment with two headsets |

Emulator frame rate means nothing, so performance only counts from telemetry on the device. Live mirroring (`adb exec-out screenrecord`) and device screenshots both returned black during the spike, so agents see the headset through recordings you make plus telemetry.
