# Tabletop Theater: design language

**Frozen as v1.** You chose each of these in the browser, except where marked as my default. Everything still gets its final test in the headset, and changes go through you. The art is in `art/cast/`, and `art/cast/prototype.html` shows the approved acting. `art/book-mockup.html` shows the approved page, lettering and controls.

## The idea

**An old painted picture book, opened on your real table, at bedtime.** Your room dims like house lights going down, the pages stand up, and Pip's lantern becomes the light you care about. Spend the boldness on that moment and on the lamp's beam at the end. Keep everything else quiet.

## The world

**The Lost and Found at the Edge of the Table.** Everything lost in a house drifts to the table's edge, and the lighthouse calls it home. The drawer is the Lost and Found, and your satchel holds what you've rescued. The AI writes each episode inside this world.

| Character | Who | Design |
|---|---|---|
| **Pip** | Young fox, afraid of the dark, quietly wants to be the next keeper | Keeper's coat far too big, with sleeves rolled up and the hem dragging. Carries the brass lantern |
| **Wick** | Old badger, grumpy keeper, secretly losing his sight. Keep this gentle | Flat blue cap, blue-grey coat, cream waistcoat, thick round spectacles. Holds his logbook close to read it |
| **Moth** | Flies at anything bright, brings you odd finds, the source of silly surprises | Fluffy, with a fur collar, feathered antennae and big dark eyes |

**The arc:** Pip learns the dark, and Wick learns to hand over the lamp.

## How it looks

- **Painted storybook.** Soft watercolor washes with a fine pencil line, from a vintage natural history picture book.
- **Classic naturalist characters.** Natural proportions and small clothes. This is the style for every character, including ones the AI invents.
- **Cut-out puppets.** Each character is painted pieces, like a jointed paper doll, standing on your table.
- **Layers.** A set is three to five painted layers with real gaps, so your head movement gives parallax. That's the payoff a screen can't give.
- **Paper edges.** Pieces read as thick card, with a small shadow where one overlaps another. See proof P0 for how flat pieces hold up from the side.
- **Grounding.** A contact shadow under the book, each character and each object, and a soft shadow onto your real table.

## Color

Blue dusk into deep night. Episodes move from gentle dusk blue, to true dark blue-green, to a gold-lit lamp at the end, so relighting the lamp feels earned. The art is painted once, and the episode's mood comes from one tint across the stage.

| Name | Hex | Used for |
|---|---|---|
| Night navy | `#1F2A44` | Book cover, titles, night |
| Page | `#F6EFE2` | Pages and caption backing |
| Ink | `#2B2420` | Captions |
| Lamp gold | `#D4A23E` | Light, warmth, what's alive or listening |
| Fox rust | `#B5502E` | Ribbon, the one accent in a scene |
| Sea sage | `#76917D` | Secondary tab, shore |

Color is never the only signal. Story Circle players are told apart by their satchels and a name, as well as by color.

## Light and the room

- **Theater lights down:** about 80% dim at the room's edges, with a warm pool hugging the book, over about 2 s (raised from 68% after the owner's first ticket 1 headset session found too much room light). It's one adjustable value. No sudden swaps between real and virtual.
- **The lantern glows and flickers,** and its pool of light moves with Pip.
- **The signature moment:** the relit lamp's beam sweeps across your real room. The beam lifts the dim as it passes, so it looks like your walls are being lit. Passthrough has to do something here that nothing else can.

## Type

- **Titles:** Fraunces, a warm old-style serif with soft edges.
- **Captions and page text:** Atkinson Hyperlegible Next, chosen for readability on a low-density display.
- **Rules:** sentence case. Text is printed on the book's own surfaces. It subtends at least 1° at its real distance, about 11 mm tall at 0.65 m, and meets 4.5:1 contrast. Captions always sit on page, never directly over passthrough.

## Motion

- **12 poses a second.** Characters step like stop-motion, while the camera and your hands stay at full frame rate for comfort.
- **Always a little alive.** Breathing, a slow sway, a tail flick, the lantern's swing, and a blink every few seconds. This is what made Pip feel alive to you.
- **Heads swap, they don't morph.** Pip and Wick talk, blink and turn using a matched set of heads. The head tilts from the chin and never slides off the collar.
- **The acting set:** waiting, looks up at you, frightened, raises the lantern, hop of relief, talks, turns, grumbles, and turns an object over. Moth flutters and goes for the light. New actions follow the same restraint: small and believable beats big and cartoonish.
- **Real folds.** Pop-ups are rigid layers on hinges, moving as a real pop-up would, with a slight overshoot on landing.

## Sound

**Radio-play warmth:** expressive voices through a warm paper-radio treatment, with room tone underneath. Foley is real and small: paper, brass, felt, wood. Music is a small acoustic ensemble (felt piano, plucked strings, soft clarinet), authored in stems and never generated live, and it ducks for speech. Silence counts as polish too.

## The book is the only UI

No floating panels, no chat, no settings window.

**The 2D page** (owner, Nov 14) is the cover of the same book, at night. It follows these rules too, and the plan is `docs/plans/2026-11-14-product-front-door.md`.

- **One page for every device:**
  - the hero: the closed cover in the lamp's pool, *Tales from the Table's Edge*, the tagline, and **one rust button**;
  - then a pinned stage your scroll scrubs, built from the real painted pieces: the book opens, the shore stands up, Pip's lantern goes out and comes back, the page turns, and the lamp's beam sweeps the page.
