# Run 008: the reading room, results

**Closed Nov 12, 2026.** Spent **41 credits** of the 60 cap, exactly the estimate: 5 for the key, then 36 for three flats and the tabletop. Phase B's tool cap was set to 55 before invoking.

## What was chosen

- **Key** (`room-key.png`): a night reading room in the book's watercolor-and-pencil palette, with a moonlit window, worn shelves, a brass clock, and an armchair by a lamp. Kept as the reference for any later interior.
- **Flats** (`art/room/flat-window.png`, `flat-shelves.png`, `flat-lamp.png`): each cut as one clean piece by `cutout.py`, then finished with run 006's recipe (the paper's shadow eaten inward from every edge, despill, magenta cleared) in `make_room.py`. Magenta at the edges went from about 20% of edge pixels to 0. Each is scaled to 2048 px on its long side.
- **Tabletop** (`art/room/tabletop.png`): full-bleed worn wood, scaled to 2048 px wide.
- `art/room/room.json` gives each flat's height, distance and angle around a seated reader, and the table's size.

## What we learned

- **Toy-theater flats come out clean on magenta** when each is painted alone at 2:3 portrait. The window and the shelves came back die-cut.
- **The lamp corner came back as a pale card with a shaped top,** not a free-standing piece. It reads well as a stage flat, so we kept it.
- **"Unlit" isn't fully respected:** the lamp shade still looks faintly lit. The stage's mood tint and house lights settle it.
- **In the room,** the flats need floor shadows and the table needs a body, or both float. That's code, not paint.
- Still to judge in the headset: the room as a whole, and how dark it should go.
