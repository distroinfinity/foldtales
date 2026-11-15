# Chapters 2 and 3: the story

Lane B of the finish sprint (`docs/plans/2026-11-15-finish-sprint.md`), branch `finish-chapter-2`. One writer for both chapters, so the book holds together. Lane B builds the engine for several chapters and chapter 2; lane C builds chapter 3 from this file on lane B's engine.

**Status:** stage 1 **approved with changes** by the sprint master (Nov 15), after Codex's review (3 P0, 7 P1, 1 P2). This revision takes in every ruling; there's no second review of stage 1. The build plan (stage 2) is `docs/plans/2026-11-15-finish-chapters-build.md`, with the dependency table, the run plans and the timings.

**One source for every line.** The beats below are rendered from the draft spines in `docs/plans/finish-chapters/` (`episode-2.draft.json`, `episode-3.draft.json`, with their `.carry` and `.canon` drafts), written by `author.py` there, the same files the timings and the line ledger read. Until the chapters move into `client/public/show/` in stage 3, change `author.py`, not this text.

## What changed after the review

| Ruling | What the story does now |
|---|---|
| **1. Effects that can't show the payoff** | Every beat says what the effect really does. Chapter 2: the room boat circles; its turn for home is the signature's one piece of new, bounded engineering (`boat-home`: it leaves its circle and sails across your floor toward the book, fading at the table's foot), and the page boat arrives on the next spread. Chapter 3: `day` only takes the sky away, so the morning belongs to the narrator and the page (dusk light, Pip putting the lamp out). The opening and ending beam stay |
| **2. Engine ownership** | Lane B owns and delivers every engine piece both chapters need, chapter 3's first. Anything that didn't fit was rewritten to existing staging: the frost is chapter 1's `lamp-out`/`lamp-lit`, the snow-filled gap became Wick's own rope, the soggy-boat cue and the rowed-in boat are gone, shadow play is gone. Thimble stays, owned by lane B, with her look approved in the headset by the end of Nov 16, or she becomes a non-speaking page character |
| **3. Tags** | `thread` (the spool) and `pages` (the logbook) go in the separate small contracts PR, written first in stage 3, with `boat-home`. `pages` replaces the earlier `log`, so the bottle (`message`) can't be taken for Wick's logbook |
| **4. The hunt's clock** | The ask opens as the hunt ends and waits 20 s, so it runs out with the hunt's own return at 28 s. The fallback line is true whether the logbook is in the room, beside the book or on its way. The ignored beat pulls it to Pip from wherever it is. If the hunt fails its headset check, the logbook lies glinting on the page instead |
| **5. The oil** | An ordinary errand ("same as every night"). No shortage |
| **6. Pip's growth on every branch** | In chapter 2 every way the light goes up leaves Pip below in the dark: on the kite, hung at the top of a standing ladder, or carried by Moth. The key is no longer a solution |
| **7. Honest thanks, honest histories** | On the silent path nobody claims the Reader helped: "They came all the way down with me." Rescue histories are kept only for the branch that happened, with a neutral history otherwise |
| **8. Budget** | A deduplicated line ledger and a capped asset budget per chapter, with a trim order (build plan) |
| **9. A visible consequence** | Chapter 3's beacon: however Pip's light went up in chapter 2 (kite, ladder or Moth), it goes up that way again, using the very kite or ladder from your satchel. Full default path: Moth. In chapter 2, what you didn't keep from chapter 1 is still lying on the sand |
| **10. Wick's handover** | Affirmative: "You brought us all home tonight, lad. Time you kept the lamp." The grumbling and the comfy chair stay |
| **11. Pacing** | First turn by 1:40 on the quick path. Real-scheduler timings for four readers are in the build plan |

## The bar each chapter meets

Chapter 1's bar: about six minutes, hands only, a hand moment on every spread, completable silently, a wow by minute 1, a payoff at the end. And what playtests taught us:

- **Three spreads, two turns by hand, the first by about 1:40.**
- **Each spread a new place.** "The shore felt like a new place" was what landed.
- **The help must feel needed,** and what you give changes how it's done.
- **One signature moment per chapter** (owner, Nov 15). In chapter 1 the lighthouse beam sweeping your real room is *the* wow. Each later chapter gets one moment like it, built around its story and saved for its peak. Everything else in the room is supporting and quieter.
- **Lines are timed at 1.3× the caption estimate** until they're voiced (run 010).

## The arc across the book

*Tales from the Table's Edge* has one arc, from the design language: **Pip learns the dark, and Wick learns to hand over the lamp.**

| | Pip and the dark | Wick and the lamp | Signature moment |
|---|---|---|---|
| **1. The night the light went out** (built) | Goes into the dark **carrying his light** to bring the wick home | Admits his eyes "aren't what they were". Calls Pip "keeper", half in jest | **The lighthouse beam sweeps your room** |
| **2. The night the sea came in** | Stands in the dark **without his light**, so someone lost can see it | Can't read a letter. Sends Pip down as "my eyes", and has him write in the keeper's log | **The sea across your floor**, and the lost boat on it turning for home |
| **3. The longest night** | Goes into the snow to bring **Wick** home, and makes his light "bigger than the dark" | Gets lost himself. **Chooses** Pip: hands him the lamp and the log, and names Pip's star | **The stars on your ceiling**, and Pip's own star among them |

**The thread:** "every lost thing follows the light home." Chapter 1 ends with "something lost turned toward the light, and started for home." Chapter 2 is that something: **Thimble**, a field mouse from the sewing basket Pip found on the shore ("Somebody's whole sewing basket washes up down here"), lost at sea in a paper boat. Chapter 3 turns it round: the keeper is the lost thing, and the light Pip keeps brings him home.

**Bookends:** the book opens with the lamp blown out against everyone's will, and ends at morning with Pip putting it out himself, for the first time.

**Refrains** (some already voiced): "a hundred and twelve steps"; "Same time tomorrow, keeper?"; "Hold still … and catch" (Wick to Pip in chapter 1, Pip to Thimble in 2, Pip to Wick in 3); "whoever you are"; the chapter-end line about what the book keeps.

### Who's in it

| Character | Chapters | Notes |
|---|---|---|
| Pip | 1, 2, 3 | Unchanged |
| Wick | 1, 2, 3 | Unchanged. His logbook (`art/cast/wick/parts/logbook.png`) is a rig part in chapter 2 and becomes an object, `logbook`, in chapter 3 |
| Moth | 1, 2, 3 | Silent. Carries the light up on chapter 2's silent path, and in chapter 3's default beacon |
| **Thimble** (new) | 2, 3 | A young field mouse about 7 cm tall (Pip is 17), in a knitted sailor's jersey, with a thimble worn as a hat. From the sewing basket. Small, bright, brave, with a sailor's manners ("Much obliged"). Speaks. Acting from the existing list: idle, look, hop, scared, raise, turn, examine. Lane B owns her art (run 017), rig and voice; her look is approved in the headset by the end of Nov 16, or she becomes a non-speaking page character and her lines go to Pip and the narrator |

### Sets

| Set | Ch 1 | Ch 2 | Ch 3 |
|---|---|---|---|
| The lamp (`the-lamp`) | Spread 1 | Spread 1 | Spread 1, snowy |
| The shore path (`shore-path`) | Spread 2 | Spread 2, at the water's edge | — |
| The gap (`the-gap`) | Spread 3 | — | Spread 3, snowy |
| **The landing** (`the-landing`, new, run 018) | — | Spread 3 | Spread 2, snowy |

**The landing:** the foot of the lighthouse, where stone steps go down into the sea between dark rocks. It reuses the shore path's night sky and headland, as the gap does, so the lighthouse and the beam's origin don't move. New art: a printed ground and two standing layers. The rock where Thimble sticks is on the right page and the bottom step on the left, so crossings travel right to left as they do over the gap. Snow on a page in chapter 3 is lane C's art call (run 014's `snow-cover.png` over the set, or repaints).

## What carries, and how

The **facts** a chapter records at its end, and **the satchel** of what you kept, both come into the next chapter. The mechanism is lane B's (build plan, task E4): a `episode-N.carry.json` beside each episode names **slots**. A slot is a beat whose `next` is chosen when the chapter starts, by a fact and, if it names one, by something in your satchel. Every slot has a default, so a chapter played without the one before is whole.

| From | Carries | What the next chapter does with it |
|---|---|---|
| Ch 1 `crossing` | kite, thread, ladder or rope | Pip remembers it in one line after "You came back!" (default: no line) |
| Ch 1 satchel | kite, spool, ladder, sock or key | **Visible:** what you kept is in your satchel; what you didn't is still **lying on the sand** of the shore where you left it. Either way it can answer spread 2's and spread 3's asks. The spool is Thimble's grandmother's thread, and that's its own branch |
| Ch 2 `landing` | thread, rope, ladder, kite or tide | Thimble remembers it in her first line (default: "I've never seen snow from dry land before!") |
| Ch 2 `light-high` plus your satchel | kite, ladder or moth | **Visible, chapter 3's beacon:** the light goes up again the way it did, using the very kite or ladder from your satchel. Default (Moth, or the thing no longer in your satchel): Moth carries it |
| Ch 3 `keeper` | pip | The book's arc is done; the contents page shows it |

**One rule for things in two places:** a set or drawer object whose id is already in your satchel isn't placed again; the satchel's copy stands in for it.

---

## Chapter 2: The night the sea came in

**Premise:** The next night the tide comes further than it ever has, right across the Reader's floor, and a bottle washes up at the Reader's feet. Inside is a letter from Thimble, lost at sea and following the light. Wick can't read it, and can't see a boat at sea. So Pip goes down to the dark water to be the keeper's eyes and bring her home.

Cast: Pip, Wick, Moth, Thimble. Sets: the lamp, the shore path, the landing. Timings (real scheduler, build plan): quick 5:18–5:23, zero input 6:19–6:24, late wrong gifts 6:55–6:56, holding 6:39–6:44; first turn 1:40 (1:45 with a carry line).

| Spread | Set | Hand moment | Room |
|---|---|---|---|
| 1. The letter | The lamp | Pick up the bottle from **your floor** and pass it up | **Signature arrives:** the sea washes in across your floor (0:30 on the quick path); a bottle washes up at your feet (0:38) |
| 2. The light on the water | The shore path, night | Get Pip's light **up high**, where Thimble can see it | A paper boat circles you on the sea, lost. **Signature peak** (2:30): when the light goes up, it leaves its circle and sails across your floor toward the book |
| 3. The landing | The landing (new) | Bring Thimble in off the rocks | The page boat: Thimble on the rock where the room boat was heading. The tide; the ending beam; the sea slips back out of your room |

**Signature moment: the sea across your floor.**
- **What:** the night sea washes in across the reader's real floor and stays for the chapter. Its peak is Thimble's lost paper boat circling the reader on it and then, once Pip's light goes up, leaving its circle and sailing across the floor toward the book, fading at the table's foot. On the next spread she's on the page, stuck on the rock.
- **When** (quick path; slower readers later): it arrives at 0:30 (the wow by minute 1, as chapter 1's beam opens its chapter), peaks at 2:30 in `she-sees`, and leaves at about 4:35 as the sea slips back out past the edge of the table.
- **Why this story:** it's the night the sea came in. The reader sits in the very sea Thimble is lost on, and watches the light bring her home across their own room.
- **Built or new:** the sea, the tide and the circling boat are built and approved in the headset ("boat and sea look nice"). The turn for home, `boat-home`, is the one piece of new engineering: lane B, in the contracts PR and `room-fx/sea.ts`, code only.
- **Supporting, quieter:** the bottle at your feet (the same sea), the tide, and chapter 1's beam at the opening and the end. No other room effect.

**Hand moments, and what you can give**

| Spread | Solves it | Where it comes from | If you give something else | If you do nothing |
|---|---|---|---|---|
| 1 | The bottle (`message`) | Your floor; seated, look at it and pinch to call it to your hand | "But it's the bottle we need", and the ask stays open | After 16 s the tide brings it up; Pip takes it |
| 2 | `flies` (a kite): the lantern rises on it. `climbs`/`spans` (the ladder): stood on the rocks with the lantern hung at the top | The kite and spool on the sand (unless in your satchel); the ladder, sock and key in the drawer; your satchel | "It won't get my light up high" | After 22 s Moth carries the light up |
| 3 | `thread` (the spool): Grandmother's thread. `rope`: a line. `spans`/`climbs`: a bridge. `flies`: a kite tail | The same, carried down; your satchel | "That won't reach her" | After 22 s the tide sets her down on the step |

Pip ends spread 2 below in the dark on every path ("It's very dark down here without my light. But she can see it."). Thimble's own soggy paper boat stays on the rock; it can be picked up, and kept.

**What it records** (`episode-2.canon.json`): `letter` (reader, tide), `light-high` (kite, ladder, moth), `landing` (thread, rope, ladder, kite, tide), `thimble` = home, `log` = pip. Histories only for what happened: the bottle (passed up from your floor, or washed up), the spool ("It pulled her in off the rocks" only after `in-by-thread`, otherwise "Thimble's grandmother's thread, from the sewing basket"), the kite and ladder by branch, Thimble's boat, and a neutral default.

### Chapter 2, beat by beat

Stage directions in plain words; `+` means "with the one before". Speakers' lines are final text for voicing.

#### Scene `the-letter` (set `the-lamp`)

Objects: `bottle` (set).

Problem `the-letter`: A bottle with a letter has washed up at the Reader's feet. Rules in order: `message` → `letter`. Fallback → `letter-puzzled`. Ignored after 16 s → `letter-tide`.

**`opening`** (est. 40 s, next `trim`)
- cue `open-book`
- + cue `lamp-lit`
- + light gold over 2.0 s
- + cue `beam`
- wait 1.0 s
- **Narrator** (wonder): "The next night, the lamp burned bright, and a new keeper stood on the gallery. A very small one, in a very big coat."
- pip look → reader
- + **Pip** (wonder, to reader): "You came back! Wick, look, they came back!"
- **Wick** (warm, to reader): "Hmph. So they did. Evening, whoever you are."

**`carry-kite`** (est. 4 s, next `trim`) *[carry slot: crossing = kite]*
  *carry: chapter 1 crossing = kite*
- **Pip** (wonder, to reader): "I still dream about flying over the gap on that kite."

**`carry-thread`** (est. 4 s, next `trim`) *[carry slot: crossing = thread]*
  *carry: chapter 1 crossing = thread*
- **Pip** (wonder, to reader): "Moth's still ever so proud of carrying that thread across."

**`carry-ladder`** (est. 4 s, next `trim`) *[carry slot: crossing = ladder]*
  *carry: chapter 1 crossing = ladder*
- **Pip** (wonder, to reader): "I keep thinking about that ladder. Right across the gap!"

**`carry-rope`** (est. 4 s, next `trim`) *[carry slot: crossing = rope]*
  *carry: chapter 1 crossing = rope*
- **Pip** (silly, to reader): "Wick says next time I cross a gap, I'm to bring my own rope."

**`trim`** (est. 8 s, next `sea-in`) *[carry slot: default]*
- **Pip** (wonder, to cast:wick): "Can I trim the wick tonight, Wick? Please?"
- wick grumble
- + **Wick** (warm, to cast:pip): "Go on, then. Carefully, mind."
- + pip examine → mark:lamp

**`sea-in`** (est. 20 s, next `bottle-ask`)
  *SIGNATURE arrives: the sea across your floor (built). The bottle washes up at your feet.*
- **Narrator** (wonder): "That night, the sea came in further than it ever had. Up the shore, up the rocks, and right across the Reader's floor."
- + room `sea`
- room `bottle` object:bottle
- + pip look → reader
- + **Pip** (wonder, to reader): "The sea's come right in! And look, something's washed up by your feet!"

**`bottle-ask`** (est. 18 s)
- **Pip** asks (tense, problem `the-letter`, waits 16 s): "Can you pass it up to us?"

**`letter`** (est. 6 s, next `letter-read`)
- pip take → object:$offered
- **Pip** (wonder, to reader): "A bottle, with a letter in it! Thank you!"
- + pip examine → object:$offered

**`letter-puzzled`** (est. 20 s, next `letter-tide`)
- pip take → object:$offered
- **Pip** (silly, to reader): "Oh, thank you! But it's the bottle we need. The one that washed up!"
- + pip examine → object:$offered
- cue `set-down` → object:$offered
- wait 0.6 s
- pip look → reader
- wait 11 s

**`letter-tide`** (est. 10 s, next `letter-read`)
  *use pulls the bottle from wherever it is (your floor, beside the book) to Pip*
- **Narrator** (silly): "But the tide, as tides do, brought the bottle the rest of the way by itself."
- pip uses bottle (problem the-letter)
- + pip take → object:bottle
- **Pip** (wonder): "A bottle! And there's a letter in it!"

**`letter-read`** (est. 24 s, next `who-goes`)
- **Pip** (wonder, to cast:wick): "Wick, it's a letter! Read it, read it!"
- pip gives bottle to wick
- + wick examine → object:bottle
- wait 0.4 s
- **Wick** (sad, to cast:pip): "Hmm. The light's poor up here tonight. You read it, lad."
- wick gives bottle to pip
- **Pip** (tense): "'To whoever keeps the light: I'm lost on the water. I can see your light, but the rocks keep turning me back. Please keep shining. Thimble.'"
- cue `set-down` → object:bottle
- resolve `the-letter`: Thimble's letter came up out of the sea

**`who-goes`** (est. 30 s, next `page-one`)
- **Wick** (neutral, to cast:pip): "The light brings her as far as the rocks. Past them, someone has to call her in."
- **Wick** (silly, to cast:pip): "I'd go. But I couldn't see a paper boat if it sailed up my nose."
- **Wick** (warm, to cast:pip): "Somebody's got to be my eyes, lad."
- pip scared
- + **Pip** (tense): "Down to the water? In the dark?"
- pip look → reader
- + **Pip** (warm, to reader): "Not on my own, though. You'll come, won't you?"
- **Narrator** (warm): "So down went the little fox, a hundred and twelve steps, to the very edge of the sea."

**`page-one`** (est. 6 s)
- cue `page-invite`


#### Scene `the-water` (set `shore-path`)

Objects: `kite` (set), `spool` (set), `ladder` (drawer), `odd-sock` (drawer), `brass-key` (drawer).

Problem `too-low`: Pip's lantern is too low for Thimble to see past the rocks. Rules in order: `flies` → `high-kite`; `climbs`, `spans` → `high-ladder`. Fallback → `high-puzzled`. Ignored after 22 s → `high-moth`.

**`page-turn-shore`** (est. 3 s, next `the-water`)
- cue `page-turn`
- + place cast:pip at `shore-in`
- + place cast:moth at `moth-in`

**`the-water`** (est. 34 s, next `light-ask`)
  *Things you did not keep from chapter 1 lie on the sand where you left them; a kept one is in your satchel instead. The room boat starts its circle.*
- place object:kite at `kite-sand`
- + place object:spool at `spool-sand`
- pip walks to mark:water-edge
- + moth walks to mark:moth-follow
- wait 0.6 s
- **Narrator** (tense): "At the water's edge, the dark was very big, and the sea was very loud."
- room `boat`
- + **Pip** (wonder, to reader): "There! A little paper boat, going round and round..."
- pip raise
- **Pip** (tense): "Thimble! Over here! Thimble!"
- **Narrator** (neutral): "But the sea was loud, and the lantern was low, and the little boat went round again."
- **Pip** (sad): "She can't see me. My light's too low down here."

**`light-ask`** (est. 24 s)
- pip look → reader
- **Pip** asks (tense, problem `too-low`, waits 22 s, opens the drawer): "Is there anything that could get my light up high, where the whole sea can see it?"

**`high-kite`** (est. 12 s, next `she-sees`)
  *The lantern rises on the kite; Pip stays below in the dark, holding the string.*
- pip take → object:$offered
- **Pip** (wonder): "A kite! Up you go, little light!"
- cue `light-up` → object:$offered
- + **Pip** (wonder): "Up, up, up! Higher than the rocks!"

**`high-ladder`** (est. 12 s, next `she-sees`)
  *The ladder stands on the rocks with the lantern hung at its top; Pip stays below.*
- pip take → object:$offered
- **Pip** (wonder): "A ladder! I'll stand it on the rocks, and hang my light at the top."
- cue `light-up` → object:$offered
- + **Pip** (wonder): "There. Like a little lighthouse!"

**`high-puzzled`** (est. 20 s, next `high-moth`)
- pip take → object:$offered
- **Pip** (silly, to reader): "Oh, that's lovely. But it won't get my light up high."
- + pip examine → object:$offered
- cue `set-down` → object:$offered
- wait 0.6 s
- **Pip** (tense, to reader): "Something that flies, maybe? Or something to climb?"
- pip look → reader
- wait 11 s

**`high-moth`** (est. 12 s, next `she-sees`)
  *Moth carries the lit lantern up high; Pip stays below in the dark.*
- **Narrator** (silly): "Now, if there's one thing a moth knows, it's how to get close to a light."
- cue `light-up` → cast:moth
- + **Pip** (tense): "Moth! Where are you taking my... oh!"
- **Pip** (relief): "Oh, Moth. You clever, clever moth."

**`she-sees`** (est. 30 s, next `page-two`)
  *SIGNATURE peak: the room boat leaves its circle and sails across your floor toward the book (boat-home, new).*
- light night over 1.0 s
- **Narrator** (wonder): "Far out on the water, the little boat stopped going round. And turned. And came, slowly, toward the light."
- + room `boat-home`
- **Pip** (tense): "It's very dark down here without my light. But she can see it. That's what matters."
- pip look → reader
- **Pip** (sad, to reader): "I'm still a little bit scared. Is that all right?"
- **Narrator** (warm): "It was. Being a little bit scared is mostly what brave is made of."
- cue `light-down`
- + light dusk over 1.2 s
- resolve `too-low`: the light went up high, and Thimble turned for home
- **Pip** (warm, to cast:moth): "Come on, Moth. She'll come in at the landing."

**`page-two`** (est. 6 s)
- cue `page-invite`


#### Scene `the-landing` (set `the-landing`)

Objects: `thimble-boat` (set).

Problem `the-rocks`: Thimble's paper boat is sinking on the rocks below the landing. Rules in order: `thread` → `in-by-thread`; `rope` → `in-by-rope`; `spans`, `climbs` → `in-by-ladder`; `flies` → `in-by-kite`. Fallback → `rocks-puzzled`. Ignored after 22 s → `rocks-tide`.

**`page-turn-landing`** (est. 3 s, next `the-rocks`)
  *The page boat: Thimble in her paper boat on the rock, where the room boat was heading.*
- cue `page-turn`
- + place cast:pip at `landing-in`
- + place cast:moth at `moth-landing`
- + place cast:thimble at `rock`
- + place object:thimble-boat at `rock`

**`the-rocks`** (est. 26 s, next `rescue-ask`)
- pip walks to mark:pip-step
- wait 0.6 s
- **Narrator** (tense): "The little boat came in out of the dark, right up to the rocks. And there it stuck."
- thimble raise
- **Thimble** (wonder, to cast:pip): "Ahoy! Ahoy, the light!"
- **Pip** (wonder, to cast:thimble): "Thimble? Are you Thimble?"
- thimble scared
- **Thimble** (tense, to cast:pip): "Thimble, from the sewing basket! But my boat's gone soft. Paper boats aren't made for the whole sea."

**`rescue-ask`** (est. 26 s)
- pip look → reader
- **Pip** asks (tense, problem `the-rocks`, waits 22 s, opens the drawer): "She's stuck on the rocks! Have you got anything that could bring her in?"

**`in-by-thread`** (est. 12 s, next `ashore`)
- pip take → object:$offered
- **Thimble** (wonder, to cast:pip): "That thread! That's my grandmother's thread, from the basket!"
- cue `thimble-thread` → object:$offered
- + **Pip** (warm, to cast:thimble): "Hold on tight, and we'll pull you in!"
- resolve `the-rocks`: pulled in on her grandmother's thread

**`in-by-rope`** (est. 12 s, next `ashore`)
- pip take → object:$offered
- **Pip** (warm, to cast:thimble): "Hold still, Thimble. And catch!"
- cue `thimble-rope` → object:$offered
- + **Thimble** (tense): "Steady as she goes! Steady as she goes!"
- resolve `the-rocks`: hauled in on a line

**`in-by-ladder`** (est. 12 s, next `ashore`)
- pip take → object:$offered
- **Pip** (wonder): "A ladder! Across to the rock, like a bridge!"
- cue `thimble-ladder` → object:$offered
- + **Thimble** (tense): "Mind the gaps between the rungs. Mind the gaps..."
- resolve `the-rocks`: came across a ladder laid like a bridge

**`in-by-kite`** (est. 12 s, next `ashore`)
- pip take → object:$offered
- **Pip** (wonder, to cast:thimble): "Grab the tail, Thimble! The wind'll do the rest!"
- cue `thimble-kite` → object:$offered
- + **Thimble** (wonder): "I'm flying! A sailor, flying!"
- resolve `the-rocks`: flew in on a kite tail

**`rocks-puzzled`** (est. 20 s, next `rocks-tide`)
- pip take → object:$offered
- **Pip** (neutral): "That won't reach her, I don't think."
- + pip examine → object:$offered
- cue `set-down` → object:$offered
- wait 0.6 s
- **Pip** (tense, to reader): "Something long, maybe? Something she can hold on to?"
- pip look → reader
- wait 11 s

**`rocks-tide`** (est. 14 s, next `ashore`)
- **Narrator** (wonder): "And then the sea, which had been so cross all night, gave one last great heave..."
- + room `tide-in`
- cue `thimble-heave`
- + **Narrator** (warm): "...and set the little mouse down on the steps, as gently as anything."
- resolve `the-rocks`: the sea itself set her down on the steps

**`ashore`** (est. 42 s, next `homecoming`)
  *Wick holds out his logbook (his rig's own part); Pip writes.*
- thimble hop
- + **Thimble** (relief): "Land! Real, dry, stay-where-it-is land!"
- thimble scared
- + **Thimble** (silly): "Brr. I'm wet right through to my whiskers."
- **Pip** (warm, to cast:thimble): "Here, get in my coat. It's far too big for me anyway."
- thimble walks to mark:pip-side
- place cast:wick at `wick-steps`
- + wick grumble
- **Wick** (neutral, to cast:pip): "Pip? I could hear you all the way from the top."
- **Pip** (relief, to cast:wick): "Wick! She's here! The light brought her home!"
- wick examine → cast:thimble
- + **Wick** (warm): "Hmph. A mouse in a paper boat. Across the whole sea."
- wick raise
- **Wick** (warm, to cast:thimble): "Welcome home, little one. Every lost thing that comes home goes in the log."
- **Wick** (warm, to cast:pip): "You write her in, lad. You were my eyes tonight."
- **Pip** (wonder, to cast:wick): "Me? In the keeper's log?"
- pip examine → cast:wick
- **Pip** (warm): "'Thimble, from the sewing basket. Came home by the light.'"

**`homecoming`** (est. 30 s, next `chapter-end`)
  *The beam sweeps the room once more; the sea leaves your floor.*
- cue `beam`
- + room `tide-out`
- **Narrator** (warm): "And the sea, its work done, slipped quietly back out past the edge of the table."
- + room `sea-off`
- thimble look → reader
- **Thimble** (wonder, to cast:pip): "Is that the Reader? The one who reaches down from the sky?"
- **Pip** (warm, to cast:thimble): "That's them. They came all the way down with me."
- **Thimble** (warm, to reader): "Much obliged, Reader. Truly."
- wait 0.6 s
- **Wick** (warm, to cast:pip): "Same time tomorrow, keeper?"
- wait 0.6 s
- **Pip** (relief, to cast:wick): "Same time tomorrow."

**`chapter-end`** (est. 14 s)
- cue `keep`
- + **Narrator** (warm): "And whatever the Reader gave that night, the book kept safe, for another time."
- wait 1.5 s
- **Narrator** (wonder): "But the nights were growing longer, and the old keeper's eyes were growing dimmer. And the longest night of all was on its way."
- wait 1.5 s
- cue `chapter-end`

**Bridges** (narrator, for a late beat):
- "Out on the dark water, a paper boat bobbed, and waited, and hoped."
- "The sea breathed in, and the sea breathed out."
- "Up at the top of the lighthouse, the great lamp went round, and round."
---

## Chapter 3: The longest night

**Premise:** On the longest night of the year, snow comes to the edge of the table. Wick goes down to the store for the oil, as he does every night, and doesn't come back: the snow has hidden the path, and he can't see. Thimble keeps the light while Pip goes out into the snow, finds that the old keeper is lost, and brings him home. Under the stars, Wick chooses Pip: he hands him the lamp and the log, and names Pip's star.

Cast: Pip, Wick, Moth, Thimble. Sets: the lamp, the landing, the gap, all snowy. Timings (real scheduler, build plan): quick 5:18–5:20, zero input 6:29–6:31, late wrong gifts 6:47–6:56, holding 6:49–6:51; first turn 1:36–1:38.

| Spread | Set | Hand moment | Room |
|---|---|---|---|
| 1. The frost | The lamp | Wipe the frost off the lamp's glass so the light can get out | Supporting: snow round you, settling on your table (0:07) |
| 2. Lost in the snow | The landing | Bring back what glints **in your room** | Supporting: chapter 1's beam hunts your room and stops on Wick's logbook |
| 3. Home by the light | The gap | Get Wick across the gap | **Signature** (4:00 on the quick path): the snow clears and the stars come out on your ceiling; Wick names them by heart, and the new one, the Fox, is Pip's |

**Signature moment: the stars on your ceiling, and Pip's star.**
- **What:** the room goes dark, paper stars and the moon come out across the reader's real ceiling, and the constellations light one by one as Wick names them: the Lantern, the Kite, and a new one, the Fox, which is Pip's. A shooting star crosses.
- **When:** at the chapter's peak, straight after Wick hands Pip the lamp and the log (`the-sky`, 4:00 on the quick path). Nothing before it uses the ceiling. When the stars fade (`day`, which only takes the sky away), the narrator and the page carry the morning.
- **Why this story:** Wick has lost his sight but doesn't need eyes for the stars; he knows them by heart. It's the one thing he can still show Pip, and he gives Pip a star of his own at the moment he chooses him. The keeper's light is the beam; the keeper's star is on your ceiling.
- **Built or new:** built and approved in the headset ("roof stars and moon look good"), including `stars-lantern`, `stars-kite`, `stars-fox` and `shooting-star`. No new engineering, no credits.
- **Supporting, quieter:** the snow (the wow by minute 1; it has to clear before the sky can open) and the treasure hunt (chapter 1's beam doing a small job). No shadow play, no fireflies.

**Hand moments, and what you can give**

| Spread | Solves it | Where it comes from | If you give something else | If you do nothing |
|---|---|---|---|---|
| 1 | `soft` or `warm` (the odd sock): Pip rubs the glass clear | The drawer (sock, ladder, key, kite), your satchel | "That won't wipe the frost" | After 18 s Thimble polishes it clear |
| 2 | `pages` (Wick's logbook) | Your room: the beam finds it (`room:couch`, or the next best place). Walk over and pinch it, or look and pinch to call it | "It's the shiny thing I need, the one the light found" (true wherever it is) | The ask runs out with the hunt's own return (28 s); Pip takes the logbook from wherever it is |
| 3 | `rope`: Pip throws a line ("Hold still, Wick. And catch!"). `spans`/`climbs`: a ladder. `flies`: Wick on a kite, at his age | Wick's own rope coiled on the far side, the drawer, your satchel | "I don't think that'll get him over" | After 24 s Pip spots Wick's own rope and throws it himself |

**The beacon** (spread 2, after the logbook): the light goes up the way it did in chapter 2. With `light-high` = kite and the kite in your satchel, Pip asks to borrow it, it comes out of the satchel to him, and the lantern rises on it; the same with the ladder; otherwise Moth carries it. This is the chapter's visible consequence.

**What it records** (`episode-3.canon.json`): `frost` (reader, thimble), `logbook` (reader, beam), `wick-across` (rope, ladder, kite), `keeper` = pip ("Wick handed Pip the lamp and the log, and Pip got a star of his own."). Histories by branch for the sock, kite and ladder, and a neutral default.

### Chapter 3, beat by beat

#### Scene `the-frost` (set `the-lamp`)

Objects: `odd-sock` (drawer), `ladder` (drawer), `brass-key` (drawer), `kite` (drawer).

Problem `frost`: The lamp's glass has frosted over in the cold. Rules in order: `soft`, `warm` → `frost-wipe`. Fallback → `frost-puzzled`. Ignored after 18 s → `frost-thimble`.

**`opening`** (est. 30 s, next `thimble-snow`)
  *Supporting: snow round the reader, settling on the real table (built).*
- cue `open-book`
- + cue `lamp-lit`
- + light gold over 2.0 s
- + cue `beam`
- wait 1.0 s
- room `snow`
- + **Narrator** (wonder): "On the longest night of the year, the snow came all the way to the edge of the table."
- pip look → reader
- **Pip** (wonder, to reader): "Snow! It's snowing on the Reader too! Look!"

**`thimble-snow`** (est. 4 s, next `errand`) *[carry slot: default]*
  *carry default*
- **Thimble** (wonder): "I've never seen snow from dry land before!"

**`carry-thread`** (est. 4 s, next `errand`) *[carry slot: landing = thread]*
  *carry: chapter 2 landing = thread*
- **Thimble** (warm): "I've wound Grandmother's thread back on its spool. Every inch of it."

**`carry-rope`** (est. 4 s, next `errand`) *[carry slot: landing = rope]*
  *carry: chapter 2 landing = rope*
- **Thimble** (silly): "The last time I was this cold, somebody threw me a rope."

**`carry-ladder`** (est. 4 s, next `errand`) *[carry slot: landing = ladder]*
  *carry: chapter 2 landing = ladder*
- **Thimble** (silly): "The last time I was this cold, I crossed a ladder to get home."

**`errand`** (est. 30 s, next `frost-ask`)
  *Wick leaves by the stair (an exit mark: he fades there). The frost is staged with chapter 1's lamp-out and a dusk light.*
- wick examine → mark:lamp
- + **Wick** (neutral): "Longest night of the year. I'll fetch the oil up from the store, same as every night."
- **Pip** (tense, to cast:wick): "I'll go! You can't see the steps in the..."
- wick grumble
- + **Wick** (warm, to cast:pip): "Forty winters I've walked those steps, lad. I don't need eyes for them."
- wick walks to mark:stair
- + **Narrator** (neutral): "And down he went, one paw on the wall, counting every step."
- wait 0.8 s
- cue `lamp-out`
- + light dusk over 1.5 s
- + pip scared
- **Pip** (tense): "The glass is frosting over! The light can't get out!"
- **Thimble** (tense, to cast:pip): "And Wick will need it to find his way back!"

**`frost-ask`** (est. 20 s)
- pip look → reader
- **Pip** asks (tense, problem `frost`, waits 18 s, opens the drawer): "Have you got anything to wipe it clear?"

**`frost-wipe`** (est. 12 s, next `too-long`)
- pip take → object:$offered
- **Pip** (wonder): "That's it! Rub, rub, rub..."
- + pip examine → mark:lamp
- cue `lamp-lit`
- + light gold over 1.5 s
- + cue `beam`
- + **Pip** (relief): "There! Shine all the way down the steps!"
- resolve `frost`: the Reader's gift wiped the glass clear

**`frost-puzzled`** (est. 20 s, next `frost-thimble`)
- pip take → object:$offered
- **Pip** (silly, to reader): "Thank you! But that won't wipe the frost."
- cue `set-down` → object:$offered
- wait 0.6 s
- **Pip** (tense, to reader): "Something soft, maybe? Something warm?"
- pip look → reader
- wait 11 s

**`frost-thimble`** (est. 14 s, next `too-long`)
- **Narrator** (silly): "Thimble had polished a great many thimbles in her time. She knew exactly what to do."
- thimble walks to mark:lamp
- thimble examine → mark:lamp
- cue `lamp-lit`
- + light gold over 1.5 s
- + cue `beam`
- + **Thimble** (relief): "A bit of elbow grease, and... there!"
- resolve `frost`: Thimble polished the glass clear

**`too-long`** (est. 30 s, next `page-one`)
- wait 0.8 s
- **Narrator** (sad): "The lamp shone. The snow fell. And the old keeper didn't come back."
- **Pip** (tense): "He's been gone too long. Much too long."
- **Thimble** (warm, to cast:pip): "Go and find him, Pip. I'll keep the light till you're back."
- **Pip** (tense, to cast:thimble): "But a keeper never leaves the light."
- **Thimble** (warm, to cast:pip): "Then I'll be the keeper for a bit. I know what this light means to someone lost."
- pip look → reader
- + **Pip** (warm, to reader): "Will you come with me? Into the snow?"
- **Narrator** (warm): "So down went the little fox, a hundred and twelve steps, into the longest night."

**`page-one`** (est. 6 s)
- cue `page-invite`


#### Scene `lost-in-the-snow` (set `the-landing`)

Objects: `logbook` (set).

Problem `the-glint`: Wick's logbook has fallen out into the Reader's room. Rules in order: `pages` → `log-found`. Fallback → `glint-puzzled`. Ignored after 20 s → `log-return`.

**`page-turn-landing`** (est. 3 s, next `the-snow`)
- cue `page-turn`
- + place cast:pip at `landing-in`
- + place cast:moth at `moth-landing`

**`the-snow`** (est. 34 s, next `glint-ask`)
  *Supporting: chapter 1's beam hunts your room and stops on Wick's logbook (built; walk in the headset still owed).*
- pip walks to mark:pip-step
- wait 0.6 s
- **Narrator** (tense): "At the bottom of the steps, the snow had covered everything. The path, the rocks, and every footprint."
- **Pip** (tense): "Wick? Wick! Where are you?"
- **Pip** (sad): "His footprints just stop. The snow's filled them in."
- **Narrator** (wonder): "Then something glinted. Not on the page, but out in the Reader's room."
- room `hunt` object:logbook at room:couch

**`glint-ask`** (est. 22 s)
  *The ask opens as the hunt ends, so its 20 s run out together with the hunt's own return at 28 s.*
- pip look → reader
- **Pip** asks (tense, problem `the-glint`, waits 20 s): "There! Can you bring it to me?"

**`log-found`** (est. 8 s, next `lost`)
- pip take → object:$offered
- **Pip** (tense): "Wick's logbook! He never goes anywhere without it."
- + pip examine → object:$offered
- resolve `the-glint`: the Reader brought the logbook back from the room

**`glint-puzzled`** (est. 18 s, next `log-return`)
  *True whether the logbook is still in the room, beside the book or on its way back.*
- pip take → object:$offered
- **Pip** (neutral, to reader): "Thank you. But it's the shiny thing I need, the one the light found."
- cue `set-down` → object:$offered
- pip look → reader
- wait 9 s

**`log-return`** (est. 10 s, next `lost`)
  *use pulls the logbook to Pip from wherever it is (still in the room, drifting home, or beside the book).*
- pip uses logbook (problem the-glint)
- + pip take → object:logbook
- + **Narrator** (wonder): "And the light, being a lighthouse light, brought it the rest of the way home."
- **Pip** (tense): "Wick's logbook! He never goes anywhere without it."
- resolve `the-glint`: the beam brought the logbook home

**`lost`** (est. 14 s, next `beacon-moth`)
- **Pip** (sad): "He's lost. Wick's lost, out in the snow."
- **Pip** (tense): "Every lost thing follows the light home. But how can he follow it, if he can't see it?"

**`beacon-moth`** (est. 12 s, next `calling`) *[carry slot: default]*
  *carry default*
- **Pip** (warm, to cast:moth): "Then the light will just have to be bigger than the dark. Moth?"
- cue `light-up` → cast:moth
- + **Narrator** (wonder): "And up went the little light, high above the snow."

**`beacon-kite`** (est. 12 s, next `calling`) *[carry slot: light-high = kite and `kite` in your satchel]*
  *carry: chapter 2 light-high = kite and the kite is in your satchel. The kite comes out of the satchel to Pip.*
- **Pip** (wonder, to reader): "The kite from the night Thimble came! Can I borrow it again?"
- place object:kite at `pip-step`
- cue `light-up` → object:kite
- + **Narrator** (wonder): "And up went the little light, high above the snow."

**`beacon-ladder`** (est. 12 s, next `calling`) *[carry slot: light-high = ladder and `ladder` in your satchel]*
  *carry: chapter 2 light-high = ladder and the ladder is in your satchel.*
- **Pip** (wonder, to reader): "The ladder from the night Thimble came! Can I borrow it again?"
- place object:ladder at `pip-step`
- cue `light-up` → object:ladder
- + **Narrator** (wonder): "And up went the little light, high above the snow."

**`calling`** (est. 10 s, next `page-two`)
- **Pip** (tense): "Wick! Wick! Follow the light!"
- wait 1.0 s
- cue `light-down`

**`page-two`** (est. 6 s)
- cue `page-invite`


#### Scene `home-by-the-light` (set `the-gap`)

Objects: `rope-coil` (set).

Problem `wick-across`: Wick can't see where the edge of the gap is in the snow. Rules in order: `rope` → `wick-rope`; `spans`, `climbs` → `wick-ladder`; `flies` → `wick-kite`. Fallback → `wick-puzzled`. Ignored after 24 s → `wick-rope-self`.

**`page-turn-gap`** (est. 3 s, next `the-edge`)
- cue `page-turn`
- + place cast:pip at `far-side`
- + place cast:moth at `moth-hover`
- + place cast:wick at `near-edge`
- + place object:rope-coil at `rope-far`

**`the-edge`** (est. 28 s, next `wick-ask`)
- **Wick** (wonder, to cast:pip): "Pip? Is that your light, lad? Brightest little light I ever saw."
- **Narrator** (tense): "The old keeper stood at the edge of the gap, with the snow coming down, and no way to tell where the ground stopped."
- **Wick** (sad): "Forty winters on this shore, and tonight I can't find my own way home."

**`wick-ask`** (est. 28 s)
- pip look → reader
- **Pip** asks (tense, problem `wick-across`, waits 24 s, opens the drawer): "I got over this gap once, with help. Can you help me get him across?"

**`wick-rope`** (est. 12 s, next `across`)
- pip take → object:$offered
- **Pip** (warm, to cast:wick): "Hold still, Wick. And catch!"
- cue `wick-rope` → object:$offered
- + **Wick** (silly): "Hmph. Now where did you learn that?"
- resolve `wick-across`: Pip threw a line across

**`wick-ladder`** (est. 12 s, next `across`)
- pip take → object:$offered
- **Pip** (warm, to cast:wick): "One rung at a time, Wick. I've got you."
- cue `wick-ladder` → object:$offered
- + **Wick** (silly): "Don't look down, eh? Easy for some."
- resolve `wick-across`: a ladder laid across

**`wick-kite`** (est. 12 s, next `across`)
- pip take → object:$offered
- **Wick** (silly): "A kite? At my age?"
- cue `wick-kite` → object:$offered
- + **Wick** (wonder): "Oh. Oh my. Hmph. Rather nice, actually."
- resolve `wick-across`: Wick flew over on a kite

**`wick-puzzled`** (est. 20 s, next `wick-rope-self`)
- pip take → object:$offered
- **Pip** (neutral): "I don't think that'll get him over."
- cue `set-down` → object:$offered
- wait 0.6 s
- **Pip** (tense, to reader): "Something long, maybe? Something to hold on to?"
- pip look → reader
- wait 11 s

**`wick-rope-self`** (est. 16 s, next `across`)
  *On the silent path Pip does it himself: his growth, not a rescue by someone else.*
- **Narrator** (wonder): "Then Pip saw it. Wick's own rope, right where he'd left it, the night the light went out."
- pip uses rope-coil
- + pip take → object:rope-coil
- **Pip** (warm, to cast:wick): "Hold still, Wick. And catch!"
- cue `wick-rope` → object:rope-coil
- + **Wick** (silly): "Hmph. Now where did you learn that?"
- resolve `wick-across`: Pip threw Wick's own rope across

**`across`** (est. 40 s, next `the-sky`)
  *Wick chooses Pip. The handover is trust, not incapacity.*
- **Wick** (warm, to cast:pip): "Hmph. Not bad, keeper. Not bad at all."
- pip gives logbook to wick
- **Pip** (warm, to cast:wick): "You dropped this. The light found it, all the way out in the Reader's room."
- wick examine → object:logbook
- **Wick** (warm): "Forty years of lost things coming home, all in here."
- wait 0.6 s
- **Wick** (warm, to cast:pip): "You brought us all home tonight, lad. Time you kept the lamp."
- wick gives logbook to pip
- **Wick** (warm, to cast:pip): "The lamp, and the log, and all of it. They're yours, keeper."
- **Pip** (wonder, to cast:wick): "Mine? But who'll grumble at me?"
- **Wick** (silly, to cast:pip): "I'll grumble from my comfy chair. Loudly."

**`the-sky`** (est. 50 s, next `morning`)
  *SIGNATURE: the stars on your ceiling, and Pip's star (built and approved).*
- room `clear`
- + **Narrator** (wonder): "And just then, the snow stopped, the clouds opened, and the whole sky came out."
- room `night-sky`
- + wick look → reader
- **Wick** (warm, to cast:pip): "I don't need eyes for the stars, lad. I know them all by heart."
- room `stars-lantern`
- + **Wick** (warm): "There's the Lantern. Every keeper's first star."
- room `stars-kite`
- + **Wick** (warm): "And the Kite, with her long tail."
- room `stars-fox`
- + **Pip** (wonder, to cast:wick): "And that one? It looks like a fox."
- **Wick** (neutral, to cast:pip): "Don't know that one. Must be new."
- **Wick** (warm, to cast:pip): "They say every keeper gets a star. Looks like that one's yours."
- room `shooting-star`
- + pip look → reader
- + **Pip** (wonder, to reader): "A shooting star! Quick, make a wish!"
- wait 2.0 s

**`morning`** (est. 36 s, next `chapter-end`)
  *`day` only takes the sky away; the morning is the narrator's and the page's (dusk light, the lamp put out).*
- wick walks to mark:lamp-wick
- + pip walks to mark:lamp-pip
- + moth walks to mark:moth-lamp
- + place cast:thimble at `lamp-thimble`
- + **Narrator** (warm): "They climbed the hundred and twelve steps together. And the old keeper didn't count them once."
- **Thimble** (relief): "Welcome home, keepers. I kept her shining, every minute."
- room `day`
- + **Narrator** (wonder): "And when the stars had faded, and the morning came over the edge of the table..."
- cue `lamp-out`
- + light dusk over 2.0 s
- + **Narrator** (warm): "...the new keeper put out the lamp himself, for the very first time. And the old keeper fell asleep in his comfy chair."

**`chapter-end`** (est. 14 s)
- cue `keep`
- + **Narrator** (warm): "And whatever the Reader gave that night, the book kept safe, for another time."
- wait 1.5 s
- **Narrator** (wonder): "Because lost things, as you'll find, have a way of coming back."
- wait 1.5 s
- cue `chapter-end`

**Bridges** (narrator, for a late beat):
- "The snow fell, soft as a held breath."
- "Up at the top, a small mouse kept the great lamp turning."
- "Somewhere out in the white, an old badger counted his steps."
### Lane C's handoff: building chapter 3 alone

Lane C does **data, art, voices and sound only**. Everything the engine needs for this chapter is lane B's and lands first (build plan, "Chapter 3's prerequisites", by the end of Nov 16). When it lands, lane C has:

| Lane B delivers | So lane C can |
|---|---|
| The chapter list in the manifest, loading by number (`?chapter=3`), a saved place per chapter, carry slots, satchel carry | Add chapter 3's entry (episode, canon, carry, who's on stage where) and run it |
| Thimble in the library (rig, voice), the landing set with every mark below, the `logbook` and `thimble-boat` objects, the `pages` and `thread` tags | Use them by id |
| Marks: `the-lamp`: `moth-lamp`, `thimble`, `stair` (an exit: a character who walks there fades out). `the-landing`: `landing-in`, `pip-step`, `step` (where crossings land), `moth-landing`, `rock`, `pip-side`, `wick-steps`. `the-gap`: `rope-far`, `wick-lands`, `lamp-thimble` | Stage every beat in the draft |
| Cues in the library: `light-up` (target `object:<kite or ladder>` or `cast:moth`), `light-down`, `wick-rope`, `wick-ladder`, `wick-kite` (Wick crosses to `wick-lands`; the ladder laid from Pip's side) | Name them; nothing to build |
| `use` that pulls a room object to the user's paw; `place` of a satchel object onto a mark; Wick's logbook part hidden while the `logbook` object is on stage | `log-return`, `beacon-kite`, `beacon-ladder` and `across` work as written |
| `tools/chapter-timings.ts` | Re-time after every change, and against the rendered voice |

Lane C's own list: `client/public/show/episode-3.json`, `.canon.json` and `.carry.json` from the drafts here (titles, ids and lines as written; trims allowed, new lines through the sprint master); snowy page art (runs 020–022, its own plan); chapter 3's voices (76 new lines; Thimble's voice is chosen in run 017/019) and sound (snow underfoot, a frost tinkle, a sleepy chair creak, if wanted); the chapter's `CHAPTERS` row in `progress.ts` (one line, which lane B leaves ready); the headset run.

If the hunt fails its headset check (it hasn't been walked yet), lane C swaps `room hunt` for `place object:logbook at pip-step` plus `cue beam`: the logbook glints on the page and the reader picks it up there. Nothing else changes.

---

## Settled at stage 2

- **Contracts:** one small PR, first thing in stage 3: tags `thread` and `pages`, and the room effect `boat-home` (9 s, takes no object). Nothing else in the story needs contracts.
- **The chapter titles:** "The night the sea came in" and "The longest night". `CHAPTERS` calls chapter 1 "The lamp goes out" while its episode says "The night the light went out"; the sprint master's call which one the page shows.
- **Spending:** the ledger and caps are in the build plan. Nothing is spent before the sprint master approves runs 017–019.
