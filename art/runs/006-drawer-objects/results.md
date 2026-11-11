# Run 006 results

**Question:** can run 004's parts-sheet recipe paint the drawer's objects for M2 so they cut out cleanly and sit in Pip's paw in his style? **Yes.** All five are cut out, checked and named in `art/objects/`. The spool took one small repaint.

## What we made

| id | Tags | At the gap | Height | Pivot (paw) |
|---|---|---|---|---|
| `kite` | `flies`, `catches-wind`, `lightweight`, `fragile` | Lifts Pip over | 120 mm | Where the spars cross |
| `spool` | `rope`, `ties`, `rolls`, `lightweight` | Thrown across and hauled on | 70 mm | Center |
| `ladder` | `climbs`, `spans` | Laid across as a bridge | 150 mm | Left rail, 56% down, so it stands beside him |
| `odd-sock` | `soft`, `warm`, `lightweight` | Fails: worn as a scarf | 90 mm | Cuff |
| `brass-key` | `opens`, `shiny`, `heavy` | Fails: Pip tries to unlock the gap | 75 mm | Top of the bow |

Every PNG is at Pip's own density (905 px per 170 mm), so the stage can draw objects and Pip at one scale. `tests/art-objects.test.ts` checks every `object.json` against `ObjectDef` and the tag list, and checks that its art exists, it is at least 64 mm, and the drawer covers `flies`, `climbs`, `spans` and `rope` with at least one failure.

## What it cost

| Invocation | Job | Model | Size | List | Logged | Seconds | Balance |
|---|---|---|---|---|---|---|---|
| A | `objects-sheet` | `seedream5_pro` | 2K | 9 | 9 | 151 | 112043 → 112034 |
| B | `spool-sheet` | `seedream5_pro` | 1K | 5 | 5 | 121 | 112034 → 112029 |

**14 credits ($0.14) at list price, against a plan of 9 and a cap of 36.** Each invocation reconciles exactly against its log (`budget.attempted_cost`) and the balance, with nothing unexplained. Before A, the balance held at 112043 for a minute. Before B, it had moved by exactly our 9.

## Answers

- **The recipe holds.** One 2K magenta sheet cut into exactly five pieces without `--seal`. The kite's tail string and the spool's loose thread survived the cut.
- **The spool came out small.** The prompt gave relative heights, but the painter drew the spool at about 30% of the ladder's height, not 50%. That was 4.3 px/mm against 6.4–8.3 for the others, so it would have needed a 1.24× upscale and broken the shared-scale check (1.92× against 1.6×). With the owner's approval, it was repainted alone at 1K with its own crop as Figure 1. The design stayed identical, and it now sits at 9.9 px/mm (spread 1.55×).
- **Every piece had a dark fringe.** The painter's soft shadow on magenta paper is a deep crimson, about (98, 9, 36), just outside `clear_magenta`'s range. It's now eaten inward from every transparent edge, holes included, before despill. No object color has blue above green, so nothing painted is at risk.
- **"Die-cut paper piece" paints a sticker border.** The spool repaint used run 004's layer wording and came back with a white border and its own outer pencil line. It was removed for free by a flood bounded to 20 px from the edge, which crosses the border's outer line and stops at the object's own line. Two passes reach cream tucked into corners. The strip took under 15% of the piece, and the preservation check guards the rest.
- **Pip holds all five.** In `art/objects-proof.html`, each object hangs from the lantern's grip point by its pivot. Pip raises his arm only as far as the object needs to clear the table (the kite needs the most), and sets his lit lantern down beside him.

## Contact shadow, for the client

No shadow is baked into the art, because it would hang in the air while held. The proof draws them like this:

- **Resting:** a soft ellipse under the painted base, 0.9× the object's width, 7 mm deep, `rgba(10,8,12,.55)` fading to nothing at 70%.
- **Held:** straight below the object on the table, 1.3× its width, 11 mm deep, and lighter (`.32`), so it lifts and widens as the design language's Holding state says.

## Review

Codex reviewed the plan before any credits were spent. It found four P2 issues, and three were fixed: relative sizes went into the prompt, a paint-preservation check was added, and the per-invocation cap was corrected. The fourth, headset approval, was accepted in part. The record is in `docs/plans/2026-11-11-drawer-objects.md`.

## Still unproven

Everything has been seen only on the Mac, and in a flat page. Nothing renders objects in IWSDK yet. In the headset, check:

- The 64 mm grab, with your real hand, especially the key (75 × 29 mm) and the spool.
- The objects against Pip's coat and the dunes in night mood, in real room light.
- The held shadow on a real table.
- The ladder against the real gap, once the gap set exists. It's 150 mm long.
- The pivots once the client turns objects over in the paw.

## Reuse

Everything in `art/objects/` is product art. `make_objects.py` rebuilds all five from `objects-sheet.png` and `spool-sheet.png`, and exits non-zero on any problem. The first spool, on `objects-sheet.png`, is unused. `plan.json`'s first prompt is the recipe for later object sheets, with the learnings below.

## Approval

Approved on the Mac by the owner on Nov 11, 2026, in `art/objects-proof.html`. That approval is provisional. Final approval happens in the headset.

**Quest Browser, Nov 11, 2026 (items 1–4 below, passed).** The owner opened the proof in Quest Browser on the Quest 3, served over USB (`adb reverse` on `CLIENT_PORT`). All five objects were recognized, they look sharp, and their style matches Pip's. Pip holding each one looks right, and the subtle animation works. The moods look good. Every file loaded, and the browser's log showed no errors. This is still a flat page in the headset, not the immersive stage, so items 5–9 remain open until the Painted Stage Kit (ticket 1) and Hands and objects (ticket 2) render objects in IWSDK.

## Quest test, when the headset is connected

**Now, in Quest Browser.** Serve `art/` on the Mac (`python3 -m http.server 5100 --bind 0.0.0.0 -d art`, from the repo root, using `CLIENT_PORT` from `.env.ports`). Open `http://<Mac's LAN IP>:5100/objects-proof.html` on the Quest. It's a flat page, so this tests the art, not the interaction.

1. **Legible at arm's length.** Each object reads as what it is within 2 seconds, with no label.
2. **Style.** The objects look painted by the same hand as Pip, with no edge looking cut out or fringed.
3. **Night mood.** Tap Night. Each object stays distinct from Pip's navy coat, especially the key and the ladder.
4. **The failures read as jokes.** The sock and the key look like things Pip would cheerfully try, not like broken props.

**Later, once the client renders objects on the stage.** These need code outside this ticket.

5. **The 64 mm grab.** Pinch each object from the drawer with your real hand, especially the key (75 × 29 mm) and the spool.
6. **Contact shadow.** It shows under every object at rest, lifts and widens while held, and never floats.
7. **In Pip's paw.** Each pivot looks like a natural hold, including while he turns the object over.
8. **Real room light.** Edges read as card on a real table, with no colored fringe in passthrough.
9. **Ladder against the gap.** At 150 mm, it can believably bridge the gap set.

