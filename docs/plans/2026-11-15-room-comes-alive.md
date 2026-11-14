# Your room comes alive (room effects)

**Status:** Plan, reviewed once by Codex (Nov 15, ten findings, all taken in), waiting for the owner's approval. No code yet. Branch `ticket-4-room-comes-alive`, from main.

**Why.** In the AI Storyteller's second headset session (Nov 14), the owner asked the cast to "light up my room" and the lighthouse beam swept the real room: "that lighthouse effect was nice … very simple and clever, like a rotating light in my room. More things which interact with my living place." Not new characters: more things like the lamp. The same session found the cast promising room effects that never happened ("the kite is circling your couch"). This ticket builds real room effects, so the cast has real things to do and only promises what exists.

**Read with:** `docs/design-language.md` (Light and the room, the look bar), `docs/technical-design.md` (Stage and your room, P5), `art/README.md`, ticket 3's `backend/src/storyteller/turn.ts` (PR #9).

## What you'll get

Seven effects, approved by the owner on Nov 14, each usable from a written chapter and from the AI Storyteller:

1. **Weather in your room.** Painted rain falls across the room, the room darkens, thunder flashes light your real walls, and you hear it all around you. Snow settles on your real table and couch. Fog rolls along the floor.
2. **Shadow play on your wall.** With a light lit, the cast throws giant shadows on your real wall. Pip waves, and a huge Pip shadow waves back.
3. **A treasure hunt.** "Where's my kite?" The beam sweeps the room and stops on your couch, where the painted kite waits. Walk over and pinch it, or look at it and pinch to call it to you, and bring it back to the book.
4. **The night sky on your ceiling.** The room goes dark, stars and the moon come out overhead, Wick names the stars, and a shooting star crosses. "Make a wish!"
5. **The sea on your floor.** Watercolour waves wash across your floor and lap at your couch. A paper boat sails off the page onto it. The tide rises and falls.
6. **Things that leave the page.** Fireflies drift into the room and follow your hand. Gulls perch on your couch or a shelf. A bottle with a message washes up at your feet.
7. **Your window becomes the story's window.** Your real window shows the night sea, with the lighthouse beam passing outside.

## What the Quest 3 browser really gives us

Checked on Nov 14 against Meta's docs (metavr `vr_docs_search`) and the IWSDK 1.x types in `client/node_modules/@iwsdk/core`. Nothing here is from memory alone.

