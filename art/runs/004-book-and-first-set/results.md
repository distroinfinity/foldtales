# Run 004 results

**Question:** can `seedream5_pro` paint a book and a layered paper set that sit in the same book as Pip, and cut out cleanly? **Yes.** Everything M1 needs is cut out, named and checked. Two layers took a repaint plus some free cleanup.

## What it cost

| Job | Model | Size | List | Logged | Seconds |
|---|---|---|---|---|---|
| key-plain | `seedream5_pro` | 1K | 5 | 17* | 99 |
| key-lost-things | `seedream5_pro` | 1K | 5 | 5 | 92 |
| paper-test | `seedream5_pro` | 1K | 5 | 5 | 92 |
| layer-1-sky | `seedream5_pro` | 2K | 9 | 9 | 144 |
| layer-2-headland | `seedream5_pro` | 2K | 9 | 9 | 170 |
| layer-3-dunes | `seedream5_pro` | 2K | 9 | 9 | 139 |
| layer-4-foreground | `seedream5_pro` | 2K | 9 | 9 | 190 |
| ground | `seedream5_pro` | 2K | 9 | 9 | 227 |
| cover-front | `seedream5_pro` | 2K | 9 | 9 | 128 |
| trims-sheet | `seedream5_pro` | 2K | 9 | 9 | 119 |
| pip-sheet | `seedream5_pro` | 1K | 5 | 5 | 119 |
| layer-2-headland-v2 | `seedream5_pro` | 2K | 9 | 9 | 161 |
| layer-4-foreground-v2 | `seedream5_pro` | 2K | 9 | 9 | 156 |

**This run's spend: 101 credits ($1.01) at list price, against a plan of 83 and a cap of 120.** The two repaints account for the 18 over plan.

\* The balance fell 113 in total. The extra 12 were the voice workspace's run 005, which charged twelve 1-credit clips between 13:30:29 and 13:32:04 UTC, while key-plain was generating. Its manifest row says 17, but key-plain itself cost 5. The cap was kept against the conservative 113.

| Invocation | Listed | Observed | Unexplained |
|---|---|---|---|
| Phase A | 15 | 27 | 12, the voice clips |
| Phase B | 68 | 68 | 0 |
| Repaints | 18 | 18 | 0 |

## Answers

- **Composition:** the shore with lost household things (a brass button, a thimble, a spoon), chosen by you. The plain shore stays here as a reference.
- **Paper:** flat vivid magenta cuts many-colored scenery cleanly, with no fringe on pale sand or blue sea.
- **Layers:** four, each split at the spine and standing on its own page. The sky, dunes and cover worked first time. The headland painted its own sky twice, so it's cut out locally. The foreground came out too tall, so its hinge moved back to 115 mm and Pip's mark to x +46 mm, which keeps him on his own page.
- **Book:** the cover, its blank title panel and the trims (ribbon, two tabs, drawer pull, page edge) all came from two paintings.
- **Pip:** the pleading up-head seats on the real body at offset (-43, -14). The unlit lantern is the lit lantern's brass with the painted glass inside it, darkened locally because it came back milky. So the swap can't move the frame.
- **Legibility:** from the reference eye, Pip's coat clears the dunes by 40 to 63 L* in every mood, his head clears the sky by 24 to 32 in color difference, and the unlit lantern's glass clears the dunes by 29 to 45.

## What we learned

- **`cutout.py` reads the paper's color from the image border.** A piece painted to the edge gets inverted, so every cut piece needs a paper margin on all four sides. Shown by Codex's review before any credits were spent.
- **`--seal` breaks on textured colored paper.** It erodes the paper's grain until the flood can't spread, and keeps the whole image. Cut without it, and seal only to fix a real leak.
- **The painter paints what's behind a piece,** such as sky behind a lighthouse, even when told not to. Expect to cut that away by color, and ask for "no sky at all" up front.
- **Give heights as a fraction of width.** "Low" gave reeds more than twice the planned height. "No taller than one sixth of its width" brought them down by about a quarter, still well over the limit.
- **A sheet can arrive as a sheet on a sheet.** The trims came back as magenta paper on a white border. Crop to the paper before cutting.
- **Register new heads against the puppet, not the sheet.** Measuring the chin against `forward.png` and compositing on the real coat caught an offset of (-43, -14) that a sheet-relative check would have missed.
- **A shared account only works with a really clear window.** Phase A's was confirmed and still wasn't clear. Reconciling each invocation against list prices caught it.
- **2K costs 9 credits and 120 to 230 seconds.** 1K references stay under the 5 MB limit.

## Still unproven

Everything has been seen only on the Mac, in `art/m1-proof.html`. A fresh whole-branch review found pinholes from a cleaning step, milky lantern glass, and Pip crossing the spine, and all three are fixed and tested. Nothing has run in IWSDK or on the Quest. The proof's CSS 3D stands in for the headset, and the mouse stands in for your head. The flat card backs, the spine seam, the frame printed around the ground, and Pip against the dunes in real room light all need the headset.

## Reuse

Everything under `art/book/`, `art/sets/shore-path/`, `art/fx/`, `heads/up.png` and `parts/lantern-out.png` is product art. `key-lost-things.png` is the master reference for the shore. `key-plain.png` and `pip-up-frightened.png` are kept for later. `make_pieces.py` rebuilds every finished piece from this folder.

## Approval

Approved on the Mac by the owner on Nov 11, 2026, in `art/m1-proof.html`. Final approval happens in the headset once Ticket 1 can show the pieces.
