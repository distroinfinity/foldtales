# The book and the first set: design

Art library ticket, M1 scope. Run 004. Written 2026-11-09.

## What this has to do

M1 is one continuous moment: tap "Open the book", the room dims, the book unfolds, Pip's lantern blows out, Pip looks up at you. Any frame of it has to be good enough for the competition video, and it has to read as a painted book in a real room within two seconds.

This work delivers the painted pieces for that moment, cut out and named, plus one reference page that proves on the Mac that the pieces are enough. Rendering them on the Quest is Ticket 1.

**Given by the ticket:** run number 004, plan and estimate approved before any credit is spent, never paid while the other workspace is generating, sets of three to five layers with real gaps, pop-ups as rigid layers on hinges.

**My assumptions:** the first set is the shore path below the lighthouse, because the PRD's first five minutes happen on a path that later "ends at a gap". The book's page ratio is 2:3, the closest standard painter ratio to the approved mockup (about 0.69).

## What M1 needs that the ticket didn't list

Reading M1 frame by frame against what already exists:

| Beat | Needs | Exists? |
|---|---|---|
| Book on the table | Cover, spine, page edges, ribbon, tabs, drawer pull | No |
| Book unfolds | Inside of the cover is the left page, plus a printed ground | No |
| Pages stand up | Three to five layers, and something for their backs | No |
| Lantern blows out | **An unlit lantern.** The only lantern we have has its flame painted in | **No** |
| The gust itself | Something you can see moving | No |
| Flame dies | Smoke | No |
| Pip looks up at you | **A head that looks up.** We have forward, talk, blink, scared, profile and three-quarter | **No** |

The two bold rows are the moment the ticket says has to be video-worthy, and neither was in the ticket. They are in scope here because M1 fails without them.

**A defect to fix for free.** `art/cast/pip/parts/lantern.png` has 85 specks of trapped paper inside its handle, visible on the hero prop. Same size, same placement, so nothing that reads the file changes.

**Things I tested and rejected.** Recoloring the lit lantern's glass gives a perfectly registered unlit lantern for free, but the ghost of the flame survives and the glass goes flat. It fails the look bar, so the unlit lantern gets painted.

## The book as a machine

Before painting, the pieces follow from how it moves.

**Reference size:** closed 210 x 315 mm, open spread 420 x 315 mm. Everything is in millimeters at this size, and the Stage scales the whole book from tray to desk.

**Sequence:**

1. Closed book on the table. You see the cover, and on its sides the spine and page edges.
2. The cover swings 180 degrees about the spine. Its inside face is the **left half of the spread**. The top of the page block is the **right half**. So one painting, split at the fold, is everything you see when the book lies open. The boards show only as a thin navy rim, as in the mockup.
3. Layers rise from flat, back to front, with a slight overshoot on landing, starting when the cover has about 30 degrees left to travel.

**The closed book sits on the right half of the open footprint.** Ticket 1 needs to slide it left by a quarter of the open width while it opens, or center it on the spine from the start.

**A rigid layer can't cross the spine while the book is closing.** A full-width layer is twice as wide as the closed book, so it can't physically fold inside. Real pop-ups solve this with a center crease and V-folds, which would double the geometry for a motion nobody will see. **Decision: layers are one rigid piece, and they exist only once the cover is most of the way open.** Closing reverses this: layers fold flat, then the cover closes. Art consequence: nothing important sits on the center 6% of any layer, so a crease stays possible if the headset shows we need one.

**Layers fold toward the reader, so you see their backs while they rise.** A double-sided card would show the painting mirrored, which is wrong. **Decision: backs are plain card in page color `#F6EFE2`.** No art is needed, and a flat layer is camouflaged on the page until it lifts.

**A folded layer must fit on the page,** so each layer's height has to be no more than its hinge's distance from the near edge.

## Approaches

1. **One big parts sheet for everything.** Cheapest, and proven for puppets. A 2K image split among four layers leaves each around 1,000 px wide, while a full-width layer covers about 1,000 headset pixels from the seat and more when you lean in, which is the product's promise. Rejected for layers. Kept for the small trim pieces.
2. **One painted scene, sliced into layers.** Perfect coherence, but there's no paint behind whatever you cut away, so parallax opens holes. Rejected.
3. **A composed key painting, then each layer painted separately from it.** The key fixes composition, palette and light. Each layer gets its own full 2K image, with paint continuing behind what covers it. This is the run 002 recipe, where one master produced matching parts. **Chosen.**

## The set: shore path

**Four layers, back to front, plus the printed ground.** Three is the ticket's minimum, but with three the lighthouse has to share a layer with either the sky or the dunes, and it's the one object whose parallax says "this is a place". Five would add a layer with nothing to do in M1.