| Need | What exists | Source | What it means for us |
|---|---|---|---|
| **Room planes with labels** | Space Setup's planes come through WebXR plane detection: a pose, a polygon, horizontal or vertical. We already request `planeDetection` and read `semanticLabel` in `placement-runtime.ts` | [Mixed Reality Support in Browser](https://developers.meta.com/vr/documentation/web/webxr-mixed-reality) | Floor, walls, ceiling, window and door frames, wall art, and the flat tops of tables, couches, beds and shelves |
| **Which labels** | CEILING, DOOR_FRAME, FLOOR, INVISIBLE_WALL_FACE, WALL_ART, WALL_FACE, WINDOW_FRAME, COUCH, TABLE, BED, STORAGE (2D tops); LAMP, PLANT, SCREEN, OTHER (3D only) | [Using the Scene Model](https://developers.meta.com/vr/documentation/unity/unity-scene-build-mixed-reality) | **The ceiling exists in Space Setup.** Our contract's `RoomPlace` just lacks it. Lamps and plants have no flat top, so they only come through mesh detection |
| **Room mesh** | IWSDK supports a `meshDetection` feature: bounded 3D meshes with a label and box, plus one global room mesh | `@iwsdk/core` `scene-understanding/mesh.d.ts`, `init/xr.d.ts` | Optional. Gives lamps and plants a place, and the couch's real volume. Never needed for an effect to work |
| **Depth (occlusion)** | IWSDK's `DepthSensingSystem` and `DepthOccludable`. We have a review flag, `?occlusion=on` | `iwsdk-depth-occlusion` skill, `client/src/index.ts` | **Never checked on our headset** (P5 left it open). Rain, fog and the sea look wrong if they draw over a chair in front of them. First headset check below |
| **Passthrough pixels** | Not available to the page | Meta's MR browser doc: "There is no way to get to the pixels of the passthrough content" | Every effect is an overlay, like the room dim and the beam. We can darken, tint and lift the dim, never repaint your wall |
| **Light estimation** | Not in IWSDK's feature list | `init/xr.d.ts` | Not needed. Our dim layer decides how dark the room looks |
| **Spatial audio** | Web Audio's HRTF panner, already in our sound engine | `client/src/sound/engine.ts` | Rain all around you, thunder from the window, gulls from the couch: no new audio tech |
| **No Space Setup** | Planes are empty. The browser offers `initiateRoomCapture()` once per session | Meta's MR browser doc | Every effect needs a fallback with no planes at all (below). We don't trigger Space Setup mid-story; that's a v2 idea |

**One device check still needed:** which label strings Quest Browser really returns (for example `wall_face` or `wall`). Placement already filters `ceiling`, `couch`, `wall_art`, `window_frame` and `door_frame`, so lower-case Scene labels look right. The room map logs every label it sees in the first headset session, and maps both forms.

## The shared layer: one room-effects layer for chapters and the storyteller

```
 chapter beat or storyteller step
            │  { do: 'room', effect: 'rain', what: null, at: null }
            ▼
 show timeline ──► roomAt(timeline, ms) ──► what's on now (weather, sky, sea, hunt, visitors…)
                                                     │
 room map (planes, labels, fallbacks) ──────────────►│
                                                     ▼
                         room-fx views (one per effect, built before the show)
                         + the room dim shader (darkness, tint, flash, spot)
                         + sound engine (loops and one-shots, placed in the room)
```

- **One new stage action, `room`** (below). Chapters and the storyteller call the same thing, and the scheduler times it like every other action: `actionDuration` in `show/schedule.ts` gets a `room` case reading the contract's nominal times, or every later time in the beat would be broken. A gift that cuts a beat short stops its later `room` actions too, since they never start.
- **What's on is worked out from the timeline**, like the lamp today (latest `lamp-lit` after the latest `lamp-out`): weather, sky, sea, shadows, window. Pause, resume, checkpoints and "Read it again" bring these back with nothing new to save.
- **What you did is saved with the objects.** The timeline can't know you fetched the kite. Hidden things get a `room` home in `objects.ts`, which the runtime's checkpoint already saves with every object. "Found" means the object has left its room home. Waits (Moth fetching the kite after 20 s) run on the show clock, not wall time, so a pause doesn't use them up. A flight cut off by a restore lands at its end, as flights do today. Fireflies following your hand aren't saved: they simply gather again.
- **The room map** (`client/src/room-fx/room-map.ts`) keeps what Space Setup gave us: floor, ceiling, walls, windows, couches, tables, beds, shelves, and lamps and plants if mesh detection is granted. In world space for the effects, and as `RoomPlace` in stage space for the storyteller. Ticket 3 planned "a room registry" for the storyteller; this is it, so there is one.
- **Fallbacks, always.** Floor height comes from the `local-floor` space even with no planes. No ceiling means a dome 2.4 m above the floor. No wall means a fixed stand-in wall, placed once 2.5 m ahead when the book opens and staying put in the room (not the dim sphere, which follows your head and would make a shadow slide). The table under the book is known from placement. The painted room (no passthrough) uses its own floor and flats as walls.
- **What's possible here.** The room map says which effects this room supports. A window needs a window frame; the others always work through fallbacks. A chapter beat that names an unsupported effect is skipped quietly. The storyteller is only told about effects that are built, whose art and sound have loaded, and that this room supports.
- **Real furniture hides effects behind it.** Two layers, cheapest first. (1) The room map draws every plane and furniture box it knows (table tops, the couch's seat and, with mesh detection, its whole volume) into depth only, invisibly, before the effects. So rain behind your couch, or water under your table, is hidden by the couch and table themselves. (2) Depth sensing for everything else, if the headset check shows it's affordable. Its catch, flagged in the technical design: IWSDK injects depth into Three.js's built-in materials, so effect materials are built on those (as the card material is), never as fully custom shaders.
- **The app keeps the peace, not the AI.** One weather at a time. Rain clears the stars. At most two big effects at once, plus the beam. A new effect that breaks a rule ends the older one with a fade.
- **The room dim does the heavy lifting.** It gains a weather tint, a flash, a darker night, and a "spot" (a pool of light on a target). That's uniforms in the one sphere we already draw, so darkening the room costs no extra layer. The sphere is hidden in the painted room, so there the same four values drive the painted room's own light (`roomLook` in `room-view.ts`, which already dims it).
- **Sound that lasts.** The sound engine plays one-shots without a handle today. It gains a few named ambience channels (rain, wind, sea), each with a position and a fade. The runtime sets them every frame from what's on, so a restore brings the right loops back by itself. One-shots (thunder, a shimmer) stay sound marks from the timeline, which a restore already won't replay.
- **Closing the book pauses the room too.** Effects fade with the book, like the beam, and return when it opens.
- **Built before they're needed.** Every view and texture is made at load and hidden, since the Quest hitches when things are built mid-show (technical design).

Code lives in `client/src/room-fx/` (room map, `roomAt`, one view per effect), with hooks in `light/dim.ts`, `room/room-view.ts`, `show/schedule.ts`, `show/runtime.ts` (including characters turning toward a room place, not only toward you), `show/manifest.ts`, `show/sound-marks.ts`, `sound/engine.ts`, `objects/objects.ts` and `objects/hands.ts`. Nothing in `backend/src/storyteller/` or `client/src/storyteller/` until PR #9 merges.

## The new stage action

**In a chapter beat** (episode JSON, which the owner writes):

```json
{ "do": "room", "withPrev": false, "effect": "rain", "what": null, "at": null }
{ "do": "room", "withPrev": false, "effect": "hunt", "what": "object:kite", "at": "room:couch" }
{ "do": "room", "withPrev": true,  "effect": "gulls", "what": null, "at": "room:shelf" }
```

**As a storyteller step** (one line, like `CUE` today):

```
ROOM rain
ROOM hunt object:kite at:couch
ROOM stars-lantern
ROOM clear
```

- **`effect`** is one of a fixed list in contracts (below), so the validator can refuse anything else.
- **`what`** is an object or character on stage, for effects that use one (the hunt's kite).
- **`at`** is a place in your room: `room:couch` means "the couch, or the next best place", which a chapter can write without knowing your room. `room:couch-2` names one exact place from the room map, which only the storyteller sees. If the place isn't there, the app falls back along a list (couch, then bed, then shelf, then table, then floor beside you).
- **Timing**, as for every action: each effect has a nominal time in contracts (its fade-in or its whole run), and a lasting effect stays on after that until something changes it.
- **Characters can look at your room.** `Target` gains `room:<place>`, so `look:room:couch` works. Ticket 3's rules already tell the cast it can look at your couch, but nothing could point there yet.

**The effect list** (nominal ms): `rain` 3000, `snow` 3000, `fog` 4000, `thunder` 2500 (during rain), `clear` 3000, `night-sky` 4000, `stars-lantern`, `stars-kite`, `stars-fox` 3000 each (a constellation lights up), `shooting-star` 2500, `day` 3000 (sky off), `sea` 5000, `tide-in` and `tide-out` 6000, `boat` 8000, `bottle` 6000, `sea-off` 4000, `shadows` 1500, `shadows-off` 1500, `hunt` 8000, `fireflies` 3000, `fireflies-off` 2000, `gulls` 4000, `gulls-off` 2000, `window` 3000, `window-off` 2000.

## Each effect

Frame budget for the whole layer: today's builds run at a median 90 fps, lows 78–80, with 80–120 draw calls. The look bar needs at least 72 fps. Room effects get **at most 12 extra draw calls at a time in the view, no extra full-view blended layer beyond the dim, and under 1 ms of CPU a frame** (animation in shaders, instancing for anything numerous). Offscreen work has its own line: only shadow play has any (below). The invisible furniture depth costs one draw per plane or box, at most 8. Fades count: while one effect fades out and the next fades in, both are counted. Telemetry tags which effects were on, so every frame summary can be read per effect.

### 1. Weather

- **Rain.** About 1,200 painted streaks in one instanced draw, falling in a volume around you that ends at your walls (or 3 m out). The dim shifts to storm blue-grey and goes about 10% darker. **Thunder:** the dim lifts in a soft white-gold wash for about 0.3 s, so your walls seem to flash, from the window's side if there is one. At most one flash every 4 s, never a strobe (photosensitivity). Sound: a rain loop from four points around the room, thunder rolling from outside the window or far away.
- **Snow.** About 800 painted flakes in one draw. Where they land, a painted snow cover fades in on each horizontal surface the room map knows (your table, couch seat, bed, the floor), at most four, one draw each. With no planes, it settles on the book's table and a floor patch around you. Sound: a soft wind loop.
- **Fog.** One soft band of painted mist, 0 to 40 cm above the floor, drifting slowly, in one draw. Sound: a distant foghorn, which fits the lighthouse.
- **Behind your furniture:** rain and fog need occlusion most: the furniture depth from the room map, plus depth sensing if the headset check allows. See the test plan.
- **Art:** rain strokes, snowflakes, snow cover, fog wash (run 014). **Budget:** +1 to +5 draws.

### 2. Shadow play on your wall

- The light's shadow of the cast, cast on the nearest real wall facing you. At 12 poses a second (the cast's own rate), the cast's cards are drawn as dark silhouettes into a small 256 px picture from the light's point of view; one quad on the wall shows it, softened like a watercolour wash, slightly warm. Pip waves, and his giant shadow waves too, because it's his real cards.
- The shadow grows when the light is near a character and shrinks as it moves away, as real shadows do.
- **Which light:** the lit lantern, or the lighthouse lamp if no lantern is lit. Shadows end when the light goes out.
- **No wall found:** the shadow falls on the fixed stand-in wall 2.5 m ahead, which reads as a wall in a darkened room.
- **Art:** none. **Budget:** +1 draw in the view. Offscreen: one character's cards a frame (up to about 15 tiny draws into a 256 px picture, drawn once, not per eye), taking turns, so each shadow updates at the cast's own 12 poses a second or close to it, and each character's silhouette is frozen between its updates. That's the peak cost on any frame, measured in step 3. If lows drop under 72 fps, shadows update at 8 poses a second.

### 3. The treasure hunt

- The object (`what`) is moved off the page to the place (`at`) and hidden. The beam sweeps the room as it does now, slows, and stops pointing at that place. A soft gold spot opens in the dim there, and the painted kite lies on your couch, with a contact shadow on its seat.
- **Getting it back:** walk over and pinch it. Or, seated, look at it and pinch: it lifts and floats to your hand (the PRD keeps play seated and within reach, and selection always takes a pinch). Bring it to the book and hand it over as usual; the beam then goes back to turning.
- If you don't fetch it, after about 20 s of show time Moth flies out to it and brings it back.
- **What changes in the hands code:** objects gain a `room` home in `objects.ts` (with its contact shadow on the real surface), `grabTargets` includes room homes (today it only offers the drawer, page, table and satchel), and the seated look-and-pinch adds a flight to your hand. Let go of something far from the book and it settles on the nearest surface the room map knows under your hand (a table, the couch seat, the floor), instead of jumping back to the book's table as `hands.ts` does today. Let go near the book and it behaves as now.
- **Art:** none (the kite and the beam exist). **Budget:** +2 draws (the object and its shadow); the spot is a dim uniform.

### 4. The night sky on your ceiling

- The room goes to deep night (dim about 90%). Painted stars fade in across the ceiling plane, a few at a time, with a slow twinkle, and a painted moon rises in one corner. No ceiling found: a dome 2.4 m above the floor.
- **Constellations:** three fixed star pictures from the story's world: the Lantern, the Kite and the Fox. Each `stars-*` effect draws faint pencil lines between its stars and brightens them, so Wick can name one ("There. The Lantern. Old keepers steered by it.") and you see it.
- **Shooting star:** a painted star with a trail crosses overhead in about 2 s, with a soft shimmer.
- **"Make a wish!"** In the storyteller, Pip asks, the cast listens, and your wish becomes the story: ticket 3's PAINT step can paint the wished-for thing onto the page. In a written chapter, the wish is an `ask_reader` moment like any other.
- **Art:** star pieces, the moon, the shooting star and its trail (run 014). **Budget:** +4 draws.

### 5. The sea on your floor

- One mesh covers your floor (the floor plane's outline, or a 2.5 m circle around you), drawn with a painted water wash and slow waves in the shader. The water washes in from the far side over about 5 s.
- **It laps at your couch:** the footprints of the couch, table and bed are cut out of the water and edged with painted foam that moves with the waves. Because the water is cut around big furniture, it doesn't need depth occlusion for them.
- **Tide:** `tide-in` and `tide-out` move the wash line and the foam over about 6 s.
- **The paper boat:** a painted paper boat lifts off the page, drifts down off the table's edge like a leaf, lands on the water and sails a slow loop around you.
- **Sound:** a sea loop from the far side, and small laps near the furniture.
- **Art:** water wash, foam edges, the paper boat (run 015). **Budget:** +1 for the water, +2 for the boat.

### 6. Things that leave the page

- **Fireflies:** about 24 small warm glows (the lantern's glow, which you've already approved) drift off the page into the room. Near your hand, they gather and follow it slowly; move away and they wander back. One draw, no art.
- **Gulls:** two painted gulls fly in from the edge of the room and settle on the place you name (shelf, couch back, a table edge, the book's table if nothing else), then preen and look about. They're scenery, not cast: no voices, no lines. One draw each, plus a shadow.
- **The bottle:** a painted bottle washes up at your feet (on the sea if it's out, or simply rolls in across the floor). It's an ordinary library object, named in the action's `what`, so no new message field is needed. Pinch it (or look and pinch) and hand it to a character: that's the normal gift path. In a chapter, the scene's problem rule for the bottle's new `message` tag plays an authored beat in which the narrator reads the message. In the storyteller, the gift starts a turn and the cast reads a message written live.
- **Art:** the gull in three poses, the bottle (run 015). **Budget:** +1 (fireflies), +2 a gull, +2 the bottle.

### 7. Your window becomes the story's window

- The window frame from Space Setup gets a painted night scene that fills it exactly, a few millimetres in front of the glass: the shore's night sky, the headland and the lighthouse, the sea below. The lighthouse beam turns in the painting, timed with the book's beam.
- **Art:** none new. The shore's night sky and headland (run 004, run 011) already show the lighthouse over the sea, cropped to the window's shape for free.
- **No window frame in Space Setup:** the effect isn't offered. A chapter beat that asks for it is skipped, and the storyteller never hears of it.
- **Budget:** +1 draw.

## The storyteller's side (after PR #9 merges)

1. **A `ROOM` step** in `turn.ts`'s step format, parsed and checked against the effect list, the available list and the room map, like `CUE`. Its arguments are checked too: a hunt needs an object that's on stage, a `tide-in` needs the sea out, `thunder` needs rain.
2. **The request says what's possible and what's on:** only effects that are built, loaded and supported in this room, and what's showing now (for example "it's raining in the room; the sea is out"). The cast can't promise a window effect in a room without a window.
3. **The words wait on the effect.** A `ROOM` step joins the next spoken line's beat, as `MOVE` and `CUE` already do. If the `ROOM` step is refused, that next line is dropped with it, since it's the line describing the effect. So a refused effect can't leave a promise behind.
4. **Rules rewritten, not just added to.** Ticket 3's rules today say a character "who flies can fly to the window", but nothing can move a character off the book, so that line is what led to "circling your couch". It's replaced with: "Only say something happens in the reader's room when a ROOM step makes it happen, written just before the line that mentions it. Characters stay on the book; they can look at the room (look:room:couch)." Characters do turn toward a room place, since the runtime gains room targets for looking.
5. **Room places as names the cast can use:** "your couch", "the shelf by the window", never coordinates.
6. **A scripted check:** 20 room requests ("make it rain", "where's my kite?", "show me the stars", "fly to my window" in a room with no window) against the live storyteller, read by me, with no promise left without its effect. Not a unit test, and no paid credits beyond the usual Claude calls.

The ticket-3 session tells me when PR #9 merges. I rebase onto main then, and wire whatever effects are built by that time. Each later effect joins the list with no extra wiring.

## Order of build, smallest wow first

Each step ends with something you can see in the headset. Every step after 1 runs only once you've approved this plan.

| Step | What | Art or credits | You check in the headset |
|---|---|---|---|
| 0 | **Contracts PR** (below), its own small PR, merged first | None | Nothing |
| 1 | Room map, `roomAt`, the `room-fx` layer, the dim's new uniforms, review flags (`?room=rain` and so on) | None | With step 2 |
| 2 | **The treasure hunt.** Beam finds the kite on your couch; walk over or look and pinch | None | Does the beam stopping on your couch land? Also: labels logged from your room, and one `?occlusion=on` look |
| 3 | **Shadow play** | None | Does Pip's giant shadow on your wall feel like magic or like a glitch? |
| 4 | **Fireflies** | None | Do they feel alive around your hand? |
| 5 | **The storm:** rain, darkness, thunder, sound all around | Runs 014 and 016 | Rain in your room, with and without occlusion |
| 6 | **The night sky**, constellations, shooting star, the wish | Run 014 | Stars on your ceiling |
| 7 | **Snow and fog** | Run 014 | Snow on your table and couch |
| 8 | **The sea**, tide, paper boat, bottle, gulls | Runs 015 and 016 | The sea on your floor, lapping at your couch |
| 9 | **The window** | None (reused art) | Your window shows the night sea |
| — | **Storyteller wiring**, as soon as PR #9 merges | None | "Make it rain" works, and no promise is left empty |

Why this order: steps 2 to 4 need no new art and no credits, and the hunt builds straight on the beam you already loved. The storm is the biggest single wow, so it comes right after the free ones. The sea is the most art and code, so it's later. The window is cheap but only works in rooms with a window frame, so it's last.

## Contracts change (one small PR, merged before any feature code)

- `StageAction` gains `{ do: 'room', withPrev, effect: RoomEffect, what: EntityRef | null, at: RoomRef | null }`, with the effect list and nominal times as constants beside `MOVE_MS`.
- New `RoomRef`: `room:<label or place id>`. `Target` accepts it too, so characters can look at your room.
- `RoomPlace.label` gains `ceiling`.
- `StageNow` gains `roomFx: { on: RoomEffect[], available: RoomEffect[] }`.
- `checkBeat` takes the room map's places, so a `room` action naming an unknown exact place is caught; label refs always pass, since they fall back.
- Telemetry gains `room_fx { effect, on }`, so frame summaries can be read per effect.
- `data/tags.json` gains a `message` tag ("carries words for someone"), for the bottle.
- `CONTRACT_VERSION` goes from 3 to 4. Ticket 3's contracts are already merged (PR #10), so this doesn't collide with PR #9. If the product workspace has a contract PR open at the same time, we go one after the other, as before.

## Art runs (each gets its own `plan.json` before any credits, per `art/README.md`)

**Reuse first:** the window is cut from the shore set for free, fireflies use the lantern glow, shadows come from the cast's own cards, and the hunt uses the kite and the beam.

| Run | What it answers | Pieces | Painter | Cap |
|---|---|---|---|---|
| **014 room weather and sky** | Can rain, snow, fog and stars be painted pieces in the book's watercolour style that still read at room scale? | Sheet 1 (2K, magenta paper): 8 rain strokes, 8 snowflakes, 4 fog washes. Sheet 2 (2K): 6 star shapes, the moon, a shooting star with trail. One 1K snow-cover wash, made tileable for free with an offset blend | `seedream5_pro` | 35 credits |
| **015 sea and visitors** | Can the floor read as painted water, with foam that holds up at your feet? | Sheet 1 (2K, magenta): 6 wave-crest strokes, 4 foam edges. Sheet 2 (2K): paper boat (two angles), bottle with a rolled message, gull perched, wings up, wings down. One 1K water wash, made tileable for free | `seedream5_pro` | 35 credits |

**How we decide:** each piece cuts out cleanly with `cutout.py`, reads on the Mac proof page in a photo of a real room, then you approve it in the headset. What stays reusable: every piece is a plain cut-out that any later chapter can use.

**Sound (run 016):** Freesound CC0 first, for free. Runway sound effects (1 credit a requested second) only for what CC0 can't cover:

| Clip | Length | Runway credits if needed |
|---|---|---|
| Rain loop | 20 s | 20 |
| Thunder, three rolls | 6 s each | 18 |
| Soft wind loop (snow) | 15 s | 15 |
| Distant foghorn | 6 s | 6 |
| Sea loop | 20 s | 20 |
| Small laps, two | 4 s each | 8 |
| Gull calls, two | 4 s each | 8 |
| Bottle on sand, a shimmer, a twinkle | 2–3 s each | 8 |
| **All of it** | | **103** |

Cap 110. Every clip gets run 009's finishing pass (levels vary by 20 dB or more), loops get a crossfaded seam, and each CC0 clip's source and license goes in the run's manifest and `CREDITS.md`. The run closes with `results.md`, as every run does.

**Total asked: up to 180 Runway credits** (about $1.80), never spent without your yes and a clear window on the shared account. No ElevenLabs spend.

## Test plan

- **Kept green, no new tests:** `pnpm test`, `pnpm typecheck` and `pnpm build`, after every step.
- **On the Mac:** each effect from its review flag in the IWSDK emulator's living room (which has planes), checked against the look bar with one screenshot. Then with no planes at all, to see every fallback. Then the painted room (no passthrough).
- **The timeline:** pause, resume and "Read it again" mid-effect, in the emulator: the effect comes back exactly as it was, with no repeated sound.
- **Frame rate:** telemetry from your headset sessions, per effect. At least 72 fps with the busiest pair on (the storm and shadows), or the effect is thinned before it ships.
- **Occlusion:** one look at `?occlusion=on` in step 2, then rain with the furniture depth alone and with depth sensing too, in step 5. If depth sensing costs too much or its edges look bad, we keep the furniture depth only, and keep rain and fog off things the room map doesn't know: rain falls in the upper room (from the ceiling to about 1.2 m, fading out), where unscanned furniture rarely reaches, and fog stays low and very soft.
- **The scheduler:** the existing show simulator plays a chapter with `room` actions in it, including a gift that cuts one off, to check the timing holds. That's running the simulator we have, not new tests.
- **The storyteller:** the scripted 20-request check, then you, asking for effects out loud.
- **The headset:** before I bring it in, I check no other session is mid-test. I don't close other tabs, and I only remove my own `adb reverse` ports (this workspace's are in `.env.ports`: 5130 and 5131). Each step's check is in the build-order table.

## Risks and fallbacks

| Risk | If it happens |
|---|---|
| Rain draws over a chair in front of the wall that Space Setup doesn't know, and depth sensing is too costly or blotchy | Furniture depth hides scanned things; rain keeps to the upper room |
| The storyteller describes an effect anyway | Its line is dropped with the refused step; the scripted check catches the rest before you play |
| Your room's labels differ from the docs' names | The room map logs them in step 2 and maps both forms |
| No Space Setup | Every effect but the window works through fallbacks |
| Shadow pass causes a hitch | Split the silhouette pass across frames, or drop to 8 poses a second for shadows |
| Too many effects at once | The app's rules cap it at two big effects plus the beam |
| A painted piece looks like clip art in a real room | It doesn't ship (no test visuals). Repaint once inside the run's cap, or cut the piece |

## Questions for you

1. **May I spend up to 180 Runway credits** (art runs 014 and 015, at most 35 each, and sound run 016, at most 110, CC0 first)? I'll ask for a clear window on the shared account before each.
2. **Chapter 1:** the opening already has a storm that blows out the lamp. Should the room storm play there too? Chapter 1 is signed off, so I won't touch it unless you say yes. Otherwise, effects show up in the chapters you're writing and in the Storyteller.
3. **Shadows:** only when a beat calls for them (my default), or always whenever a light is lit and a wall is found?
4. **The hunt, seated:** look and pinch to call the object to you (my default, alongside walking over)?
