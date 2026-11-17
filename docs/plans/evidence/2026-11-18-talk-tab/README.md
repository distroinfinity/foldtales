# Hold to talk, out of the drawer (F1-talk-tab, 2026-11-18)

Owner, headset, prod 622f5f8: "The hold-to-talk button is very hard to press. It's like underneath my table right now." The tab lay on the table in front of the right page, which is where the drawer slides out, so the drawer's objects covered it. On a book near the table's edge, it also hung past the edge.

Fix (minimal, as the owner asked): the tab now sits on the book, tucked under the left page's near edge like the book's paper index tab. It sits at page height, above the table, away from the drawer (which is under the right page) and away from the satchel on either side. The tucked part is under the page, so the caption's words stay clear. The look, the fingertip press and the far gaze/ray + pinch fallback are unchanged. Chapter mode is unchanged: the tab only shows in the Storyteller.

Emulator, chapter 1 at the gap ask with the drawer open (`?chapter=1&jump=gap-ask`). The tab is forced visible here to show its place, because the emulator can't hold a live Storyteller session.

- `before-talk-tab-ch1-gap.jpg`: the tab is in the open drawer, covered by the ladder and the sock.
- `after-talk-tab-ch1-gap.jpg`: the tab is at the left page's near edge, readable and clear of the drawer and its objects.

`tests/talk-tab-spot.test.ts` checks the placement against `drawer.json` and `satchel.json` at three page heights.
