# Legal copy: Terms, Privacy, credits and attribution

Lane E writes these words. Lane D owns the Storyteller's surfaces. Paste them as written. A change of meaning comes back here first. Nov 16, 2026.

**On the site since Nov 17 (lane E, after lane A closed):** Terms at `/terms/` (`client/src/pages/terms.tsx`, linked from the page's foot and from Privacy), Privacy and About's credits as below.

**Decided by the owner (Nov 16):**
- The contact is **manurajput2911@gmail.com**, public on Privacy and Terms.
- **No minimum age is stated** for now.
- **Live painting is on at submission.**

## What the third parties require of us

Read on Nov 16. Each is quoted or paraphrased from the source linked.

| Service | Used for | What it requires of us | Source |
|---|---|---|---|
| **Runway** (API) | Live painting in the Storyteller (on at submission). Prepared art, chapter voices and sound effects, made before release | **"Powered by Runway", linked to runway.com, "on applicable user interfaces"** (§1). **Every end user bound by an enforceable end-user agreement** "no less protective" of Runway on authorisation scope and restrictions, ownership of IP, and compliance with Runway's policies (§2.5). We must cut off a user we learn breaks them. Runway claims no ownership of outputs and doesn't restrict their commercial use (§4.4). It may train on inputs and outputs (§4.4). Outputs "may not be unique" (§10.1) | [Terms of Use](https://runway.com/terms-of-use), Oct 23, 2026; [API attribution](https://docs.dev.runwayml.com/usage/attribution) |
| **OpenAI** (`gpt-4o-mini-tts`) | The Storyteller's live voices | **Tell listeners clearly that the voice is AI-generated, not human.** Don't strip OpenAI's AI-origin markers, and make end users follow the same rules (Service Terms; TTS guide). API data isn't used for training, and is kept up to 30 days for abuse monitoring | [TTS guide](https://developers.openai.com/api/docs/guides/text-to-speech), [Service Terms](https://openai.com/policies/service-terms/), [Your data](https://developers.openai.com/api/docs/guides/your-data) |
| **Groq** (Whisper) | Speech in: understanding what the reader says to the Storyteller | Not used for training. **Zero Data Retention is a self-serve setting** in GroqCloud's Data Controls. Its default retention is stated inconsistently. **Recommend: switch ZDR on** (owner or lane D), so the privacy line below is exact | [Your data](https://console.groq.com/docs/your-data) |
| **Anthropic** (Claude) | Writing the Storyteller's story | API inputs and outputs aren't used for training. Its usage policy applies to what readers ask for | Anthropic commercial terms and usage policy |
| **ElevenLabs** (through Runway) | Chapter voices, recorded before release. No live use any more | Covered by Runway's terms as a Runway output. Keep run 005, 010 and 012's manifests as evidence (`art/runs/`) | `art/runs/*/manifest.jsonl` |

### "Powered by Runway", and the competition's brand rule

The competition's rules say projects must not contain "commercial or corporate advertising (including … corporate logos, brand names, and slogans)". Runway's terms require "Powered by Runway" where its service is used.

**How we meet both:**
- An attribution that a licence requires is a credit, not advertising.
- It goes in **plain text, with no logo, at caption size**, and only where Runway's work appears:
  - **On the page (lane A):** in the AI Storyteller's section, subtle, in plain text: "Pictures painted live by AI, powered by Runway". "Powered by Runway" links to https://runway.com.
  - **On About:** in the credits (below).
  - **In the book, where a live painting appears:** the satchel or collection card for a painted thing prints "Painted live · Powered by Runway" in small type on the card's paper. Inside XR there's no link to follow, so the page and About carry the link.
- Never in the story's own art, the cast's lines or the video's frames, except About's credits.
- **Prepared art:** Runway made it, but the app doesn't call Runway for it. The About credit covers it.

This is our reading, and a judge could see it differently. Live painting stays on at submission (owner, Nov 16), so the attribution ships as above: subtle, in plain text, and only where painting appears, plus About.

## Terms of use (a new page, `/terms/`, linked from the page's foot beside Privacy)

> **Terms of use**
>
> Foldtales is a storybook you read with your hands on Meta Quest. By using it, you agree to these terms.
>
> **Using Foldtales.** You can read the chapters without an account. The AI Storyteller needs you to sign in. Please use it kindly: don't ask it for anything hateful, sexual, violent, or that breaks the law or hurts someone, and don't try to make it do so. Don't copy, scrape or resell Foldtales or anything it makes, or use what it makes to build or train another AI service.
>
> **The AI Storyteller.** Its stories, its voices and any pictures it paints for you are made by AI as you go, from what you say and give. The voices you hear are AI-generated, not people. AI can get things wrong or be surprising. If something feels off, close the book.
>
> **Who owns what.** The book, its characters, its art, music and words belong to us. What the Storyteller makes for you is yours to keep and enjoy for your own, personal use, alongside the rights of the services that help make it.
>
> **Services we use.** The Storyteller uses AI services from Anthropic (the story), OpenAI (the voices), Groq (understanding your voice) and Runway (pictures). By using the Storyteller, you also agree to follow their usage policies:
> - Anthropic: https://www.anthropic.com/legal/aup
> - OpenAI: https://openai.com/policies/usage-policies/
> - Runway: https://runway.com/terms-of-use
>
> **If you break these terms,** we may stop your access to the Storyteller.
>
> **No warranty.** Foldtales is free during the Meta VR Start Developer Competition, and is provided as it is, without warranties. As far as the law allows, we aren't liable for any loss from using it.
>
> **Changes.** We may update these terms; the date below changes when we do.
>
> Questions: manurajput2911@gmail.com. Last updated November 2026.

*Why each part is there:*
- "Using Foldtales", "Who owns what" and "Services we use" carry Runway's §2.5 protections: scope and restrictions, IP ownership, and compliance with its policies.
- "The voices you hear are AI-generated" meets OpenAI's disclosure.
- No minimum age is stated (owner, Nov 16). Sign-in through Google already requires its own minimum age.

## Privacy (replaces the text in `client/src/pages/privacy.tsx`, same layout)

> Short version: you can read the book without telling us anything. If you sign in, we keep your name, email and your place in the book, and you can delete it all.
>
> **Without an account**
>
> Your place in the book is kept in this browser, on this headset. The app sends us anonymous performance numbers (frame rate and errors) under a random device code, so we can fix problems. It's kept on our server in the US. Nothing in it identifies you.
>
> **With an account**
>
> When you sign in with Google or an email code, we keep your name, your email, and your book: which chapters you've read and where you stopped. That's what lets you continue on another headset. Keepsakes you find in a chapter stay on the headset they were found on.
>
> **In the AI Storyteller**
>
> - What you say is sent to Groq to be turned into words.
> - Those words, and what you give the characters, go to Anthropic's Claude to write the story.
> - The characters' lines go to OpenAI to be spoken. The voices you hear are AI-generated.
> - If you ask for something to be painted, your request goes to Runway, which paints it.
> - Anthropic, OpenAI and Groq don't use what you send them to train their AI. They may keep it for a short time to check for misuse, as their policies allow.
> - Runway's terms let it use what you ask it to paint, and the pictures it makes, to improve its AI. Don't ask for a picture of anything private.
> - The shapes of your room from your Quest's Space Setup (where the table, couch and walls are) are described to the AI as text, so the story can use them. No pictures of your room are ever taken.
> - Your microphone is only on while you hold the talk button, and we never store recordings.
>
> **Deleting your book**
>
> Signed in, open **Sign in** at the top of the page, then **Delete my book**. It removes your account, your book, and every headset linked to it. Without an account, clearing this site's data in the browser removes everything.
>
> **Questions:** manurajput2911@gmail.com

*Checked against the code and the plan:*
- "Frame rate and errors" is all that telemetry sends today. The old page also said "load time", which it doesn't send.
- The training line names each service: Runway's terms (§4.4) allow it to train on inputs and outputs, so there's no blanket no-training promise (Codex, PR #33, point 4).
- Groq's line makes no "isn't kept" promise (Nov 17): it's true whether or not Zero Data Retention is on. Switching ZDR on is still recommended.
- "Only on while you hold the talk button" is ticket 3's microphone rule (PR #9 review fix).
- Lane D: confirm each line still matches the live-voice and speech-in move.

## About's credits (replaces the Credits list in `client/src/pages/about.tsx`)

> **Credits**
> - **Art:** painted with AI (Seedream, through Runway) from our own designs and references, then cut out, finished and rigged by hand.
> - **Chapter voices and sound:** ElevenLabs voices and sound effects, made through Runway before release.
> - **Music:** "Piano Ambience chord progression 82bpm" by CVLTIV8R, from Freesound, under CC0. (CC0 asks for no credit; it's given anyway. Drop this line if the bed is dropped.)
> - **The AI Storyteller:** stories by Anthropic's Claude. Voices by OpenAI, and AI-generated. Listening by Groq. Live pictures powered by [Runway](https://runway.com).
> - **Type:** Fraunces, Atkinson Hyperlegible Next and Cormorant Garamond, under the SIL Open Font License.
> - **Code:** Immersive Web SDK, Three.js, troika-three-text, React, Motion, Tailwind CSS and others, under their open-source licences, with components adapted from Magic UI.
>
> [Third-party notices](../notices.txt): every licence, in full.

The `notices.txt` link: the build writes `notices.txt` at the site's root (`client/vite/notices-plugin.ts`), and the offline cache holds it.

**One open gap:** `@drawcall/uikitml` 0.1.8 is bundled because IWSDK depends on it, and it publishes no licence, neither in its package nor its repository. `notices.txt` lists it as "none published". I've told the sprint master. Options: ask IWSDK's maintainers, or check whether tree-shaking can drop it.
