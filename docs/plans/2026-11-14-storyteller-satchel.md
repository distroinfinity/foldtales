# AI Storyteller: your satchel keeps everything you make

*Plan, Nov 14, 2026. Owner's ask after headset session 2: "anything that we generate, let's save … so that if we want we can use them in the story later. Your catalog keeps on building as you play."*

## What you get

- **Everything painted is yours to keep.** When a painted thing has been on the page, it goes into your satchel. You don't have to do anything. When the evening ends, or you leave, a little flourish shows it tucked into the satchel.
- **The satchel sits on the table beside the book.** It's the same painted satchel as chapter 1 (run 007), and it's in the AI Storyteller too. Kept things peek out of the pocket.
- **Taking something out:** pinch the satchel's flap, or the gold top tab, and it opens. Pinch a kept thing and put it on the page. The cast reacts at once ("The dragon kite! He came back!"). To put it away, drop it over the satchel. That works today.
- **Asking for it out loud:** "Can you bring my dragon kite?" The cast knows what's in your satchel and brings it out. They don't paint it again, so it's free and instant, with no credits and no 25-second wait.
- **The cast remembers its story:** each kept thing carries one line of history, such as "Flew to the giant's couch on the first night (it didn't really)." The cast can use that line when it comes back.

## How it's built

1. **Keeping (client).** A painted thing that arrived on the page this evening is saved on the headset in IndexedDB, holding the picture and its def (name, description, size). That's per device, as agreed with the product workspace for v1. Pictures are about 100–400 KB each, and IndexedDB holds far more than localStorage. The cap is 48 things; past that, the oldest you never took out again makes room.
2. **The satchel in the Storyteller (client).** Show `stage.satchel` in story mode, and load kept things into it as `ShowObject`s with `origin: 'satchel'`. Hands, dropping in and taking out already exist (`objects/hands.ts`, `restingHome`).
3. **Telling the cast (backend prompt, no contract change).** The turn request already carries `stage.objects` with their origin. Satchel things go in with `origin: 'satchel'`. The storyteller rules gain: *"Things in the reader's satchel can be brought out with PLACE or GIVE. Never PAINT something the satchel already holds."* With PLACE/GIVE of a satchel thing, the client takes it out of the satchel onto the page.
4. **Lighter requests.** Turn requests today send each painted thing's whole picture to the backend on every turn. The backend never needs the picture. The client will send an `asset` reference instead of the data URL, so a satchel of 48 things doesn't make every turn heavy.
5. **History.** At the end of an evening, the app writes one sentence per kept thing from what happened to it, as chapter-end memory already does for chapter 1.

## Not in this step

- **Across devices, or following your account.** That needs the backend to store the pictures, a new storage route, and a contracts PR. Later, if wanted.
- **A contents page of everything you've made**, printed in the book. That's a nice follow-on, and it goes in `docs/v2-ideas.md`.
- **Sharing kept things with friends** (Story Circle).

## Checks

- `pnpm test` and `pnpm check:bundle` stay green. Typecheck.
- In the headset:
  - paint something, leave, and come back: it's in the satchel;
  - take it out by hand: the cast reacts;
  - ask for it by name: it comes out with no new painting (the backend log shows no Runway call).

## Cost

None on its own. It *saves* Runway credits, because things you already have are brought back, not painted again.
