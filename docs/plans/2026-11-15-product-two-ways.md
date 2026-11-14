# The page, reshaped for two ways to play

**Status:** Approved by the owner on Nov 15. The four decisions below were made with the owner on question cards.

**Why.** The owner: "there is just open book/send. How do we showcase story chapters and the AI mode, and how does a user select story or AI mode? Think about the usage flow, information flow and cognitive load." The product has changed since the page was designed:
- The AI Storyteller is now a full second way to play (M3, signed off: "I actually felt immersion"), not a side door.
- The written side is growing into a library, as the owner writes more chapters.

The page still tells a one-product story: the hero is the book's title with one button, and the AI Storyteller sits five screens down.

## Decisions (owner, Nov 15)

| Question | Decision |
|---|---|
| How the hero presents the two ways | **Two equal doors**, side by side, as the first thing you see |
| Their names | **Listen to a story** (Tales from the Table's Edge) and **Make one up** (with the AI Storyteller) |
| The AI on the live site | **On now, capped.** The keys go on Railway only. The backend's daily caps per headset and in total, plus 6 paintings an evening, guard the cost |
| Picking among written stories | **The door opens a small shelf** once there's more than one story. With one, the door opens it directly |

## The page

```
┌ hero (one screen) ─────────────────────────────────────────────────────────┐
│ Foldtales                                                                   │
│                          Foldtales                                          │
│              A living storybook on your table.                              │
│                                                                             │
│  ┌ Listen to a story ─────────────┐  ┌ Make one up ──────────────────────┐  │
│  │ (the book, closed, lamplit)    │  │ (Pip, Wick and Moth on the shore, │  │
│  │ Tales from the Table's Edge    │  │  a line of theirs as a subtitle)  │  │
│  │ A written story in chapters.   │  │ with the AI Storyteller           │  │
│  │ You reach in and help.         │  │ Talk to them. They answer in      │  │
│  │ Chapter 1 takes about six      │  │ their own voices, and anything    │  │
│  │ minutes. Just your hands.      │  │ you imagine appears. Uses your    │  │
│  │ [ Open the book ]              │  │ voice. [ Start a story ]          │  │
│  └────────────────────────────────┘  └───────────────────────────────────┘  │
│                      ˅ See both in action                                   │
└─────────────────────────────────────────────────────────────────────────────┘
┌ "Listen to a story": the pinned scroll that opens the real book (as today) ┐
│ It opens on your table · Reach in · The lighthouse lights your room         │
└─────────────────────────────────────────────────────────────────────────────┘
┌ "Make one up": a pinned scroll in three beats, from the real art ──────────┐
│ 1. Talk to them.  The cast on the night shore; your line, then theirs,     │
│    as subtitles.                                                            │
│ 2. Anything you imagine appears.  "Could you find me a key?" Moth flies    │
│    off and comes back with a painted brass key.                             │
│ 3. Your room joins in.  The armchair from your room: "Look, a great soft   │
│    mountain!"                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
┌ end ───────────────────────────────────────────────────────────────────────┐
│ Two ways to spend the evening.  [ Open the book ]  [ Start a story ]       │
│ You'll need a Meta Quest 3 or 3S. A table helps.                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

- **Each door says what you'll do, how long it takes, and what it needs:** your hands, or your voice. One button each. Returning readers see their state:
  - **Listen to a story:** "Continue chapter 1" with "Start from the beginning" under it, or "Read chapter 1 again".
  - **Make one up:** "Back to your story" when you've just been in it.
- **The microphone.** "Start a story" asks for the microphone first if the browser hasn't granted it, then the button reads "Open the AI Storyteller". XR has to start in its own tap, so that's two taps the first time and one after.
- **On a desktop or phone,** the doors keep their words but lose their buttons. One "Send to your Quest" sits under both, since either way is played on the Quest.
- **The shelf:** when `libraryState()` lists more than one story, "Open the book" becomes "Choose a story". It opens a paper sheet of stories and chapters, each with Continue or Start, with the next one marked. Today, with one chapter, that step doesn't exist.
- **The look** stays the approved one: the reading room at night, Cormorant Garamond, paper for things you open, rust for the book's door, sea sage for the Storyteller's.
- **The 3D book moves out of the hero** into the "Listen" section, which it demos. The hero is calm: two painted cards and the words.

## Turning the AI on in production

- **Railway:** `ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY` and `RUNWAYML_API_SECRET` are copied from `.env.local` through stdin, never printed. `PAINT_CREDIT_CAP` stays 100. Sign-in stays off, so the caps count per headset.
- **Pages:** `TT_PUBLIC_STORYTELLER` is removed, so the door is on.
- **Check:** a storyteller turn against the live API from the Mac, and the cap counters.

## How it's built

| Unit | Where |
|---|---|
| The hero with two doors | `client/src/landing/hero.tsx` (new), `app.tsx` |
| The doors' state (book progress, mic, back-to-story) | `actions.tsx`, `storyteller.tsx` |
| The "Make one up" pinned scroll | `storyteller.tsx`, rebuilt as a scrubbed section using the existing art |
| The shelf sheet | `sheets.tsx` (shown only when there's more than one story) |
| Words | `page-content.json` (the page's code names no character) |

**Not in this:** in-book menus, new art (no credits), sign-in.

## Checks

- `pnpm check` green.
- Mac screenshots and a scroll recording at 1280 × 670, 1440 × 900 and 390 × 844.
- The emulator: both doors enter XR, and leaving comes back to the right state.
- The live site after merge: both doors on the Quest.

## Built and checked (Nov 15)

- **The hero:** Foldtales, one line, and two equal doors: painted windows, words, and buttons of the same size in rust and sea sage. On the Quest's 1280 × 670 window, both buttons are above the fold.
- **"Listen to a story":** the existing pinned scroll that opens the real book, now introduced by its own headline.
- **"Or make one up, out loud":** a new pinned scroll (`storyteller.tsx`) in three beats from the existing art. Talk to them; anything you imagine appears (Moth fetches a key); your room joins in (your armchair). Subtitles are written as they're said.
- **The end:** both doors again, then what you need.
- **Desktop and phone:** the doors keep their words, with one "Send to your Quest" under both.
- **The AI on in production:** the keys are on Railway (through stdin, never printed), and the backend runs "director and storyteller: claude; voices: elevenlabs" behind its caps. The Pages build no longer switches the door off.
- **Checks:** `pnpm check` green (771 tests). Mac screenshots at all three sizes, with no errors. In the emulator, "Open the book" enters immersive-ar and comes back as "Continue chapter 1", and the Storyteller door enters XR (one tap with the microphone allowed; "Start a story" first without).
- **Not yet:** the shelf. With one chapter in the build, the door opens it directly, as decided; the shelf comes with the second story.