- **Spend the boldness on the beam,** the page's one moment of spectacle. Everything else moves only because you scroll or open something.
- **Colours and type** are this document's. Paper (`#F6EFE2` on ink) is for things you open: the bookplate and the contents sheet. Sea sage is the AI Storyteller's door.
- **Sign-in is a bookplate:** "Put your name in the book", and once signed in, "This book belongs to …".

| You are | The button says | Under it |
|---|---|---|
| New | Open the book | Chapter 1 · about 6 minutes · just your hands. "No account needed. Sign in to keep your book." |
| Back mid-chapter | Continue chapter 1 | Start from the beginning |
| Back after a finished chapter | Read chapter 1 again (later: Continue to chapter 2) | More chapters on the way. The AI Storyteller at equal weight |
| Without a headset | Send to your Quest | Copy the link · Share the link (no dead button, no 3D download) |

The foot holds Chapters, "No table? Read in the painted room", About and Privacy.

| Control | Does |
|---|---|
| **Closing the book** | Pauses, and opening it resumes |
| **Ribbon** | Pauses without closing (my default, confirm in the headset) |
| **Top tab, gold** | Opens your satchel |
| **Lower tab, sage** | Opens the contents page: every chapter's page, to reread or play again, and Tonight's lost thing (ticket 3) |
| **End-of-chapter page** | "The end of chapter one" and "Read it again", printed on the page. Close the book to stop |
| **Drawer pull** | Opens the Lost and Found. It also slides open when a character asks for something |
| **Spine** | Moves the book |
| **Paper ear** | Appears on a character while it's listening |

## Objects

Objects come from three places: things on the set, the drawer of presets for this story, and the satchel you carry between stories. **Use it and you can keep it.** Objects share the characters' painted style, are big enough to pick up, and always have a contact shadow, including while you hold them.

## Hands and feedback

Hands have no haptics, so [every state must be shown and heard](https://developers.meta.com/horizon/design/hands-plain-language-principles/).

| State | Visual | Sound |
|---|---|---|
| Near | Soft gold edge | None |
| Touch or pinch | Piece dips slightly | Soft card tap |
| Holding | Lifts, shadow widens | Quiet rustle |
| Near a character | Character looks at it and reaches | Small interested sound |
| Handed over | Character takes it and turns it over | Pleased or puzzled sound |
| Release elsewhere | Small settle | Card on table |
| Can't do that | Small shake, returns home | Soft felt thud |

- **Nothing fires from gaze or hover alone.** Selection always takes a pinch.
- **Targets:** at least 64 mm for hand interaction, and objects snap to a close hand, since objects at book scale are small.
- **Hands stay below the heart,** and everything is within reach seated.
- **Everything undoes** with a simple motion, and grabs release easily.

## The look bar

A build passes when all of these are true, and you make the final call:

- Any frame could go in the competition video without an apology.
- It reads as a painted book in a real room within 2 seconds, with no explanation.
- Nothing floats without a shadow.
- Every action has a visual and a sound.
- No debug text, no default materials, no placeholder shapes.
- At least 72 fps in telemetry, with no visible hitch during the moment being reviewed.

Debug readouts exist only in dev builds, behind a flag.

## What we use for free, and what we make

Licenses marked *checked* were read from the package or the site. Re-check at the point of use, and keep a `CREDITS.md`.

| Need | Use | License |
|---|---|---|
| XR framework | IWSDK, Three.js | MIT *checked* |
| Text in 3D | `troika-three-text` | MIT *checked* |
| Sequencing | `gsap` | [Free no-charge license](https://webflow.com/updates/gsap-becomes-free) |
| Asset pipeline | `@gltf-transform/cli`, `ktx2-encoder`, `msdf-bmfont-xml` | MIT *checked* |
| Fonts | Atkinson Hyperlegible Next *checked*, Fraunces | OFL. Confirm Fraunces at use |
| Foley | Freesound filtered to CC0, Kenney audio | Check per item. Runway's sound effects are the paid fallback, at 1 credit a second |
| Spatial audio | Web Audio's built-in panner | Built in |

**Not useful to us:** Meta's asset library and generic 3D packs, because they'd break the single art direction. Meta's Horizon OS UI Set is a good reference for target sizes and states, but its look is the opposite of a picture book.

**We make these ourselves, because this is the product's identity:** the cast, sets, objects and book, the voice chain, the music, and the show.

## How art gets made

AI-assisted, and you approve what matters. `art/README.md` has the rules for every run.

1. **Plan the run.** What it answers, how we'll decide, what stays reusable.
2. **Paint a sheet.** `seedream5_pro` for prepared art, using a parts sheet and a heads sheet per speaking character. Very pale pieces go on flat colored paper.
3. **Cut out** with `art/tools/cutout.py`, for no credits.
4. **Rig** with a `rig.json`. Head offsets are measured, not placed by eye.
5. **Review on the Quest.** You approve the look in the headset, not on the Mac.

`seedream5_flash` paints art during a session. Each new character gets a description plus an existing painted character as its style guide.

Runway's help says you own your outputs. Check the current terms before shipping, and keep each prompt with its asset, which the run manifests already do.
