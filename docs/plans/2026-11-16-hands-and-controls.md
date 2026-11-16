# Hands and the book's controls: what we learn from Meta's guidance and the products that got it right

Written by the sprint master on Nov 16 after the owner's first chapter 2 headset session. Goes into the repo as `docs/plans/2026-11-16-hands-and-controls.md` with the pause/controls lane's PR.

## What the owner felt in the headset

1. **The pause card floats over the book.** It covers the open spread (see the headset screenshot), hides the stage and breaks the spell. "I don't want to see a menu attached to the book."
2. **Pinching to select everything is not intuitive.** Pinch is right for picking a thing up and handing it to someone. It is wrong for pressing a button.
3. The direction the owner gave: the menu sits at the book's height or above it, not on it. The book folds first, then the menu pops up.

## What Meta's own guidance says (developers.meta.com/vr/design)

From *Hands UI best practices*, *Hands interaction types* and *Spatial UI inside interactive 3D scenes*:

- **Touch (poke) is the most intuitive way to press UI within arm's reach.** People reach out and tap with the index finger, with almost no learning. Use it for a small number of buttons within reach. Pinch is a different gesture: "Pinching … should not be used for direct touch interactions."
- **Role confusion is the named failure for exactly our case,** a tabletop scene that mixes grabbing things with pressing menus. The fixes:
  - one input per role;
  - distinct looks and sounds for "you're holding something" versus "you pressed a button";
  - menus on a clearly separate surface, leaving the play surface clean. "Mixing the two in the same visual space is the worst case."
- **Distance:** touch UI belongs 42–46 cm from the reader. Ray or gaze UI belongs at 1 m or more. **Avoid 0.5–0.8 m,** where people reach, miss and give up.
- **Surface-locked UI on a real table gives real physical feedback,** because your fingertip actually meets the table. Floating UI needs touch limiting so the hand never passes through.
- **Button feel:**
  - hit target at least 22 × 22 mm, with 12 mm between targets;
  - 7 mm of press travel;
  - index finger only;
  - a clear hover state, a pressed state, and **a short distinct sound on every press**. Hands have no haptics, so the sound is the confirmation.
- **No layout changes on hover.** Don't anchor menus to a moving wrist. Keep panels level and facing the reader.
- **Opening a menu:** Meta recommends a palm-up index pinch with the non-dominant hand for in-game options. Check whether Quest Browser's WebXR already takes that gesture for the system menu before using it.
- **Onboarding:**
  - show, don't tell;
  - a looping ghost-hand demonstration beats text;
  - the first menu is the first lesson, as in Cubism's title screen;
  - keep text to a minimum;
  - give strong feedback on the first success.

## What the products that nailed it teach us

- **Beat Saber:**
  - Menus and play are separate states: the playing field is never covered by UI.
  - The menu is a calm, fixed panel in front of you with big targets.
  - The path from menu to playing takes seconds; Road to VR credits that low friction for its lasting audience.
  - Newcomers still get confused by too many options, so fewer, bigger choices win.
