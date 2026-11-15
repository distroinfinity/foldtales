
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