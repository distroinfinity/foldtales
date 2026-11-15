# Chapters 2 and 3: the story

Lane B of the finish sprint (`docs/plans/2026-11-15-finish-sprint.md`), branch `finish-chapter-2`. **Stage 1: the story**, for Codex review and the sprint master's approval. Stage 2 (the build plan, art and voice runs) comes after.

One writer for both chapters, so the book holds together. Lane B builds chapter 2 and the engine for several chapters; lane C builds chapter 3 from this file once it's approved.

## The bar each chapter meets

Chapter 1's bar, from the brief: about six minutes, hands only, a hand moment on every spread, completable silently, a wow by minute 1, and a payoff at the end. Plus what playtests taught us:

- **Three spreads, two turns by hand.** A long first spread felt "unnecessarily long" (ticket 2, session 1), so each first spread gets its hand moment early.
- **Each spread a new place.** "The shore felt like a new place" was what landed.
- **The help must feel needed.** Every hand moment is something a character truly can't do alone, and what you give changes how it's done.
- **Lines are written against 1.3× the caption estimate** (run 010). The timings below use that.
- **Room effects are spent, not sprinkled.** The owner wouldn't fill chapter 1 with them; each later chapter gets one family of effects that belongs to its story.

## The arc across the book

*Tales from the Table's Edge* has one arc, written in the design language: **Pip learns the dark, and Wick learns to hand over the lamp.** Each chapter moves both halves one step.

| | Pip and the dark | Wick and the lamp | The room |
|---|---|---|---|
| **1. The night the light went out** (built) | Goes into the dark, **carrying his light**, to bring the wick home | Admits his eyes "aren't what they were". Calls Pip "keeper", half in jest | The beam sweeps the room |
| **2. The night the sea came in** | Stands in the dark **without his light**, so someone lost can see it | Can't read a letter. Sends Pip down as "my eyes", and has him write in the keeper's log | The sea floods your floor; a bottle washes up at your feet; a lost boat circles you; glow-worms rise |
| **3. The longest night** | Goes into the longest night to bring **Wick** home, and becomes "bigger than the dark" | Gets lost himself. Hands Pip the lamp and the log for good, and names Pip's star | Snow falls round you; a lost thing hides in your room; Pip's shadow fills your wall; the stars come out on your ceiling, then the dawn |

**The thread that ties them:** "every lost thing follows the light home." Chapter 1 ends with "something lost turned toward the light, and started for home." Chapter 2 is that something: **Thimble**, a field mouse from the sewing basket Pip found on the shore ("Somebody's whole sewing basket washes up down here"), lost at sea in a paper boat. Chapter 3 turns it round: the keeper himself is the lost thing, and the light Pip keeps brings him home.

**The book's bookends:** chapter 1 opens with the lamp blown out against everyone's will. Chapter 3 ends at dawn with Pip putting it out himself, for the first time, because the night is over.

**Refrains, so the chapters rhyme (and some lines are already voiced):** "a hundred and twelve steps"; "Same time tomorrow, keeper?"; "Hold still … and catch" (Wick to Pip in chapter 1, Pip to Thimble in 2, Pip to Wick in 3); "Don't look down"; "whoever you are"; the chapter-end line about what the book keeps.

### Who's in it

| Character | Chapters | Notes |
|---|---|---|
| Pip | 1, 2, 3 | Unchanged |
| Wick | 1, 2, 3 | Unchanged. His logbook (`art/cast/wick/parts/logbook.png`) becomes an object the story uses |
| Moth | 1, 2, 3 | Still silent. Gets the hero branch of chapter 2 (if you don't help, Moth carries the light up) |
| **Thimble** (new) | 2, 3 | A young field mouse, about 7 cm tall (Pip is 17), in a sailor's knitted jersey and a thimble worn as a hat. From the sewing basket. Small, bright and brave, with a sailor's manners ("Much obliged"). Speaks. New art: one parts sheet and one heads sheet, the recipe from run 003 (about 10 credits). Voice from the closed list; run 005 already auditioned three small bright voices for Moth (`art/runs/005-voice-audition/moth-*.mp3`) |

Thimble is the only new character. A visitor who stays is the PRD's "keepsakes come back … its owner has come looking", and she gives chapter 3 its keeper-of-the-lamp while Pip is away.

### Sets across the book

| Set | Ch 1 | Ch 2 | Ch 3 |
|---|---|---|---|
| The lamp (`the-lamp`) | Spread 1 | Spread 1 | Spread 1, snowy |
| The shore path (`shore-path`) | Spread 2 | Spread 2, at the water's edge | — |
| The gap (`the-gap`) | Spread 3 | — | Spread 3, snowy |
| **The landing** (new) | — | Spread 3 | Spread 2, snowy |

**The landing** is the one new place: the foot of the lighthouse, where stone steps go down into the sea between dark rocks, and the store where the oil is kept. It reuses the shore path's night sky and headland (as the gap does), so the lighthouse and the beam's origin don't move, and needs a printed ground and two standing layers. Chapter 2 needs it so its last spread is somewhere new; chapter 3 reuses it. How snow goes on a page (run 014's `snow-cover.png` over the set, or repaints) is lane C's art call.

### What carries from chapter to chapter

