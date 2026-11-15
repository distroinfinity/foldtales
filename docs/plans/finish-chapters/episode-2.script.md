
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