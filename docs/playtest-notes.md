# Playtest notes

What the owner noticed in the headset, in plain words. These come before new features.

## Open items

- [x] Pixelated on the Quest. Sharper on Nov 12 after the 1.4× render resolution and blended edges.
- [x] Floating and following the head. Caused by the test mode, and gone with real tracking.
- [x] Pip floating, not on the table. Fixed by aiming the rays lower, and confirmed in the headset.
- [x] Pip appearing in the air and then jumping. Fixed by starting the 5 s clock once the rays exist.
- [x] Show the surface when it's found, with a hint to look at the table while searching. Built as "ember and wash" (ticket 1); the owner liked it in the headset on Nov 12.
- [x] Room dim, so Pip doesn't compete with a bright room. The first look on Nov 12 was too weak; darker and tighter around the book since, and accepted at the M1 sign-off on Nov 13.
- [x] The ribbon was hard to find and its pause went unnoticed (Nov 12). Moved to the near edge, and a pause now lifts the ribbon and brings the lights partway up. On Nov 13 it still needed a reach above the page (see session 2); after that the owner could use it "clearly".
- [x] The cover's grab spot was hard to find (Nov 12). The whole outer edge is now the target, reachable from above (Nov 13). The owner opened and closed it easily.
- [x] Resizing the book by hand (owner request, Nov 12): two-handed stretch on the outer edges, 0.6× to 1.3×. "Resizing works correctly" (Nov 13).
- [x] The book sat at or past the table's rim, so it felt sunk in and hard to reach (Nov 13). It now settles fully on the scanned table top; confirmed in the headset ("feels nice").
- [ ] The two-handed stretch may be too sensitive: in session 2 it jumped between 0.6× and 1.3× within 2 s several times. Watch for it; damp it if the owner finds it twitchy.
- [ ] ⏸ Hosted preview link, so testing needs no USB. Held with ticket 0's Task 7.

## Nov 11, 2026: first look at Pip on a Quest 3 (M0, not signed off)

Run from the Mac over USB, in a room with a desk.

- **"Very pixelated 2D JPEG."** It looked good on the laptop, and very pixelated on the Quest. The owner doubts this will work. Still open.
- **Floating, moving with the head, not on the table.** Caused by the test mode (`--native-xr-control`), which replaced real head tracking with a fixed fake pose. Not yet seen without that mode.
- **Two black controller shapes that follow the view.** The same test mode's synthetic controllers.
- **No way to start.** That mode also turns off the browser's enter prompt, and the page had no button. A Begin button was added.

Telemetry from that session: a real AR session with passthrough, median 90 fps, low 52 in the first 10 seconds, no errors. It was drawn from the fake pose, so it says little about placement.

The pixelation was seen only in the test mode and at the browser's default render resolution. The render resolution is now 1.4×, which hasn't been seen in the headset yet.

### After, on the Mac only

The cards were cut hard at 50% alpha, relying on multisampling to smooth the cut, which the Quest's multiview rendering may not do. Pip's edges fade over thousands of pixels, and the hidden pixels are paper-coloured. The cards are now blended from premultiplied textures, which keeps paper out of the filtering, and only pixels under 25% alpha are dropped, which removes the pale rim. In the emulator this is clearly smoother than the hard cut, and has less rim than blending everything. Not yet seen in the headset.

## Second Quest session, Nov 12, 2026 (seated at a desk, daylight)

Plain build over USB (`vite preview`, https), real tracking.