| Piece | Hinge from near edge | Height | What it is |
|---|---|---|---|
| `layer-1-sky` | 290 mm | up to 236 mm | Pale dusk sky with a die-cut cloud top, faint moon |
| `layer-2-headland` | 240 mm | up to 200 mm | Far headland with the lighthouse in the left third |
| `layer-3-dunes` | 185 mm | up to 120 mm | Low dunes and a strip of sea, the pale band behind Pip |
| Pip's mark | 130 mm, right of center | about 170 mm tall | |
| `layer-4-foreground` | 70 mm | up to 65 mm at the sides, under 30 mm in the center | Low reed and stone framing with a dip in the middle |
| `ground` | on the page | full spread | Sand and path printed on the page, fading to bare paper at the edges |

The near 45 mm of the page stays bare paper for captions.

**Why those numbers.** At a reference eye 500 mm back from the near edge and 420 mm above the table:

- Ten centimeters of head sway moves the front layer against the back one by about 1.8 degrees, around 46 headset pixels. That's clearly visible.
- The foreground's center dip keeps Pip's feet in view (its 30 mm hides ground only up to about 114 mm, and Pip stands at 130 mm).
- The sight line through Pip's body lands on the dunes and through his head on the dunes and headland, which is why those two carry the value rule below.

**Painting rules, each from a stated constraint:**

- **Painted once, in gentle dusk.** The design language says mood comes from one tint across the stage, so the set can't be painted as night. It needs mid-to-high values that survive being tinted darker.
- **Lighter behind Pip than Pip's coat.** His navy coat vanishes against a dusk-blue background, so the dunes and headland behind him stay pale. The unlit lantern needs the same contrast to read.
- **The lighthouse lamp is dark.** It stays unlit until the ending, and the Stage adds light. A painted beam or lit window would be wrong for the whole episode.
- **No painted shadows with a direction, and no glowing sources.** The lantern's pool of light is added at runtime and moves with Pip.
- **Shaped top edges with a pencil line.** A rectangle standing on a real table reads as a screen. A die-cut top reads as card, and the outline gives the cutout tool something to stop at.
- **Chunky silhouettes.** Reeds are clumps, not hair-thin strands, because thin strands cut badly and shimmer at this display density.

**The one taste decision, made by looking.** The world is the Lost and Found at the Edge of the Table, where everything lost in a house drifts ashore. A generic beach doesn't say that. Two key paintings differ in exactly one thing: one is a plain shore, the other has two or three large lost household things on it (a brass button half-sunk like a boulder, a thimble, a spoon standing as a post). You pick between them.

## The book's pieces

| Piece | How it's made | How it's cut |
|---|---|---|
| `cover-front` | Own 2K painting, 2:3: navy cloth, gold-stamped lighthouse emblem and border, blank panel for the title | Full bleed, no cutout |
| `spine` | Cropped from the cover painting, so the cloth matches | Free |
| `page-edge` | On the trims sheet | Cutout |
| `ribbon`, `tab-gold`, `tab-sage`, `drawer-pull` | On the trims sheet, in the mockup's colors | Cutout |
| `ground` | Own 2K painting, 4:3 | Full bleed. Paper tone calibrated to `#F6EFE2` for free |

**Title lettering is not painted.** Image models misspell, and the design language says Fraunces, printed on the book's surfaces. The cover leaves a blank panel and Ticket 1 sets the type.

**Ribbon, tabs and drawer pull are in, even though tabs and drawer are M2 controls.** They're part of the approved book, a book without them would need repainting or would look unfinished in the video, and they cost nothing extra on a sheet that's already being painted.

## Effects and Pip's additions

| Piece | Sheet |
|---|---|
| `art/fx/smoke-1`, `smoke-2`, `leaf-1` to `leaf-3` | Trims sheet |
| `art/cast/pip/heads/up` | Pip sheet, 1K, referencing the run 003 heads sheet |
| `art/cast/pip/parts/lantern-out` | Pip sheet |

The run 003 recipe gave heads within 5 pixels of each other, so the Pip sheet repeats it. It paints two looking-up heads, one frightened and one pleading, and we keep the better one, measuring its offset the same way.

The unlit lantern has to swap for the lit one without a visible jump. If the painted one's outline lands within 5 pixels of the lit one after alignment, it's used whole. If not, its painted glass goes inside the lit lantern's brass frame, so the frame can't move.

**Cutting pale work.** Pale pieces need contrasting paper (run 001). The trims sheet goes on the slate-blue paper Moth used. Layers are painted running off the bottom and both sides of the image, so only the shaped top meets paper. The sky goes on flat terracotta paper because it's pale blue. The other layers go on slate-blue. All use `cutout.py --seal=3`. Any paper trapped in enclosed gaps gets a one-off pass in the run folder, as runs 002 and 003 did. Layer bottoms are then trimmed to a straight hinge line.