- **Moss:** the book *is* the interface. Pages turn to move the story on; the frame is diegetic. Our controls should be part of the book's world (paper, ribbon, bookmark), not an app panel laid over it.
- **First Hand (Meta's own hands showcase) and the Interaction SDK samples:** buttons you push with a fingertip, with visible travel, recoil and a click. Objects you grab with a pinch or a palm grab, each with a pose. Two clearly different verbs.
- **Cubism, Puzzling Places, Forever Pets** (cited by Meta's onboarding guide): teach by doing in a safe space; chunk the lessons; the menu doubles as the tutorial.

## What this means for Foldtales

1. **Two verbs, never mixed:**
   - **Touch to press:** cards, buttons, the ribbon, Contents, Settings, Carry on, chapter choices. Index fingertip, 7 mm of paper-press travel, a soft paper "tock" on every press.
   - **Pinch to hold:** story objects only (the lantern, the kite, the bottle…), with a lift and a glow while held.
2. **Gaze or ray with pinch stays as the fallback** for far targets and for **Meta VR Glasses**, where gaze and pinch is the input. IWSDK supports both on the same entity (`PokeInteractable` with `RayInteractable`). Glasses must keep working: run the glasses test.
3. **The menu never covers the stage.** When paused:
   - the pop-up stage folds down flat;
   - then the menu rises on its own surface: either a paper card standing up behind the book's far edge, above the stage, or lying flat on the real table beside the book, where a press meets the real table.
   - It's world-locked at touch distance (about 45 cm), never in 0.5–0.8 m, level and facing the reader.
4. **Opening it:** tug or touch the ribbon instead of "pinch the ribbon"; the first-run hint becomes a looping ghost hand, not a sentence. Optionally add Meta's palm-up pinch, if Quest Browser leaves it free.
5. **Every in-book control follows the same rules:** the pause card, Contents, Settings, the end card, the chapter cards and the Storyteller's choices. Fewer, bigger choices.

## Sources

- Meta, Hands UI best practices: https://developers.meta.com/vr/design/hands-ui-best-practices
- Meta, Hands interaction types: https://developers.meta.com/vr/design/hands-interaction-types
- Meta, Spatial UI inside interactive 3D scenes: https://developers.meta.com/vr/design/hands-3d-best-practices
- Meta, Hands onboarding best practices: https://developers.meta.com/vr/design/hands-onboarding-best-practices
- Meta, Touch usage: https://developers.meta.com/vr/design/touch_usage
- Road to VR, reducing friction before play: https://roadtovr.com/reducing-vr-friction-pre-headset-selection-loading/
- Codementor, a minimalist Beat Saber menu: https://codementor.io/@vynloverdrive/why-i-built-a-minimalist-beat-saber-menu-2pgyahfw60
- NN/g, usability heuristics in VR: https://www.nngroup.com/articles/usability-heuristics-virtual-reality/
- Road to VR, Moss: Book II behind the scenes: https://roadtovr.com/moss-book-2-behind-the-scenes-polyarc/

## What lane A2 built (Nov 16–17)

### The surface we chose, and why

The brief offered two surfaces: (a) a card standing behind the book's far edge, or (b) cards lying on the table beside the book. Neither works as written:

- **(a) as written is out of reach.** Seated, the book's far edge is 0.7–0.8 m from the eyes: the dead zone to avoid.
- **(b) can't promise a surface.** The table beside the book isn't known to exist (fallback placement, a book near the table's edge), and it would sit low, outside the VR Glasses' view.

So the card is (a), brought to touch distance:

- It's placed once, as it rises, 45 cm from the eyes toward the book. It's world-locked, level (never rolled) and turned to face the reader.
- It's pitched so that, from the eyes, its bottom edge sits just above the book's far edge (between 15° and 40° below eye level). It reads as standing behind the flat book, and a press never reaches over the stage.
- It never sinks into the book, and it casts a soft shadow on the folded pages.

### The sequence

| Step | What you see and hear |
|---|---|
| Touch the ribbon's tail (or tug it) | A tap and a felt thump; a fold sound |
| The stage folds flat | Every pop-up layer lies down over 0.65 s, front layers a moment first (`controls.setFlat`) |
| The card rises | It unfolds from its bottom edge, comes up 5 cm, lands with a slight overshoot (0.46 s) |
| Carry on | The card folds away first, then the pages stand back up |

### Touch to press (`client/src/stage/press.ts`, tested in `tests/press.test.ts`)

- **The fingertip:** the index fingertip joint, treated as an 8 mm ball, so contact is measured from the skin.
- **Travel:** a button rests 7 mm proud of the card and lands at 70% of its travel.
- **Arming:** a press counts only when the finger came in from the front. A hand coming up from behind or sliding in from the side presses nothing.
- **One press per touch:** the finger has to come back off the face before it can press again. A card that changes under a finger presses nothing until the finger lifts.
- **A pinching hand never presses.**
- **States:**
  - near: a soft gold edge;
  - pushing: the button sinks with the finger, its shadow goes, the paper warms;
  - landed: a gold flash and a soft paper tap at the button.
- **Size:** buttons are at least 64 × 40 mm with 12 mm of card between them (`card-layout.ts`).
- **The ribbon:** the same press, down onto the page over the ribbon's tail, where the real table under the book pushes back. A tug (pinch, pull, let go) still works. A touch then a tug with the same hand counts once.

### Pinch to hold, and the far fallbacks

- **While a card stands,** nothing on the stage can be taken. Only the cover and the ribbon answer. Whatever a hand held when the card opened goes back with no gift, drop or turn.
- **VR Glasses:** look and pinch, as before (`select-gate.ts`).
- **Quest without eye tracking:** pointing a hand at a button lights its gold edge, and a pinch chooses it. That's the far fallback.

### The first-run lesson

- **What it is:** a pale ghost hand (`client/src/stage/ghost-hand.ts`), built from IWER's MIT "point" hand-pose joints and drawn once with a lamp-warm rim.
- **What it does:** it comes down and touches the ribbon's tail, with a small warm ripple on the page. No words.
- **When it plays:** three times, 7 s after the book opens, then it rests 40 s. It's gone for good after the first real use (`tt.ribbon-used`).
- **What it replaces:** the "Pinch the ribbon to pause" card that stood in front of the stage.
- **Review builds:** `?ghost=loop`.

### The look

- **The board:** the deckled `paper-tag.png` card is gone. It's now a clean-cut board in page paper with a faint tooth, a fine double ink rule inset like a bookplate, and a visible board edge.
- **The buttons:** lighter paper tabs with a gold rule.
- **Hold to talk:** its deckle texture is swapped for the same clean paper.

### Emulator evidence (Quest 3 hands, seated head, book at 0.7×)

| Check | Result |
|---|---|
| Ribbon touch (right hand), the card's placement | Pause; stage flat; card ready, its centre 0.45 m from the eyes |
| Either hand, touch only | Contents → Settings → Sound → Back → Back → Carry on; the story clock held at 369 033 ms throughout, and ran on after |
| Holding something while pausing | Left hand holding the drawer pull, right hand touches the ribbon: the hold ended quietly, the card stood, letting go chose nothing |
| Chapter 1 at `?speed=16` | Ended on its end card; Read again pressed by touch restarted the chapter |
| Put the book away | Pressed by touch: the session ended and the page came back |
| VR Glasses (`metaVRGlasses`, gaze granted) | Look and pinch: ribbon → pause, Contents (left hand), Back, Carry on (right). Looking at the book, the card's buttons are about 13° above the view axis and its top about 22° (limit 25°) |

The emulator's `press` reaches a tilted button's face only with `"depth": 0.015`, because it presses its axis-aligned box. Real fingers press along the true normal.