- **Better.** Sharper than the first session. Pip is static in the room, and the black controllers are gone.
- **Floating, not on the table.** Telemetry: `stage_fit` fallback at 5 s, then `hit_test` about 90 s later, when Pip moved to the table once. Cause: the rays aimed about 32° below gaze, so seated and looking ahead they landed about 72 cm out, past the 60 cm reach rule. *Fixed:* two rows of rays at about 42° and 51°, tested to land within reach from 40 to 50 cm above a table.
- **Owner's note: show the surface when it's found.** Right now nothing tells you the theater runs on your table. Before Pip (or the book) appears, show the found surface (for example a painted ring or wash spreading across the table, with a line printed on it like "Your theater will play here") and, while searching, a hint to look at your table. It must follow `design-language.md` (painted, text on a surface, no floating UI). Belongs with the opening in ticket 1 (Painted Stage Kit, M1's "the book unfolds"), and needs a design pass first.
- **Owner's note: the room dim will help.** Without the planned "theater lights down" dim, Pip competes with a bright room. The dim is in ticket 1.
- Telemetry: median 90 fps, low about 81–83 fps.
- **After the ray fix (same session):** Pip found the desk and stood on it, and the owner said the animation looks good: "I think we are good here." Telemetry showed one leftover: the 5 s fallback fired 0.8 s before the table hit, so Pip appeared in the air and jumped. *Fixed:* the 5 s clock now starts once the rays exist (at most 3 s of setup), and the rays are requested together. Also fixed: a 403 s "hitch" that was really the headset being taken off; gaps over 5 s now count as pauses.

## M0 sign-off, Nov 12, 2026

**Signed off by the owner on the Quest 3**, from a local production build over USB rather than a preview link, because the owner chose to hold hosting until later. Pip stands on the real table, static in the room, breathing, with the lantern glowing, at 90 fps. Open for ticket 1: the found-surface moment and the room dim (above), and the hosted preview link (Task 7).

## Ticket 1, headset session 1, Nov 12, 2026 (review build over USB, daylight, book found on the bed)

- **Liked:** the found-surface moment ("really nice"), the book laid flat on the found surface, the cards and Pip turning to face you as you move, the book opening and closing. "This 2D theater … I really like."
- **Moving by the spine:** "feels nice", and the soft gold glow near a control "felt nice and intuitive".
- **Closing by the left page:** worked, and the open and close animations look nice. The grab spot is hard to find: make the target bigger. *Fixed:* the whole outer edge is the target.
- **Ribbon (far right corner):** couldn't find it or tell it did anything. The log showed it had paused the show three times without the owner noticing, because a pause during the waiting moment looked like playing. *Fixed:* the ribbon now lies at the near edge, and a pause lifts it and brings the house lights partway up.
- **Headset off and on:** tried several times, and the theater stayed in place each time.
- **Owner request:** resize the book by hand. *Built:* a two-handed stretch.
- Telemetry: AR with passthrough, plane-based placement at 0.7 scale, median 90 fps, low 79–82 fps, about 85 draw calls, no errors. Two hitches of 156–177 ms in the first 4 s: one at session start, one as the book appears (to investigate).
- Still to check: whether the room dim reads by eye, the beam (P5), the cast review frame rate, the two edge materials, and occlusion.
- **Room dim:** "not that effective. I could still see a lot of illumination in the rest of my room." Cause: the falloff was wide and slow, so most of the room in view while looking at the book was only half dimmed. *Changed:* 80% at the edges (from 68%), and a pool that hugs the book with a faster fall to dark. Tune it live in the headset next.

## Ticket 1, headset session 2, Nov 13, 2026 (review build over USB, evening, seated low at a coffee table)

- **Opening with sound:** "nice". The narrator voice is "okay … fine for now"; no more time there.
- **The book wasn't on the table:** "it's on the same surface as the table … the book feels like it's inside the table so my hand is not able to reach the book. It's not easy for me to pull the ribbon or turn the page from the left."
  - What I measured: the Space Setup table is at 0.412 m with an outline from about (0.10, −0.48) to (0.69, −0.23) on its near side. The hit test caught the table's rim, so the book's centre landed about 3 cm off the near edge, half over the floor. Since the centre wasn't inside any scanned outline, placement never checked that the book fit on the table.
  - Also, every grab target sat exactly at page level. Fingertips stop on the wood, so a pinch lands a few centimetres above it and missed.
  - *Fixed:* targets now reach 5 cm straight up. The cover swings from wherever you grab it, rather than jumping to your hand's angle. A hit near a scanned table now settles the whole book onto its top, at the table's height, as near you as it fits, at the largest size that fits. On this table that means full size, centred where the owner had slid it by hand.
- **After the reach fix:** "I was able to open/close the book and interact with the ribbon clearly. Now it's nice."
- **Room dim (80%):** visibly darker in the captures; the owner didn't comment.
- Telemetry: AR with passthrough, hit-test placement at full size, median 90 fps, low 78–80 fps (45 in the first 10 s), 80–89 draw calls, no errors. Hitches: 234 ms as the session starts (landing) and 219 ms at warm-up.
- **Stretching with two hands:** "resizing works correctly." Range used: 0.62× to 1.3×.
- **Leaving and coming back:** the owner said it was fine and skipped a retest (in session 1, taking the headset off and on kept the theater in place).
- **Painted room:** "I love the painted room effect. It's actually landing better than noticeable in my real life."
- **All three characters (cast review):** "look nice." Bug: when the book shut, Wick and Moth stayed out in the air beside it. *Fixed:* extra characters now hide with the pop-ups; checked in the headset (both hidden while shut). Frame rate with all three: median 89–90 fps, low 49–67 fps while the owner was closing, stretching and lifting the ribbon, about 120 draw calls, no errors. Hitches only at session start (319 ms) and warm-up (208 ms).
- **Ribbon over the caption:** the ribbon's tail crossed the caption's last words. *Fixed:* the ribbon moved toward the corner and the caption narrowed slightly; checked in the headset.
- **Lighthouse beam (P5):** "Looks amazing … it's reflecting in my room, this is too cool." The sweep shows as a lighter wedge moving across the real room.
- **Open item:** the stretch jumped between its smallest and largest size within 2 s several times; it may be too sensitive to land on a size in between. Not raised by the owner.

## M1 sign-off, Nov 13, 2026

Signed off by the owner in the headset after a fresh run of the opening, the beam and the painted room: "this looks good … good to clean up, merge changes and move forward."