## Files

```
art/book/        cover-front spine page-edge ribbon tab-gold tab-sage drawer-pull .png, book.json
art/sets/shore-path/  layer-1-sky layer-2-headland layer-3-dunes layer-4-foreground ground .png, set.json
art/fx/          smoke-1 smoke-2 leaf-1 leaf-2 leaf-3 .png
art/cast/pip/    heads/up.png, parts/lantern-out.png, parts/lantern.png (cleaned), rig.json (adds the up offset)
art/m1-proof.html  reference only, next to book-mockup.html
art/runs/004-book-and-first-set/  plan.json, manifest.jsonl, results.md, sheets, one-off scripts
```

`book.json` and `set.json` follow `rig.json`: millimeters at reference size, hinge positions, and a note that they're the art's proposal until tested on the Quest. Ticket 0 has no format for sets yet, and these are small enough to convert when it does.

## The run

Same painter as every prepared asset (`seedream5_pro`), same style text as runs 002 and 003, one reference approach. Prices are from Runway's list, 5 credits at 1K and 9 at 2K, and the manifest records the real cost.

| Phase | Job | Size | Credits |
|---|---|---|---|
| A | Two key paintings, referencing Pip | 1K, 16:9 | 10 |
| B | Four layers, referencing the chosen key | 2K, 16:9 | 36 |
| B | Ground | 2K, 4:3 | 9 |
| B | Cover | 2K, 2:3 | 9 |
| B | Trims and effects sheet | 2K, 1:1 | 9 |
| B | Pip's sheet | 1K, 1:1 | 5 |
| | **Planned** | | **78** |
| | Up to three repaints at 9 | | 27 |
| | **Cap** | | **120** |

Keys stay at 1K on purpose. References are limited to 5 MB, and a 2K PNG can exceed that.

**Two approval points.** Phase A runs after you approve the plan and estimate. Phase B runs after you pick a key. The tool has no phase filter and isn't broken, so `plan.json` holds only Phase A's jobs until the key is chosen. Finished jobs are skipped on the second pass, so nothing is paid twice.

**The shared account.** The tool measures spend from the account balance, so a job in the other workspace would be charged to this run and could trip the cap early. Before each phase I ask you whether the other workspace is generating. After each phase I compare each job's logged credits to its list price, and any mismatch gets reported as contamination, not cost.

## How we'll know it worked

**Checked by script, for every piece:** has an alpha channel, is one connected piece with no specks, no rim of paper color along the edge, is at the planned size. For layers, the bottom edge is solid across its width, and height fits its hinge. Names match `book.json` and `set.json`, and every file they reference exists.

**Checked by measurement:** the set survives all three moods with a simulated tint, and the dunes behind Pip are lighter than his coat by a clear margin.

**Checked by me, by eye:** every piece and composite, against the cast and the look bar. A piece that fails is repainted with one change, inside the cap.

**Checked by you, on the Mac:** `art/m1-proof.html` plays the whole moment with the real pieces in CSS 3D. Moving the mouse stands in for moving your head. It's a reference page like `book-mockup.html`, not product code.

**Only you can check, in the headset, once Ticket 1 can show it:** does the book hold up as card from the side, is the parallax worth it, is Pip legible against the dunes in your room's light, and does the dim plus the unlit lantern read as "the light went out".

## Risks

| Risk | What happens then |
|---|---|
| Separately painted layers don't match | The key is a shared reference. If one drifts, repaint it, within the cap |
| The model frames the cover or ground with a border or book mockup | Prompt says full bleed. Repaint once, otherwise crop |
| The sky bleeds terracotta into its edge | Repaint on white, relying on the pencil outline |
| A layer's top edge comes out too soft to cut | Repaint with stronger die-cut wording |
| Set feels dark or muddy once tinted | Caught by the tint check before the proof page |
| Cast and set light disagree in the headset | One tint across both is the frozen design. Adjust the tint values in Ticket 1 |
| Quest memory, with five 2K textures | Ticket 1 builds KTX2 and can downsize. 2K is the source, not a runtime requirement |

## Not in this work

The gap scene and the drawer's interior (M2), the object library (waiting on Ticket 0's format), Wick's and Moth's additions, the lit lighthouse (runtime), and all rendering. New ideas go in `docs/v2-ideas.md`.

## Where the ticket should change

The ticket frames this as the book and the first set. M1 is decided by two small pieces it doesn't mention, Pip's upward look and the unlit lantern, and both are added here. And "pop-ups are rigid layers on hinges" can't be literally true for a layer spanning the spine as the book closes, so the design above says what actually happens.
