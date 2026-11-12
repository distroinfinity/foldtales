# Playtest notes

What the owner noticed in the headset, in plain words. These come before new features.

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
