# What the AI mode should be (research, Nov 14)

**Why this exists.** In ticket 3's first headset session the owner played chapter 1 with the director's lines spliced in, and said: "If a story is already written and we try to interfere with it, it's not that fun … If I am just handing over the incorrect thing and then you get an AI response, I don't think there's anything dynamic in that. You can easily do that with an if-else … AI responses are just being read and not being spoken aloud … my immersion is lost." And: "I like the version of the story that we have currently." The director is now off for chapter 1. This note looks at what's out there, where the gap is, and where a real wow could come from.

## What exists

| Kind | Examples | What lands | What's missing |
|---|---|---|---|
| Text AI story games | AI Dungeon, Hidden Door, Friends & Fables, Character.AI | Endless, any premise | Text on a screen. When voiced, every character usually gets the same narrator voice, the most common complaint ([Arcanum review](https://arcanumrpgs.com/blog/ai-rpg-voice/)). Character.AI's voice "felt more like an extra feature than a core experience" ([Nenawow](https://nenawow.com/blog/character-ai-review/)). No stage, nothing physical |
| AI companions in mixed reality | Xiora, TykeAI, Convai's Maya on Quest 3 | A voiced character in your room, real conversation | Chat, not a story. No shape, no ending, nothing to watch ([Xiora](https://xiora.com/), [TykeAI](https://tykeai.com/), [Convai](https://convai.com/blog/meet-maya-a-3d-ai-avatar-you-can-talk-to-in-mixed-reality-on-meta-quest-3)) |
| Voice-to-character games | Suck Up! (2023): talk your way past AI neighbours | Went viral through streamers because what *you say out loud* changes what happens, and the character answers in voice, in character ([Steam](https://store.steampowered.com/app/2726370/Suck_Up/), [KYM](https://knowyourmeme.com/memes/subcultures/suck-up)) | A flat screen, one trick (persuade) |
| AI improv theatre | Improbotics, the Dallas troupe's AImee, AR+LLM improv (51 live shows) | The oldest magic in theatre: the audience shouts a suggestion and a show appears from it ([Improbotics](https://arxiv.org/pdf/1809.01807), [D Magazine](https://www.dmagazine.com/arts-entertainment/2024/03/a-dallas-improv-troupe-let-ai-take-over-its-show/), [ACM](https://dl.acm.org/doi/10.1145/3803784.3816886)) | Needs live human actors. Nobody has it at home |
| AI bedtime story apps | Night Light X, Bedtime Stories, Sleepytale | A calm voice telling a new story on your theme ([Night Light X](https://nightlightx.com/features/ai-bedtime-stories/)) | Audio only. Mostly for children |
| Authored VR theatre | Moss, our chapter 1 | Craft, a world, a character you care about | Fixed. The owner's first note: "I don't see any AI in it" |

## Why our first try didn't land

1. **It decorated a story that already decides everything.** The authored chapter resolves itself; the AI could only add words around it. Nothing you did could change *what happens*, so the AI felt like garnish.
2. **The trigger was a menu.** "Wrong object, then a line" is a lookup. The AI's answer was new, but the *shape* was if-else, so it read as scripted.
3. **It was silent.** Read-only lines next to voiced ones break the theatre.

## Where the gap is

Nobody stages a **live, voiced show made from what you say**, performed by real puppets on your real table. Text AI has the freedom but no stage. Companions have voices but no story. Improv has the magic but needs actors. Authored VR has the craft but is fixed. We already have the stage, the cast, the props, the light, the beam and the book. The missing pieces are **your voice in** and **their voices out**.

The wow is the improv moment: you say something no one could have planned for ("a grumpy teapot who lost its whistle"), and seconds later Wick is grumbling about a teapot, in his own voice, under the lamp, and the story goes somewhere because of it.

## What any AI mode needs

- **The AI decides what happens,** not only what's said: who goes where, what gets used, how it ends, within the stage's library (sets, cast, props, light, beam).
- **Every line spoken,** in each character's own voice. Runway's queued voices take 5–6 s a line, too slow for live. Streaming text-to-speech is around 190–260 ms to first sound in independent tests (Cartesia, ElevenLabs Flash) ([Coval via syftly](https://syftly.vercel.app/tts/lowest-latency-text-to-speech-api), [Deepgram](https://deepgram.com/blog/best-text-to-speech-apis-2026)). That needs a new paid account.
- **Your voice as input.** Speaking is what makes it feel open, not a menu. Speech to text is ticket 4's Talk, pulled forward.
- **Moments that wait for you,** like chapter 1's asks, where your answer is the next scene, not an ornament on it.

## Three shapes it could take

**A. Improv night.** A separate mode, offered after chapter 1 (the book's "Tonight's lost thing", reborn). The narrator asks for a suggestion, you say it out loud, and the cast performs a short new story from it, voiced live, on the existing sets. Two or three times the characters turn to you ("What should we try?"), and what you say *is* the next scene. Closest to the gap, and the biggest build.

**B. Your ideas inside chapter 1.** The authored chapter stays as it is. At its asks (the lantern, the wick, the gap), you can speak instead of handing something over: "Pip, use your coat as a sail!" The AI decides whether your idea works, and Pip acts it out with the nearest staging, in voice. The story waits for you, so your idea really is the turn. Smaller, keeps the story you like, but the staging is limited to what the cues can show (a coat-sail would borrow the kite's flight).

**C. Both, in order.** B first (chapter 1 gains "say anything" at its asks), then A as the AI mode after it. The most complete, and the most time.

Whichever we choose, chapter 2 and the satchel carry on as planned: "next episode changes because of the last" is authored craft plus memory, and doesn't depend on the AI mode.

## Cost and time, honestly

Voice in and voice out are the heart of every option, and that's ticket 4's work and a new paid account (live voices and speech to text: ElevenLabs, Cartesia or OpenAI, each with a free tier or pay-as-you-go; an estimate before buying). The deadline is Nov 18. A is about two days for a first playable version; B about one; C doesn't fit with chapter 2 unless something else is cut.
