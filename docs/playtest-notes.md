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
