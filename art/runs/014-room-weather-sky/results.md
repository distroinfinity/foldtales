# Run 014: room weather and sky, results

**Closed Nov 15, 2026.** Spent **23 credits** of the 35 cap (the owner approved up to 180 for the room effects' art and sound): the weather sheet (9), the sky sheet (9) and the snow cover (5). The shared balance went from 110,803 to 110,780 over the run, exactly this run's spend, after a minute's check that nobody else was painting.

## What we made

`make_pieces.py` rebuilds all of it from this folder, for no credits.

- **`art/room-fx/weather/rain-strokes.png`**: eight raindrop streaks, stood upright (the drop at the bottom), in one strip of 64 x 512 px cells. The storm draws 1,400 of them.
- **`art/room-fx/weather/snow-flakes.png`**: ten snowflakes, five soft puffs and five six-armed, in one strip of 128 px cells.
- **`art/room-fx/weather/fog-1..4.png`**: four long soft wisps of fog.
- **`art/room-fx/weather/snow-cover.png`**: fresh snow seen from above, made to repeat (1024 px square).
- **`art/room-fx/sky/stars.png`** (six stars in one strip), **`moon.png`** (a crescent with a sleepy storybook face) and **`shooting-star.png`**.
- Contact sheets on night navy: `contact-weather.png`, `contact-sky.png`.

## What changed after painting

- **Rain came out slanted and teardrop-shaped**, more like icicles than streaks. Stood upright by each piece's own main axis; at rain size and about half opacity it reads as rain in the emulator.
- **Fog came out lilac.** It's a thin wash, so the magenta paper showed through. Recoloured to the pale blue-grey it was painted as, keeping its lightness and alpha, so the brushwork stays.
- **The fog wisps came in two rows of two,** not one row of four.
- **The stars, moon and shooting star have a thin white paper edge.** Kept: stripping a white edge eats pale paint (run 011's wick), and paper stars suit a pop-up book.
- **The soft snow puffs and fog lose a little of their soft outer edge** to the shadow clean-up. Noted as warnings, not failures.

## What we learned

- **Thin washes on magenta paper take its colour.** Fog, mist and anything translucent: either paint it on a neutral paper, or recolour after cutting by keeping lightness and alpha.
- **"A slender stroke" paints as a teardrop with an outline.** For rain, ask for "a fine hairline streak with no outline" next time, or draw it in code.
- **A paper-doll parts sheet of small sky pieces paints them with a sticker edge,** even without the words "die-cut".
- **A full-bleed texture repeats for free** by blending it with its half-offset self under a soft window.
- **Still to judge in the headset:** the storm (rain), then the night sky and snow and fog when they're built.