Two things already exist: **facts** (`episode-1.canon.json`, recorded at a chapter's end from which beats played) and **the satchel** (what you kept). The engine work (stage 2) makes later chapters read both.

| From | Carries | How the next chapter uses it |
|---|---|---|
| Ch 1 | `crossing` = kite, thread, ladder or rope | One line from Pip near the start of chapter 2 remembers it (four variants; none if chapter 1 wasn't played here) |
| Ch 1 | The satchel: kite, spool, ladder, sock or key, whatever you kept | Usable in chapter 2's hand moments. Things you didn't keep are **still lying where you left them** on the shore. The spool is Thimble's grandmother's thread, and handing it to her is its own branch |
| Ch 2 | `light-high` = kite, ladder, key or moth; `landing` = thread, rope, ladder, boat or tide; `log` = pip | Thimble's first line in chapter 3 remembers how she came in (three variants and a default) |
| Ch 2 | The satchel, now with the bottle and anything else used | Usable in chapter 3 |
| Ch 3 | `keeper` = pip | The end of the book's arc. The contents page shows it |

A chapter played without the one before still works: every variant has a default, and the drawer has an answer for every hand moment.

**One rule for things in two places:** a set or drawer object whose kind is already in your satchel isn't placed again. It's in your satchel because you kept it.

---

## Chapter 2: The night the sea came in

**Premise:** The next night, the tide comes further than it ever has, right across the Reader's floor, and a bottle washes up at the Reader's feet. Inside is a letter from Thimble, lost on the water and following the light. Wick can't read it, and can't see a boat at sea. So Pip goes down to the dark water's edge to be the keeper's eyes and bring her home.

**Target:** 5:00 to 7:00, aimed at about 6:00 (5:40 for a quick reader, 6:45 on the slowest path). Cast: Pip, Wick, Moth, Thimble. Sets: the lamp, the shore path, the landing.

| Spread | Set | Hand moment | Room | Clock (quick reader) |
|---|---|---|---|---|
| 1. The letter | The lamp | Pick up the bottle from **your floor** and pass it up | The sea floods your floor (0:42); a bottle washes up at your feet (0:52) | 0:00–2:05 |
| 2. The light on the water | The shore path, night | Help Pip get his light **up high** where Thimble can see it | A paper boat sails, lost, in a circle round you | 2:05–3:50 |
| 3. The landing | The landing (new) | Bring Thimble in off the rocks before her paper boat sinks | The tide; the sea goes back out; glow-worms rise into the room; the beam | 3:50–5:40 |

**The wow by minute 1:** the beam at 0:05 as in chapter 1, then at about 0:42 the sea washes in across the reader's real floor, and at 0:52 a bottle bumps against their feet. It has never happened in chapter 1, and it belongs to this story.

**The payoff:** Thimble steps onto dry land, Pip writes her into the keeper's log because Wick can't, the sea draws back out of your room, and glow-worms (the fireflies effect) rise off the page to see who came home, under the beam.

### Spread 1: The letter (the lamp)

**Beat `opening`** (about 55 s)
- *Book opens; lamp lit; gold light; the beam sweeps the room.* Pip at his mark, Wick by the lamp, Moth at the lamp (new mark; Moth has moved in as close to the lamp as a moth can get).
- **Narrator** (wonder): "The next night, the lamp was burning bright. And on the gallery stood a new keeper. A very small one, in a very big coat."
- *Pip looks up at you.* **Pip** (wonder, to reader): "You came back! Wick, look, they came back!"
- **Wick** (warm, to reader): "Hmph. So they did. Evening, whoever you are."
- **Carry, one of** (by chapter 1's `crossing`; none if there's no fact):
  - kite: **Pip**: "I still dream about flying over the gap on that kite."
  - thread: **Pip**: "Moth's still ever so proud of carrying that thread across."
  - ladder: **Pip**: "I keep thinking about that ladder. Right across the gap!"
  - rope: **Pip**: "Wick says next time I go over a gap, I'm to bring my own rope."
- **Pip** (wonder, to Wick): "Can I trim the wick tonight, Wick? Please?" *(chapter 1's line, already voiced)*
- *Wick grumbles, then gives way.* **Wick** (warm): "Go on, then. Carefully, mind."
- *Pip examines the lamp: the trim, a small spark.* *Wick grumbles approvingly.*
- **Narrator** (wonder): "That night, the sea came in further than it ever had. Up the shore, up the rocks, and right across the Reader's floor." *With it:* `room sea`.
- **Pip** (wonder, looking down past you): "The sea's come right in! And look, something's washed up by your feet!" *With it:* `room bottle` (what: `object:bottle`, at: null, so at your feet).

**Beat `bottle-ask`** *Pip looks at you.* **Pip** (asks, problem `the-letter`, waits 16 s): "Can you pass it up to us?"

**Problem `the-letter`:** "A bottle with a letter has washed up at the Reader's feet." Rules: `message` → `letter`. Fallback → `letter-puzzled`. Ignored after 16 s → `letter-tide`.

**Beat `letter`** (you passed it up). *Pip takes it, turns it over.* **Pip** (wonder, to reader): "A bottle, with a letter in it! Thank you!" → `letter-read`

**Beat `letter-puzzled`** (you gave something else). *Pip takes it.* **Pip** (silly, to reader): "Oh, thank you! But that's not what washed up." *Sets it down.* **Pip** (to reader): "It's still down there, by your feet. A bottle, see?" *Waits 11 s.* → `letter-tide`

**Beat `letter-tide`** (nobody did). **Narrator** (silly): "But the tide, as tides do, brought the bottle the rest of the way by itself." *The bottle drifts up out of the room onto the page, as the hunt's lost thing does.* *Pip takes it.* **Pip** (wonder): "A bottle! And there's a letter in it!" → `letter-read`

**Beat `letter-read`** (about 30 s)
- **Pip** (wonder, to Wick): "Wick, it's a letter! Read it, read it!" *Gives the letter to Wick.*
- *Wick holds it close to his spectacles, then at arm's length, then close again.* **Wick** (sad, quietly): "Hmm. The light's poor up here tonight. You read it, lad." *Gives it back.*
- *The reader can see the light is bright. Nobody says so.*
- **Pip** (tense, reading): "'To whoever keeps the light: I'm lost on the water. I can see your light go round, but the rocks keep turning me back. Please keep shining. Thimble.'"
- *Resolve `the-letter`.*

**Beat `who-goes`** (about 40 s)
- **Pip** (wonder, to Wick): "She's out there, Wick! She's following our light!"
- **Wick** (neutral): "The light can bring her to the rocks. Past them, someone has to be at the water to call her in."
- **Wick** (silly): "I'd go. But I couldn't see a paper boat if it sailed up my nose."
- *Wick looks at Pip.* **Wick** (warm): "Somebody's got to be my eyes, lad."
- *Pip, scared.* **Pip** (tense): "Down to the water? In the dark? On my own?"
- *Pip looks up at you.* **Pip** (warm, to reader): "Not on my own. You'll come, won't you?"
- **Narrator** (warm): "So down went the little fox, a hundred and twelve steps, to the very edge of the sea."

**Beat `page-one`:** the corner lifts; you turn the page.

### Spread 2: The light on the water (the shore path, night)

On the sand, **still where the tide left them**: the kite and the spool, unless they're in your satchel. The sea is still across your floor.

**Beat `page-turn-shore`:** the page turns; Pip in at the shore; Moth comes with him.

**Beat `the-water`** (about 40 s)
- *Pip walks down to the water's edge (new mark on the shore set).*
- **Narrator** (tense): "At the water's edge, the dark was very big, and the sea was very loud."
- `room boat`: *a paper boat sails a slow circle round you on the floor's sea.*
- **Pip** (wonder, looking out into your room): "There! A little paper boat! Going round and round..."
- *Pip raises the lantern.* **Pip** (tense): "Thimble! Over here! Thimble!"
- **Narrator** (neutral): "But the sea was loud, and the lantern was low, and the little boat went round again."
- **Pip** (sad): "She can't see me. My light's too low down here."

**Beat `light-ask`** *Pip looks up at you; the drawer opens.* **Pip** (asks, problem `too-low`, opens the drawer, waits 22 s): "Is there anything that could get my light up high, where the whole sea can see it?"

**Problem `too-low`:** "Pip's lantern is too low for Thimble to see past the rocks." Rules, in order: `flies` → `high-kite`; `climbs` or `spans` → `high-ladder`; `shiny` → `high-key`. Fallback → `high-puzzled`. Ignored after 22 s → `high-moth`.

**Beat `high-kite`** (a kite). *Pip takes it, ties the lantern to it; the kite rises with the light high over the shore, and Pip is left holding the string in the dark.* **Pip** (wonder): "A kite! Up you go, little light!" **Pip** (wonder): "Up, up, up! Higher than the rocks!" → `she-sees`

**Beat `high-ladder`** (a ladder). *Pip stands it up on the rocks and climbs, lantern held high at the top.* **Pip** (wonder): "A ladder! If I stand it up on the rocks..." **Pip** (tense): "Don't look down. Don't look down. Don't look down." *(chapter 1's line, already voiced)* → `she-sees`

**Beat `high-key`** (something shiny). *Pip holds it up and catches the great lamp's beam in it; a glint flashes out over the water.* **Pip** (wonder): "A key? Oh! It's ever so shiny." **Pip** (wonder): "If I catch the big light in it... there! Like a star, winking at her!" → `she-sees`

**Beat `high-puzzled`** (something else). *Pip takes it, turns it over, sets it down.* **Pip** (silly, to reader): "Oh, that's lovely. But it won't get my light up high." **Pip** (tense, to reader): "Something that flies, maybe? Or something to climb?" *Waits 11 s.* → `high-moth`

**Beat `high-moth`** (nobody helped, or nothing worked). **Narrator** (silly): "Now, if there's one thing a moth knows, it's how to get close to a light." *Moth takes the lantern's handle and flutters straight up with it, high over the shore. Pip is left in the dark.* **Pip** (tense): "Moth! Where are you taking my... oh!" **Pip** (relief): "Oh, Moth. You clever, clever moth." → `she-sees`

**Beat `she-sees`** (about 30 s)
- **Narrator** (wonder): "Far out on the water, the little boat stopped going round. And turned. And came, slowly, toward the light."
- **Pip** (tense): "It's very dark down here. But she can see the light. That's what matters."
- *Pip looks up at you.* **Pip** (sad, to reader): "I'm still a little bit scared. Is that all right?"
- **Narrator** (warm): "It was. Being a little bit scared is mostly what brave is made of."
- *The light comes back down to Pip (kite lowered, Moth returns it, Pip climbs down).* *Resolve `too-low`.*
- **Pip** (warm): "Come on, Moth. She'll come in at the landing."

**Beat `page-two`:** the corner lifts; you turn the page.

### Spread 3: The landing (the landing, new)

**Beat `page-turn-landing`:** the page turns; Pip in at the top of the steps; Moth with him. Thimble on the rocks, standing in her paper boat (a copy of the `paper-boat` object, at a new mark out on the water).

**Beat `the-rocks`** (about 30 s)
- **Narrator** (tense): "The little boat came in out of the dark, right up to the rocks. And there it stuck."
- *Thimble waves.* **Thimble** (wonder): "Ahoy! Ahoy, the light!"
- **Pip** (wonder): "Thimble? Are you Thimble?"
- *Her boat sags and tips (new small cue: a paper boat going soft).* **Thimble** (tense): "Thimble, from the sewing basket! But my boat's gone soft. Paper boats aren't made for the whole sea."
- *Pip looks up at you.* **Pip** (tense, to reader): "She's stuck on the rocks, and her boat's sinking!"

**Beat `rescue-ask`** *The drawer opens.* **Pip** (asks, problem `the-rocks`, opens the drawer, waits 22 s): "Have you got anything that could bring her in?"

**Problem `the-rocks`:** "Thimble's paper boat is sinking on the rocks below the landing." Rules, in order: `thread` (the spool; a new tag on it) → `in-by-thread`; `rope` → `in-by-rope`; `spans` or `climbs` → `in-by-ladder`; `floats` → `in-by-boat`; `flies` → `in-by-kite`. Fallback → `rocks-puzzled`. Ignored after 22 s → `rocks-tide`. Every one but the fallback ends with Thimble on the bottom step.

**Beat `in-by-thread`** (the spool). *Pip throws the end; Thimble catches it, and Pip hauls her across on the thread (chapter 1's thread span).* **Thimble** (wonder): "That thread! That's my grandmother's thread, from the basket!" **Pip** (warm): "Then hold on tight, and we'll pull you in with it!" → `ashore`

**Beat `in-by-rope`** (a rope). *Pip throws it, the rope span reaches the rock, and Thimble comes across paw over paw.* **Pip** (warm): "Hold still, Thimble. And catch!" **Thimble** (tense): "Steady as she goes! Steady as she goes!" → `ashore`

**Beat `in-by-ladder`** (a ladder). *Laid from the step to the rock as a bridge; she scampers over.* **Pip** (wonder): "A ladder! Lay it across to the rock, like a bridge!" **Thimble** (tense): "Mind the gaps between the rungs. Mind the gaps..." → `ashore`

**Beat `in-by-boat`** (something that floats: the paper boat, the bottle, an umbrella if it's in the library). *Pip pushes it out; she hops in and rows to the step.* **Pip** (wonder): "A new boat! Hop in, Thimble!" **Thimble** (silly): "Now that's a boat that floats! Row, row, row!" → `ashore`

**Beat `in-by-kite`** (a kite). *She grabs the tail and the wind carries her over (chapter 1's kite crossing).* **Pip** (wonder): "Grab the tail, Thimble! The wind'll do the rest!" **Thimble** (wonder): "I'm flying! A sailor, flying!" → `ashore`

**Beat `rocks-puzzled`** (something else). *Pip takes it, sets it down.* **Pip** (neutral): "That won't reach her, I don't think." **Pip** (tense, to reader): "Something long, maybe? Or something that floats?" *Waits 11 s.* → `rocks-tide`

**Beat `rocks-tide`** (nobody did). **Narrator** (wonder): "And then the sea, which had been so cross all night, gave one last great heave..." *With it:* `room tide-in` (the sea on your floor rises). **Narrator** (warm): "...and set the little mouse down on the steps, as gently as anything." *Thimble lands on the bottom step.* → `ashore`

**Beat `ashore`** (about 50 s)
- *Thimble hops.* **Thimble** (relief): "Land! Real, dry, stay-where-it-is land!"
- *She shivers.* **Thimble** (silly): "Brr. I'm wet right through to my whiskers."
- **Pip** (warm): "Here, get in my coat. It's far too big for me anyway." *Thimble moves to a mark at Pip's side, half inside his coat's hem.*
- *Wick comes down the steps (placed at a new mark at the top of the steps).* **Wick** (neutral): "Pip? I could hear you all the way from the top."
- **Pip** (relief, to Wick): "Wick! She's here! The light brought her home!"
- *Wick peers very close at Thimble.* **Wick** (warm): "Hmph. A mouse in a paper boat. Across the whole sea."
- *Wick takes out his logbook.* **Wick** (warm): "Welcome home, little one. Every lost thing that comes home goes in the log."
- *He holds it out to Pip.* **Wick** (warm): "You write her in, lad. You were my eyes tonight."
- **Pip** (wonder): "Me? In the keeper's log?"
- *Pip writes.* **Pip** (warm): "'Thimble, from the sewing basket. Came home by the light.'"

**Beat `homecoming`** (about 35 s)
- `cue beam` (the lamp's beam sweeps the room), and `room tide-out`.
- **Narrator** (warm): "And the sea, its work done, slipped quietly back out past the edge of the table." *With it:* `room sea-off`.
- `room fireflies`. **Narrator** (wonder): "And all along the shore, the glow-worms came out, to see who had come home."
- *Thimble looks up at you.* **Thimble** (wonder): "Is that the Reader? The one who reaches down from the sky?"
- **Pip** (warm): "That's them. They helped bring you in."
- **Thimble** (warm, to reader): "Much obliged, Reader. Truly."
- **Wick** (warm, to Pip): "Same time tomorrow, keeper?" **Pip** (relief): "Same time tomorrow." *(chapter 1's lines, already voiced)*

**Beat `chapter-end`**
- `cue keep`. **Narrator** (warm): "And whatever the Reader gave that night, the book kept safe, for another time." *(chapter 1's line, already voiced)*
- **Narrator** (wonder): "But the nights were growing longer, and the old keeper's eyes were growing dimmer. And the longest night of all was on its way."
- `room fireflies-off`, `cue chapter-end`.

### Chapter 2's bridges (narrator, for a late beat)

- "Out on the dark water, a paper boat bobbed, and waited, and hoped."
- "The sea breathed in, and the sea breathed out."
- "Up at the top of the lighthouse, the great lamp went round, and round."

### Chapter 2 at a glance

**What you hand over:** the bottle, from your own floor (or it drifts up by itself); something to lift the light (the kite on the sand, a ladder or a key from the drawer, or what you kept in your satchel; or nothing, and Moth does it); something to bring Thimble in (the spool, Wick's rope, the ladder, the paper boat, the bottle, a kite; or nothing, and the tide does it).

**Branches:** 4 opening variants (by chapter 1) × 3 at the bottle × 5 at the light × 7 at the rocks. Every path ends with Thimble home, the log written and the glow-worms.

**What it records** (`episode-2.canon.json`):

| Key | Values (by beat) | Text |
|---|---|---|
| `letter` | `reader` (letter) / `tide` (letter-tide) | "The Reader passed Thimble's letter up from the sea." / "The tide brought Thimble's letter up to the lighthouse." |
| `light-high` | `kite` / `ladder` / `key` / `moth` | "Pip's light went up on a kite, high over the shore." / "Pip climbed a ladder on the rocks and held his light high." / "Pip caught the lamp's beam in a key and flashed it out to sea." / "Moth carried Pip's light up high, and Pip stood in the dark." |
| `landing` | `thread` / `rope` / `ladder` / `boat` / `kite` / `tide` | One sentence each, as in the beats |
| `thimble` | `home` (ashore) | "Thimble came home to the Lost and Found by the light." |
| `log` | `pip` (ashore) | "Pip wrote in the keeper's log for the first time." |

History for kept things: the bottle ("Washed up at the Reader's feet with Thimble's letter inside, the night the sea came in."), the spool ("Thimble's grandmother's thread. It pulled her in off the rocks."), and one each for the kite, ladder, key, paper boat and rope when used.

**Room effects used** (all built and approved): `sea`, `bottle`, `boat`, `tide-in` (the tide path only), `tide-out`, `sea-off`, `fireflies`, `fireflies-off`, plus the lamp's own `beam` cue. One big effect at a time (the sea), so the app's rules never fade anything early. No weather: chapter 1 had the storm, chapter 3 has the snow.

**What it needs**

| Kind | What | New or reused |
|---|---|---|
| Character | **Thimble**: parts sheet, heads sheet, rig, voice | New (about 10 credits of art, plus a free pick from run 005's auditions) |
| Set | **The landing**: printed ground and two standing layers (the steps and near rocks; the far rocks), with the shore's sky and headland | New (about 30 credits) |
| Sets | The lamp, the shore path (new marks: Moth at the lamp, the water's edge, Wick's exit) | Reused |
| Objects | `bottle`, `paper-boat`, `kite`, `spool` (plus a `thread` tag), `ladder`, `brass-key`, `rope-coil`, `odd-sock`; Wick's logbook as an object (from his rig's part) | Reused. The umbrella from run 013 joins only if it passes the look bar as is |
| Cues | Lift the light (kite, ladder, key's glint, Moth carrying it); a paper boat going soft; crossings with Thimble as the traveller, from a mark on the water to the step; a boat rowed in; the bottle drifting up to the page; Thimble tucked at Pip's side | New engine work, mostly built on chapter 1's crossings |
| Sound | A soggy-paper squelch, a small splash, Thimble's shiver; the sea's wash and the bottle's clink exist (run 016) | About 8 credits |
| Voices | About 71 new lines with the bridges (Pip 37, narrator 17, Wick 10, Thimble 7), 5 reused from chapter 1 | About 71 credits |

---

## Chapter 3: The longest night

Lane C builds this chapter on lane B's engine. Every line is here; the build, timings and art runs are lane C's.

**Premise:** On the longest night of the year, snow comes to the edge of the table. The lamp needs every drop of oil to last till morning, so Wick goes down to the store for more, and doesn't come back. Thimble keeps the light while Pip goes out into the snow, finds that the old keeper is lost, and brings him home. Under the stars, Wick hands Pip the lamp and the log, and names Pip's star.

**Target:** about 6:00. Cast: Pip, Wick, Moth, Thimble. Sets: the lamp (snowy), the landing (snowy), the gap (snowy).

| Spread | Set | Hand moment | Room | Clock (quick reader) |
|---|---|---|---|---|
| 1. The frost | The lamp | Wipe the frost off the lamp's glass so the light can get out | Snow falls round you and settles on your table (0:15) | 0:00–2:00 |
| 2. Lost in the snow | The landing | Find what glints **in your room**, and bring it back | The beam hunts your room for Wick's logbook; Pip's shadow fills your wall | 2:00–3:40 |
| 3. Home by the light | The gap | Help Pip get Wick across the gap | The snow clears; stars, the Lantern, the Kite and a new Fox come out on your ceiling; a shooting star; then the dawn | 3:40–6:00 |

**The wow by minute 1:** snow falling round you and settling on your real table while the beam sweeps (approved: "Ring of snow, it looks very nice"). **The payoff:** the stars on your ceiling, Wick naming them by heart, Pip's own star, and the room going to dawn as the new keeper puts out the lamp.

### Spread 1: The frost (the lamp, snowy)

**Beat `opening`** (about 55 s)
- *Book opens; lamp lit; gold; the beam.* `room snow`. Pip, Wick and Thimble on the gallery, Moth at the lamp.
- **Narrator** (wonder): "On the longest night of the year, the snow came all the way to the edge of the table."
- **Pip** (wonder, to reader): "Snow! It's snowing on the Reader too! Look!"
- **Carry, one of** (by chapter 2's `landing`):
  - thread: **Thimble** (warm): "I've wound Grandmother's thread back on its spool. Every inch of it."
  - rope: **Thimble** (silly): "The last time I was this cold, somebody threw me a rope."
  - ladder: **Thimble** (silly): "The last time I was this cold, I crossed a ladder to get home."
  - anything else, or none: **Thimble** (wonder): "I've never seen snow from dry land before!"
- *Wick peers at the lamp.* **Wick** (neutral): "Longest night of the year. She'll need every drop of oil to see the morning."
- **Wick** (neutral): "And there's not enough up here. I'll fetch more from the store at the bottom."
- **Pip** (tense): "I'll go! You can't see the steps in the..."
- *Wick grumbles.* **Wick** (warm): "Forty winters I've walked those steps, lad. I don't need eyes for them."
- **Wick** (warm): "You stay with the light. A keeper never leaves the light."
- *Wick walks off the page by the stair (new mark).* **Narrator** (neutral): "And down he went, one paw on the wall, counting every step."
- *The lamp's glass frosts over (new cue); the light drops to dusk and the beam fades.* **Pip** (tense): "The glass is frosting over! The light can't get out!"
- **Thimble** (tense): "And Wick will need it to find his way back!"

**Beat `frost-ask`** *The drawer opens.* **Pip** (asks, problem `frost`, opens the drawer, waits 18 s): "Have you got anything to wipe it clear?"

**Problem `frost`:** "The lamp's glass has frosted over in the cold." Rules: `soft` or `warm` → `frost-wipe`. Fallback → `frost-puzzled`. Ignored after 18 s → `frost-thimble`.

**Beat `frost-wipe`** *Pip takes it and rubs the glass; the frost clears; gold light; the beam.* **Pip** (wonder): "That's it! Rub, rub, rub..." **Pip** (relief): "There! Shine, lamp! Shine all the way down the steps!" → `too-long`

**Beat `frost-puzzled`** *Pip takes it, sets it down.* **Pip** (silly, to reader): "Thank you! But that won't wipe the frost." **Pip** (tense, to reader): "Something soft, maybe? Something warm?" *Waits 11 s.* → `frost-thimble`

**Beat `frost-thimble`** **Narrator** (silly): "Thimble had polished a great many thimbles in her time. She knew exactly what to do." *Thimble climbs the glass and rubs it clear; gold; the beam.* **Thimble** (relief): "A bit of elbow grease, and... there!" → `too-long`

**Beat `too-long`** (about 35 s)
- **Narrator** (sad): "The lamp shone. The snow fell. And the old keeper didn't come back."
- **Pip** (tense): "He's been gone too long. Much too long."
- **Thimble** (warm): "Go and find him, Pip. I'll keep the light."
- **Pip** (tense): "But a keeper never leaves the light."
- **Thimble** (warm): "Then I'll be the keeper till you're back. I know what this light means to someone lost."
- *Pip looks up at you.* **Pip** (warm, to reader): "Will you come with me? Into the snow?"
- **Narrator** (warm): "So down went the little fox, a hundred and twelve steps, into the longest night."

**Beat `page-one`:** turn the page.

### Spread 2: Lost in the snow (the landing, snowy)

**Beat `the-snow`** (about 30 s)
- *Pip in at the foot of the steps; Moth with him.*
- **Narrator** (tense): "At the bottom of the steps, the snow had covered everything. The path, the rocks, and every footprint."
- **Pip** (tense): "Wick? Wick! Where are you?"
- **Pip** (sad): "His footprints just stop. The snow's filled them in."
- **Narrator** (wonder): "Then something glinted. Not on the page, but out in the Reader's room." *With it:* `room hunt` (what: `object:logbook`, at: `room:couch`, so the best couch or the next best place). The beam sweeps your room and stops on it.

**Beat `glint-ask`** **Pip** (asks, problem `the-glint`, waits 30 s, past the hunt's own return at 28 s): "There! Something, out where you are! Can you bring it to me?"

**Problem `the-glint`:** "Something of Wick's has fallen out into the Reader's room." Rules: `log` (the logbook) → `log-found`. Fallback → `glint-puzzled`. Ignored after 30 s → `log-return`.

**Beat `log-found`** *Pip takes it.* **Pip** (tense): "Wick's logbook! He never goes anywhere without it." → `lost`

**Beat `glint-puzzled`** *Pip takes it, sets it down.* **Pip** (neutral, to reader): "Thank you. But that's not the shiny thing." **Pip** (to reader): "It's still out there in your room. Can you see it?" *Waits 11 s.* → `log-return`

**Beat `log-return`** *The hunt's thing drifts home along the beam (built).* **Narrator** (wonder): "The light found it, and carried it home along its beam." *Pip takes it.* **Pip** (tense): "Wick's logbook! He never goes anywhere without it." → `lost`

**Beat `lost`** (about 40 s)
- **Pip** (sad): "He's lost. Wick's lost, out in the snow."
- **Pip** (tense): "Every lost thing follows the light home. But how can he follow it, if he can't see it?"
- *Pip stands tall and raises the lantern.* **Pip** (warm): "Then I'll just have to be bigger than the dark."
- `room shadows`. **Narrator** (wonder): "And on the Reader's wall, the little fox's shadow stood up, tall as a lighthouse."
- *Pip turns to look at the wall.* **Pip** (wonder): "Is that me? I'm enormous!"
- *Pip raises the lantern high.* **Pip** (tense): "Wick! Wick! Over here!"
- `room shadows-off` as the corner lifts.

**Beat `page-two`:** turn the page.

### Spread 3: Home by the light (the gap, snowy)

Pip comes in on the lighthouse side this time (the far side), and Wick is on the side Pip crossed from in chapter 1, so chapter 1's crossings play in the same direction, with Wick as the traveller.

**Beat `the-edge`** (about 35 s)
- *Pip in at the far side; Moth; Wick at the near edge.*
- **Wick** (wonder): "Pip? I saw you, lad! A great big fox, right across the sky!"
- **Narrator** (tense): "The old keeper stood at the edge of the gap, with the snow coming down, and no way to tell where the ground stopped."
- **Wick** (sad): "Forty winters on this shore, and tonight I can't find my own way home."
- *Pip looks up at you.* **Pip** (warm, to reader): "I got over this gap once, with help. Now it's Wick's turn."

**Beat `wick-ask`** *The drawer opens.* **Pip** (asks, problem `wick-across`, opens the drawer, waits 24 s): "Can you help me get him across?"

**Problem `wick-across`:** "Wick can't see where the edge of the gap is in the snow." Rules: `rope` → `wick-rope`; `spans` or `climbs` → `wick-ladder`; `flies` → `wick-kite`. Fallback → `wick-puzzled`. Ignored after 24 s → `wick-snow`.

**Beat `wick-rope`** *Pip throws it across (chapter 1's rope span, reversed); Wick comes over.* **Pip** (warm): "Hold still, Wick. And catch!" **Wick** (silly): "Hmph. Now where did you learn that?" → `across`

**Beat `wick-ladder`** *Laid across; Wick feels his way over.* **Pip** (warm): "One rung at a time, Wick. I've got you." **Wick** (silly): "Don't look down, eh? Easy for some." → `across`

**Beat `wick-kite`** *Chapter 1's kite crossing, with a very surprised badger.* **Wick** (silly): "A kite? At my age?" **Wick** (wonder): "Oh. Oh my. Hmph. Rather nice, actually." → `across`

**Beat `wick-puzzled`** **Pip** (neutral): "I don't think that'll get him over." **Pip** (tense, to reader): "Something long, maybe? Something to hold on to?" *Waits 11 s.* → `wick-snow`

**Beat `wick-snow`** **Narrator** (wonder): "But the snow, which had been so much trouble all night, had been busy. It had filled the gap right to the top." *Wick walks across slowly.* **Pip** (warm): "Walk to my voice, Wick. Straight ahead. I've got you." → `across`

**Beat `across`** (about 45 s)
- *Resolve `wick-across`.* **Wick** (warm): "Hmph. Not bad, keeper. Not bad at all."
- *Pip gives Wick the logbook.* **Pip** (warm): "You dropped this. It was all the way out in the Reader's room."
- **Wick** (warm): "Forty years of lost things coming home, all in there."
- **Wick** (sad): "Pip. I've kept that light for forty years. But a keeper needs eyes, and mine are done."
- *Wick gives the logbook back to Pip.* **Wick** (warm): "It's yours now, lad. The lamp, the log, all of it."
- **Pip** (wonder): "Mine? But who'll grumble at me?"
- **Wick** (silly): "I'll grumble from my comfy chair. Loudly."

**Beat `the-sky`** (about 50 s)
- `room clear`. **Narrator** (wonder): "And just then, the snow stopped, the clouds opened, and the whole sky came out." *With it:* `room night-sky`.
- *Wick tips his face up.* **Wick** (warm): "I don't need eyes for the stars, lad. I know them all by heart."
- `room stars-lantern`. **Wick** (warm): "There's the Lantern. Every keeper's first star."
- `room stars-kite`. **Wick** (warm): "And the Kite, with her long tail."
- `room stars-fox`. **Pip** (wonder): "And that one? It looks like a fox."
- **Wick** (neutral): "Don't know that one. Must be new."
- **Wick** (warm): "They say every keeper gets a star. Looks like that one's yours."
- **Narrator** (silly): "Even the moth, for once in its life, looked away from the lamp."
- `room shooting-star`. *Pip looks up at you.* **Pip** (wonder, to reader): "A shooting star! Quick, make a wish!"

**Beat `morning`** (about 40 s)
- *Pip, Wick and Moth move to the lamp marks (chapter 1's).* **Narrator** (warm): "They climbed the hundred and twelve steps together. And the old keeper didn't count them once."
- *Thimble at the lamp.* **Thimble** (relief): "Welcome home, keepers. I kept her shining, every minute."
- `room day`. **Narrator** (wonder): "And when the longest night was over, and the sun came up over the edge of the table..."
- *Pip puts out the lamp (`lamp-out`, gently, at dawn light).* **Narrator** (warm): "...the new keeper put out the lamp himself, for the very first time. And the old keeper fell asleep in his comfy chair."

**Beat `chapter-end`**
- `cue keep`. **Narrator** (warm): "And whatever the Reader gave that night, the book kept safe, for another time." *(chapter 1's line)*
- **Narrator** (wonder): "Because lost things, as you'll find, have a way of coming back." *(chapter 1's line)*
- `cue chapter-end`.

### Chapter 3's bridges

- "The snow fell, soft as a held breath."
- "Up at the top, a small mouse kept the great lamp turning."
- "Somewhere out in the white, an old badger counted his steps."

### Chapter 3 at a glance

**What you hand over:** something soft or warm for the frost (the odd sock from the drawer or your satchel; or nothing, and Thimble polishes it); Wick's logbook from your room (or it drifts home on the beam); something to get Wick across (rope, ladder, kite; or nothing, and the snow fills the gap).

**What it records:** `frost` (reader / thimble), `log` (found / beam), `wick-across` (rope / ladder / kite / snow), and `keeper` = `pip` ("Wick handed Pip the lamp and the log, and Pip got his own star.").

**Room effects used:** `snow`, `clear`, `hunt` (with the logbook, at `room:couch`), `shadows`, `shadows-off`, `night-sky`, `stars-lantern`, `stars-kite`, `stars-fox`, `shooting-star`, `day`. Snow ends with `clear` before the night sky, so the app's "snow puts the stars away" rule never fights the story. At most one big effect at a time.

**What it needs (lane C's call, from its own 150 credits)**

| Kind | What | Notes |
|---|---|---|
| Character | Thimble | Lane B's art, already in the library |
| Sets | The lamp, the landing, the gap, all snowy | Free with run 014's `snow-cover.png` over the page, or repaints |
| Objects | Wick's logbook as an object (`log` tag), the odd sock (`soft`, `warm`) | Reused. The logbook is lane B's (chapter 2 uses it too) |
| Cues | Frost on the lamp's glass and wiping it; Wick walking off the page; crossings with Wick as the traveller; Wick walking over a filled gap; Pip turning to his shadow; lamp-out at dawn | The frost needs a small painting or a procedural tint |
| Voices | About 72 new lines with the bridges, 2 reused | Thimble's voice is chosen in chapter 2 |

---

## Things to settle at stage 2 (no decision needed now)

- **No contracts change is needed for the story.** Carries are data beside each episode (like `episode-1.canon.json`), read by the client; tags like `thread` and `log` are object data. If stage 2 finds otherwise, it stops and reports first.
- **The chapter titles.** `CHAPTERS` in `progress.ts` calls chapter 1 "The lamp goes out", and the episode calls it "The night the light went out". The new ones are "The night the sea came in" and "The longest night". Lane A presents them; which one chapter 1 uses is the sprint master's call.
- **The bottle for a seated reader.** It washes up at your feet. Seated at a table, the floor is a long reach, so it must also come to you by look and pinch, as the hunt's lost thing does. Checked in the emulator in stage 3; if it can't, Pip asks and the tide brings it, which is already the ignored path.
- **Spending.** Chapter 2's estimate is about 120 credits (Thimble 10, the landing 30, sound 8, voices 71), under lane B's 150 with room for one repaint.
- **Length.** Counted from the lines at 1.3× the caption estimate, the quick path is about 5:30 and the slowest (every ask answered wrongly at the last moment) about 6:50. That's close to 7:00, so stage 3's simulator decides, and the first trims are the `who-goes` and `ashore` beats. Stage 2 writes the run plans (017–019) and stops for approval before any spend.
