# Lane D: the AI Storyteller, finished

*Finish sprint, Nov 15, 2026. Branch `finish-ai-storyteller`. Sign-in is required for the AI (owner's decision). It's built and switched off; this lane turns it on end to end.*

## Owner's setup checklist (do this first, today)

About 45 minutes of clicking, plus up to an hour waiting for DNS. **Type secrets only into Railway's dashboard, never into this chat or a `!` command,** so they stay out of every log.

### Already done (checked Nov 15, values not shown)

Railway, project `foldtales`, service `backend`, already has: `BETTER_AUTH_SECRET` (64 hex), `BETTER_AUTH_URL=https://api.foldtales.xyz`, `TT_CLIENT_HOST=www.foldtales.xyz`, `TT_TOKEN_SECRET`, `TT_ADMIN_TOKEN`, `DATA_DIR=/data`, `NODE_ENV=production`, and the AI keys. `https://api.foldtales.xyz/healthz` answers 200, and `/v1/auth/google/start` answers with a clean "Google isn't set up" return. Nothing to generate.

**Local values, this workspace only.** `.env.local` here is a link to the main checkout's file, shared by every workspace, so this lane's values go in `.env.workspace` (ignored by git, readable only by you). The backend's dev script loads it after `.env.local`, and later values win. It holds this workspace's own `BETTER_AUTH_SECRET`, so a dev restart keeps you signed in.

### 1. Google sign-in client (about 15 minutes)

At [console.cloud.google.com](https://console.cloud.google.com), signed in as the account that should own it:

- [ ] **Project:** top bar → project picker → **New project**, name `Foldtales`. Select it.
- [ ] **Google Auth Platform → Get started.** App name `Foldtales`. User support email: yours. Audience: **External**. Contact email: yours. Agree, **Create**.
- [ ] **Branding:**
  - App home page: `https://www.foldtales.xyz`
  - Privacy policy: `https://www.foldtales.xyz/privacy/`
  - Authorized domains: `foldtales.xyz`
  - **No logo.** A logo sends the app to Google's brand review, which takes days. Save.
- [ ] **Data Access → Add or remove scopes:** tick exactly `openid`, `.../auth/userinfo.email` and `.../auth/userinfo.profile`. Update, Save. All three are non-sensitive, so no verification.
- [ ] **Audience → Publish app → Confirm**, so it says **In production**. In Testing, only listed test users (not judges) can sign in.
- [ ] **Clients → Create client:**
  - Type: **Web application**, name `Foldtales web`.
  - Authorized JavaScript origins: `https://www.foldtales.xyz`
  - Authorized redirect URIs, exactly these two:
    - `https://api.foldtales.xyz/v1/auth/callback/google` (the live site)
    - `http://127.0.0.1:5121/v1/auth/callback/google` (testing in this workspace)
  - **Create.** Keep the dialog open.
- [ ] **Into Railway:** [railway.com](https://railway.com) → `foldtales` → `backend` → **Variables → New variable**, twice:
  - `GOOGLE_CLIENT_ID` = the Client ID
  - `GOOGLE_CLIENT_SECRET` = the Client secret

  Then **Deploy** the staged changes. That's safe: sign-in stays hidden on the site until I turn it on.

Google says a new client can take from 5 minutes to a few hours to start working.

### 2. Facebook Login, the Meta-account option (about 15 minutes)

Meta account sign-in isn't offered to web apps, so Facebook Login is the Meta-world choice beside Google and the phone code. At [developers.facebook.com](https://developers.facebook.com), signed in with the Facebook account that should own the app (register as a developer if it asks):

- [ ] **My Apps → Create app.**
  - App name `Foldtales`, app contact email: yours.
  - Use case: **Authenticate and request data from users with Facebook Login**.
  - Business portfolio: **I don't want to connect a business portfolio yet.**
  - Finish, then **Create app** (it asks for your Facebook password).
- [ ] **Use cases → Authenticate and request data… → Customize → Permissions:**
  - `public_profile` is already there.
  - Next to `email`, press **Add**.
  - Nothing else.
- [ ] **Use cases → … → Customize → Settings** (Facebook Login settings):
  - Client OAuth login: **Yes**
  - Web OAuth login: **Yes**
  - Enforce HTTPS: **Yes**
  - Use Strict Mode for redirect URIs: **Yes**
  - Login from Devices: **No**
  - Valid OAuth Redirect URIs, exactly: `https://api.foldtales.xyz/v1/auth/callback/facebook`
  - Save.

  **No local address.** Facebook only takes https here, and allows `localhost` only while the app is in Development mode. So Facebook is tested on the real link, in stage 2, before the sign-in buttons are shown to anyone. Google and the phone code are tested in this workspace first.
- [ ] **App settings → Basic:**
  - App domains: `foldtales.xyz`
  - Privacy Policy URL: `https://www.foldtales.xyz/privacy/`
  - User data deletion: choose **Data deletion instructions URL**, and enter `https://www.foldtales.xyz/privacy/`. Its "Deleting your book" section says how. In stage 2 it gains a line naming Facebook.
  - Category: **Entertainment**.
  - App icon (1024 × 1024): optional. Skip it unless publishing asks for one. If it does, tell me, and I'll export the book's cover from the existing art.
  - **Save changes.**
- [ ] **Publish** (left menu) → **Publish**, so the top bar says **Live**. In Development mode, only people with a role on the app can sign in. `email` and `public_profile` need no App Review. If Meta asks for a Data Use Checkup or business verification at this step, stop and tell me rather than filling it in.
- [ ] **Into Railway**, the same Variables page as Google. From **App settings → Basic**, copy:
  - `FACEBOOK_CLIENT_ID` = the App ID
  - `FACEBOOK_CLIENT_SECRET` = the App secret (press **Show**)

  Then **Deploy**. Facebook stays hidden on the site until stage 2 wires it in and I turn sign-in on.

### 3. Resend, for the email code on your phone (about 10 minutes, plus DNS)

- [ ] Sign up at [resend.com](https://resend.com) (free: 3,000 emails a month, 100 a day).
- [ ] **Domains → Add domain:** `foldtales.xyz`, region **North Virginia (us-east-1)**, the same region as the Railway backend.
- [ ] Resend lists 3 or 4 records. Leave its page open.
- [ ] At **GoDaddy → My Products → foldtales.xyz → DNS → Add New Record**, add each one. GoDaddy's **Name** field is relative, so type only what comes before `.foldtales.xyz`:

  | Type | Name | Value | Priority |
  |---|---|---|---|
  | TXT | `resend._domainkey` | the long `p=MIG…` value from Resend, pasted whole | |
  | MX | `send` | `feedback-smtp.us-east-1.amazonses.com` (copy Resend's exact value) | `10` |
  | TXT | `send` | `v=spf1 include:amazonses.com ~all` | |
  | TXT | `_dmarc` | `v=DMARC1; p=none;` (only if Resend lists it, or if you have none yet; there isn't one today) | |

  TTL: GoDaddy's default (1 hour). **Don't change** the existing `www` and `api` CNAMEs, the `_railway-verify.api` TXT, or the forwarding of `foldtales.xyz` to `www`. These records sit on `send` and `resend._domainkey`, so they don't touch any of that.
- [ ] Back in Resend, **Verify DNS records.** Usually minutes, sometimes up to an hour. If it's slow, tell me and I'll check what the internet sees with `dig`.
- [ ] **API Keys → Create API key:** name `foldtales-railway`, permission **Sending access**, domain `foldtales.xyz`. It's shown once.
- [ ] **Into Railway**, the same Variables page: `RESEND_API_KEY` = the key. **Deploy.**

### 4. Tell me "done"

Then I, without showing any value:

- set `RESEND_FROM=Foldtales <stories@foldtales.xyz>` on Railway;
- copy `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `RESEND_API_KEY` from Railway into this workspace's `.env.workspace` (not the shared `.env.local`), so you can test sign-in here first (the Facebook pair stays on Railway only, since Facebook can't come back to a local address);
- check that the Facebook app answers as Live for its App ID (no secret needed);
- check that `api.foldtales.xyz/v1/auth/google/start` now goes to Google, and that a code email arrives at an address you give me.

**Not yet:** `TT_ACCOUNTS=on` (Railway) and `TT_PUBLIC_ACCOUNTS=on` (the Pages build). They go on together, in stage 3, once sign-in has passed end to end in the headset: Google and Facebook in Quest Browser, and the phone code.

---

## Stage 1: the product and experience proposal

**Status:** approved with changes by the sprint master (Nov 15), after Codex's review (11 findings, all taken; the log is at the end of this stage). The owner's decisions:
- Talk in the written chapters is cut to v2.
- The limits as proposed.
- About 10 minutes a story, ending by turn 40.
- Finished stories saved to the account.
- Sign-in by phone code, Google or Facebook, and sign-in only, with no guest fallback.

*Read with `docs/plans/2026-11-14-ai-storyteller.md` (the concept), `docs/plans/2026-11-14-storyteller-satchel.md`, `docs/plans/2026-11-14-ai-mode-research.md`, `docs/room-effects.md` and the M3 session in `docs/playtest-notes.md`. File references are to `e5baeed`.*

### The one-paragraph version

Today the Storyteller is a good conversation with no shape. You talk, they act, a teapot appears and goes into your satchel, and the talk goes on until you take the headset off. The story's history and pages aren't saved, and nothing tells you it ended. The owner felt immersion at M3. What's missing is everything that makes it a product:
- **A story with a beginning, a middle and an end, about ten minutes long.** You can start it with your voice or your hands.
- **The app owns the ending,** so it always comes, even with the network gone.
- **It goes on your shelf as a page,** and the cast remembers it next time.

Around that sit caps enforced on the server, moderation of what the AI says and paints, honest failure, and sign-in switched on. Talk in the written chapters is cut to v2.

### Positioning

**What it is.** *Tonight's story, made up with you.* Pip, Wick and Moth perform a new short story on your table from whatever you say or hand them. It's voiced live, it uses your real room, and it ends on a page you keep.

**How it sits beside the chapters.** Two ways in, at equal weight once chapter 1 is finished (`docs/prd.md` §0):

| | Chapters | The AI Storyteller |
|---|---|---|
| Who decides what happens | We wrote it | You and the cast, as you go |
| How you take part | Your hands, at the moments they ask | Your voice or your hands, any time |
| Length | About 6 minutes | About 10 minutes, then it ends |
| What you keep | Keepsakes, and your place | The story's page on your shelf, everything painted for you, and a cast that remembers |
| Needs | Nothing | Sign-in and the internet. The microphone is optional |

**The name stays "AI Storyteller".** It says what it is to a judge in two words, and the owner chose it. The word "AI" appears only on the page outside the book. Inside the book nobody mentions AI (`backend/src/storyteller/turn.ts:98-131`).

**Copy** (inside lane A's door, whose layout is theirs). Every promise here is a must below:

- Door title: **"Or make up a new story, out loud."** (today's, kept)
- Door line: **"Tell Pip, Wick and Moth what tonight's story is about, or hand them something lost. They make it up with you in their own voices, on your table and around your room, and it ends on a page you keep."**
- Under the button: **"About 10 minutes · your voice or your hands · needs sign-in and the internet"**.
- About page (`about.storyteller`): **"Tell Pip, Wick and Moth what tonight's story is about, or hand them something lost, and they make it up with you, out loud. They answer in their own voices, paint the things you ask for, and bring the weather, the stars or the sea into your room. Each story ends on a page in your book, and they remember it next time. It needs an account and the internet."**
- PRD: a rewritten §0 bullet for the Storyteller, and §5's core loop gains the Storyteller's own loop. §6 "Tonight's lost thing" becomes this mode's hands-only way in. Lane D edits only those lines.
- Rename the leftovers to Foldtales: the sign-in email (`backend/src/auth/email.ts:25-26`), Better Auth's `appName` and the default `RESEND_FROM` (`backend/src/auth/index.ts:39, 48`).

### The journey in and out

**On the page (the headset), the door's states.** Lane A draws them. Lane D supplies the state, the words and the actions, through the Storyteller's provider module (see "Seams"):

| You are | The door says | Its actions |
|---|---|---|
| Checking sign-in | (the door's quiet loading look) | none |
| Signed out | Sign in to start | The bookplate: Continue with Google, Continue with Facebook, or the code on your phone |
| Sign-in failed or cancelled | "Couldn't sign you in." | Try again · Use your phone instead · Read the chapters |
| Session expired | "Sign in again to talk with them." | The bookplate |
| Signed in, mic not yet asked | Let them hear you | Allow the microphone · **or start with just your hands** |
| Mic refused | "The microphone is off, so tonight you'll play with your hands." | Start a story. A small line says how to allow it in Quest Browser's site settings |
| Ready | Start a story | Your stories (n), when there are any |
| Tonight's three stories told | Back tomorrow evening | Your stories |
| Storyteller resting | "The Storyteller is resting tonight. The chapters are open." | Read the chapters. Shown when: the backend can't be reached, the day's 150 stories or a spend ceiling is reached, or a build has it off |

**Sign-in brings you back to the door.** All three ways (Google, Facebook and the phone code) carry the destination through the trip. You land on the door with **Start a story** ready. Entering XR needs your tap, so it never jumps in on its own.

**Off the headset** (desktop or phone), the door explains the Storyteller and sends you to your Quest, as lane A's front page does. Reading your stories there is cut.

**Into the book.**
- One tap enters XR straight into the Storyteller (`client/src/index.ts:1096`).
- The book searches, lands and opens. The lamp lights and the cast is waiting (`client/src/storyteller/live.ts:89-105`).
- Today the microphone is asked for twice: at the door, and again on entering (`index.ts:1150-1162`). That becomes one ask.

**Inside the book.** Lane A's one set of controls carries the Storyteller's entries:
- pause: closing the book, as now;
- **End the story here:** the ending comes at once;
- **Start a new story**, when stories are left today;
- **Your stories**, in the book's contents;
- the satchel;
- leave.

**Out of the book.** The end page (below), then close the book. Back on the page, the new story is on your shelf. Leaving mid-story ends it. Its title stays on your shelf if it had one by then. Continuing an unfinished story is cut.

### What a finished Storyteller session feels like

*About ten active minutes: time with the book open. Closing it pauses the clock.*

1. **The welcome (0:00 to about 0:40).** The book opens and the lamp comes up. Pip looks up at you: "Oh! It's you."
   - If you've been before, the cast remembers your last stories, by their titles and endings only. Wick, squinting at his logbook: "Did that teapot ever find its whistle?"
   - Then the ask, with both ways in at once. The drawer slides open with three lost things: the odd sock, the brass key and the paper boat. Pip: "Tell us what tonight's story is about, or hand us something from the drawer, and we'll find out whose it is."
   - The paper tab glows: *Hold to talk*.
2. **Your idea becomes the story.** You say "a cat who's afraid of water", or hand Pip the odd sock. The narrator names the story: *"The Sock That Lost Its Other Half."* The page turns to where it starts.
   - Say or give nothing for 30 s, and Moth pulls a lost thing out of the drawer herself ("This one's been rattling all night!"), and the story begins.
   - From here the story has a plan, kept on the server: a problem, two turns that belong to you, and an ending.
3. **The middle (to about 8:00).** The cast plays it out in their own voices.
   - Two or three times the story turns to you: "Should we try the shore, or up to the lamp?" Your answer is the next scene. You can say it, or hand them something.
   - **Every question has a timed default.** After about 20 s of quiet, someone decides ("Wick says the shore, and Wick is never wrong"), and the story goes on.
   - You can interrupt any time ("Wait, what if the sea came in here?"), and the sea rises round your feet (ROOM `sea`).
   - Ask for something and it's painted, then lands by whoever you asked. Moth flying off to fetch it is the last thing built, and the first cut.
4. **Winding down (from about 8:00 active, or turn 32).** The cast heads for the ending they planned, shaped by what you did. "End the story here" brings the ending at once.
5. **The end (by 10:00 active, or turn 40; the app's hard stop is 11:00).** Two parts:
   - **When the AI answers,** the narrator gathers it up: "And so the odd sock found its other half, under the Giant's couch all along."
   - **Always, with or without the network:** the lamp's beam sweeps your real room, and the end page lies open. On it:
     - the title;
     - two or three lines of what happened;
     - the things painted tonight, in a row, going into your satchel;
     - *"The end of tonight's story"*, then **Tell another** (or "Back tomorrow evening") and **Read the chapters**.

   Close the book to stop.
6. **Next evening.** "You're back! Did the sock and its other half stay together?" Your satchel holds what was painted, and the cast can bring a thing out by name, for free.

**Silence is a complete way to play.** You can play the whole story without saying a word. You start it by handing over a lost thing, or waiting. Timed defaults answer every question, and the clock brings the ending. **A whole zero-speech playthrough is an acceptance test,** including one with speech recognition down.

**Latency targets** (to measure in stage 3; today's measurement is M3's, about 7 s from letting go to the first voice):

| | Target | Today |
|---|---|---|
| First voice after letting go of the tab | ≤ 4 s median, ≤ 7 s at the 90th percentile | about 7 s at M3 |
| Over 3 s with nothing said | The cast acts out thinking | |
| At 20 s | The recorded "where were we?" line, and the tab glows again | |
| A painting arrives | Within 75 s, or it fails. 25 s is what M3 saw on success, not a promise | about 25 s on success |

**The rules that make it feel finished:**
- **Every line is spoken.** If voices fail, captions carry it and the cast still acts.
- **Nothing promised that doesn't show.** This already holds for objects and room effects. It's widened to the two prompt lines that over-promise today: the thunder flash and the rain darkening the room (`turn.ts:42, 45`). The renderer no longer shows either (`index.ts:838-840`).
- **Never silent, never a dead end.** Every failure has an in-story outcome (below).
- **Room effects are moments, not wallpaper.** At most one new room effect every couple of minutes, when the story calls for it. The beam is saved for the end.

### The gaps today (from the code)

| Gap | Today | Finished |
|---|---|---|
| **No shape** | No premise ask, no plan, no ending. The scheduler never ends (`live.ts:134-137`). Quiet nudges stop after two (`session.ts:15-17`), then the cast waits for ever | Welcome, premise by voice or by hand, plan, timed defaults, wind-down, an ending the app guarantees |
| **No ending or page** | Nothing gathers the story | A closing line, the beam and the end page, built on the headset when the network is gone |
| **Story history not saved** | History is in memory only (`session.ts:53`); `sessions: []` (`show/progress.ts:83`). Paintings are kept, in the satchel (`storyteller/keepsakes.ts`) | Finished stories on your account, on the door and in the book's contents |
| **No memory between evenings** | `canon: []` every turn | The welcome gets your last three stories' titles and endings |
| **Caps the client could dodge** | The client makes up the `sessionId`. The caps are daily counts per route. `paintResult` polls count as AI calls, about 30 per painting (`guard.ts:41`). The paint credit count lives in memory | Stories reserved on the server per reader. Turns and paintings counted per story there. Retries counted once. Polling is free, and credits are counted in the database |
| **Output not moderated** | Only what the reader says is checked, and that check passes on any error (`moderate.ts`). The naming step's `fit` looks at the description before painting; the cut-out checks only the image's shape (`paint.ts:74`, `cutout.ts`). Nothing checks the painted picture | Every generated line is checked before it's heard. Every picture is checked before it's shown. Both fail closed |
| **Silent failures** | Caps, refusals, Runway failures and broken streams all go quiet. `onError` ignores everything but sign-in and offline (`index.ts:512-517`) | An in-story outcome for each, voiced from recorded lines |
| **Painting** | Nothing shown while pending, nothing on failure (`index.ts:530`). Always lands at one fixed spot (`index.ts:540`) | Lands by whoever asked. Moth comes back empty-handed on failure. The look check is mandatory |
| **The moderation redirect** | "The page turned all by itself…", but it doesn't turn (`turn.ts:417`, `session.ts:134-141`). The blocked words stay in the history (`session.ts:83`) | The page really turns. The blocked words leave the history |
| **Speech** | "Wait for the glow" can stick (`index.ts:594-601`). A token fetched ahead can go stale | The tab resets. The token is refetched when it's over 10 minutes old |
| **Sign-in** | Built, off on both sides. Google only. The destination is lost on the way back | On end to end with Google, Facebook and the phone code. You come back to the door |
| **Copy and leftovers** | "On its way to this book", unused door labels (`index.ts:1142-1149`), "Tabletop Theater" in the email, `console.info` on every press | Final copy. Logs only behind the dev flag |
| **Voices** | `art/voice/live.json` says "to be judged by ear in the headset", and nobody has yet | The owner approves the four voices in the headset session |

### Cost and caps

**What a story costs** (estimates from the concept and M3; measured in stage 3, and this line updated then):
- voices: about $0.30;
- speech to text: about $0.03;
- Claude: about 25 turns at a few cents each, plus the moderation checks;
- each painting: 2 Runway credits.

**The limits (owner-approved), all enforced on the backend in durable storage:**

| Limit | Value | Enforced by | When it's reached |
|---|---|---|---|
| Stories per reader per day | 3 | Reserving a story is one atomic write per signed-in reader | The door: "Back tomorrow evening". Your stories stay readable |
| Stories per day, everyone | 150 | The same write | The door: "The Storyteller is resting tonight." Chapters are untouched |
| Turns per story | 40 | Each turn counted once by its id, on the story's record | Winding down from 32; the close at 40. Past 40, a turn is refused and the app's ending plays |
| Paintings per story / per reader per day | 6 / 12 | Counted when a painting starts. A retried turn never paints the same thing twice | Moth: "My wings are tired, but your satchel's full of treasures." The story goes on |
| Live painting credits, in all | 100 | A credit ledger in the database, reserved before Runway is called and refunded if Runway never took the job | Nothing more is painted. The story goes on |
| Speech tokens | Only with a story in progress; 150 per reader per day | The guard | The tab: "I couldn't hear you just then." Hands still work |
| Daily spend ceilings | Claude tokens and voice characters per day, sized from the measured cost of 150 stories | A spend table filled from each call's real usage | New stories: "resting". A story in progress gets its ending |

`soundEffect` has no caller and is budgeted at zero until something uses it. `paintResult` stops counting as an AI call; painting is capped where it starts, and a job can only be collected by the reader whose story asked for it. The dollar figure for a worst-case day is left out until stage 3 has measured a story and sized the ceilings from it.

### Slow or failed AI: what you see and hear

The PRD's rule: never wait, never pretend, and never hide a failure behind repeated filler. The lines below are **recorded once, ahead of time**, in the live voices, so they play when the AI or the voices are down. That's art run **023** (plan in stage 2).

| What | You see and hear |
|---|---|
| Thinking (over 3 s) | Whoever was spoken to acts it out: Wick turns his logbook, Pip looks up at you, Moth circles the lamp. Nothing is said |
| Claude slow (20 s) or failed | The narrator, recorded: "The lamp flickers… now, where were we?" The tab glows again. Your last words count for the next try, which is one retry with the same turn id |
| The stream breaks partway | The lines already heard stand, nothing is repeated, and the same recorded line plays |
| Voices down | Captions on the page, and the cast still acts. One printed line: "Their voices are quiet tonight, so the words are on the page." |
| Speech to text down | The tab: "I couldn't hear you just then", and it resets. The story carries on by its timed defaults and your hands |
| Painting fails, or fails the look check | Moth, recorded: "Couldn't find it anywhere! Maybe it's still lost." The story goes on |
| Offline | Recorded: "The lamp has gone quiet. The story will wait right here." The page says "No internet connection." Back online: "Ah, there's the light again." If the clock runs out first, the app's ending plays |
| A cap is reached mid-story | Recorded: "That's all the story the lamp has oil for tonight." Then the app's ending, never a cut |
| The ending's own turn fails | Recorded: "And so the story was gathered up, and tucked into the book for another night." Then the beam and the end page, from what the headset already knows |

**The chapters never need the backend.** A check in stage 3 plays chapter 1 with the backend stopped.

### Moderation

- **What you say:** checked before anything is spoken or painted, as today. On a moderation timeout (4 s) it still lets the words through. Claude's PG prompt is the second line, and the output check below is the third.
- **What the AI says: fail-closed.** Each generated line is checked, with a time bound, before it's heard. The check runs alongside the line's voicing, so it adds little. A line that fails, or whose check times out, stops the turn there. The recorded redirect plays, and the page really turns to a cozier set.
- **Claude's own refusal:** plays the same redirect.
- **Blocked words:** removed from the history sent with later turns.
- **What's painted: fail-closed.**
  - The description is checked before any credit is spent (the naming step's `fit`, `paint.ts:74`).
  - **The finished picture is checked before it's shown.** A vision check, with a time bound, asks: one painted object, the book's style, PG, no text, and the thing that was asked for. A fail or a timeout means Moth comes back empty-handed.
  - Correcting stage 1's first draft: today's other check, the cut-out (`cutout.ts`), only checks the image's structure. It isn't moderation.
  - The look check is mandatory whenever live painting ships.
- **Saved titles and summaries:** checked the same way before they're written to your account. A failure saves "Tonight's story" and no summary.
- **Names:** the cast takes a name you give a thing, as the teapot showed. It never guesses yours.

### Privacy and changing reader

- **Shared per headset:** keepsakes and paintings, the satchel (IndexedDB on the headset). The owner's decision. The pictures never leave the headset.
- **Per reader, on the account:**
  - story records (title, summary, the names of the things, dates);
  - the welcome's memory, which is read from those records.

  Nothing of a story is kept on the headset beyond tonight's story in memory. A cached copy of your shelf is removed at sign-out.
- **Sign-out and "Delete my book":** sign-out clears the cached shelf with the rest of the reader's local keys. Deletion removes the story records and their usage rows on the server, as well as the account, book and device links.
- **For lane E's privacy page,** through the sprint master:
  - "Your stories' titles and short summaries, and the names of things painted for you, are kept with your account, and deleted with Delete my book."
  - "The pictures painted for you stay on this headset."
  - "Your voice goes to a speech service (ElevenLabs) to be understood, and isn't kept."
  - "What you say and give goes to an AI model (Anthropic's Claude) to write the story."
  - "The shapes of your room are described to the AI."
  - "Signing in with Facebook or Google shares your name and email with us, and nothing else."

### Talk in the written chapters: cut to v2

Decided by the owner and recorded in `docs/v2-ideas.md`. The reasons:
- the AI inside a written chapter didn't land (session 1, Nov 14);
- the chapters are hands-only by design;
- lanes B and C are building chapters 2 and 3 now.

### Seams with other lanes

- **Lane B (the library):** lane D owns a Storyteller provider in `client/src/storyteller/shelf.ts`. It returns the Storyteller part of the library: whether it's available, the door's state, and your stories. Lane B's `libraryState()` in `client/src/show/progress.ts` calls it, and lane B owns that file. The sprint master has told lane B.
- **Lane A (the page and the book):** lane A owns the door's presentation, the controls and the end page's layout. Lane D supplies the behaviour and data:
  - the door's state and actions;
  - the Storyteller's control entries as callbacks: end here, start a new story;
  - the end page's data: title, lines, things, which actions apply;
  - the shelf for the contents.

  Agreed through the sprint master before the build touches them.
- **Lane E:** the privacy lines above. The submission line: "Sign in with Google or Facebook in the headset to try the AI Storyteller". Fps for a ten-minute story with two room effects. Flipping the live flags together at the end.

### What ships, in dated slices

**By the end of Nov 16 (the minimum product):**
1. Sign-in on end to end: the phone code, Google and Facebook, coming back to the door, and the door's sign-in states.
2. The bounded story: the welcome, both ways in, the plan, timed defaults, the wind-down, and the app's ending (the terminal state, the local closing sequence and the end page).
3. Persistence: stories saved to the account, Your stories on the door and in the contents, and the welcome remembering your last stories.
4. Server-side caps: story reservation, turns and paintings per story, idempotent retries, the credit ledger, speech tokens, the spend ceilings.
5. Output moderation: lines, pictures, titles and summaries, all fail-closed.

**Nov 17 (before the freeze):**

6. The failure performances, with run 023's recorded lines.
7. The painting look check wired to Moth's empty-handed line, and paintings landing by whoever asked.
8. Hands-only polish: the drawer's timing, Moth picking for you.
9. Copy: the door, About and the PRD lines. Privacy copy to lane E.
10. The owner's headset sign-off, including the four voices.
11. **Last, and first to cut:** Moth's fetch choreography (she flies off and comes back carrying the thing).

**Cut, to `docs/v2-ideas.md`:**
- Talk in the written chapters;
- continuing an unfinished story;
- reading your stories on the phone or desktop;
- a SOUND step for live sound effects;
- the camera;
- your voice in the cast;
- the satchel following your account.

### Codex's review of stage 1, and what was done

1. **P0: the ending depended on the AI.** *Taken.* The app owns the end, with ten active minutes, a terminal state, and a local closing sequence and page. Chapters checked with the backend off.
2. **P0: caps lacked enforcement.** *Taken.* Stories are reserved atomically on the server. Turns and paintings are counted per story, retries idempotently. Every paid route is budgeted. The "$150 at worst" is gone until measured.
3. **P0: the promises were optional.** *Taken.* Persistence and memory are musts. Continuing an unfinished story, and reading stories on the phone, are cut, with their copy.
4. **P0: silence had no path.** *Taken.* Hands-only premise from the drawer, timed defaults, the clock's ending, and a zero-speech acceptance test.
5. **P0: moderation overstated.** *Taken.* Output is fail-closed for lines, pictures, titles and summaries. The "checked twice" claim is corrected.
6. **P1: no cut line.** *Taken.* Dated slices, with the fetch choreography cut first.
7. **P1: lane B's seam.** *Taken.* `client/src/storyteller/shelf.ts`, called by lane B's `libraryState()`.
8. **P1: sign-in recovery.** *Taken.* The destination survives all three ways in. Loading, failed, expired, resting and mic-refused states added. No guest fallback.
9. **P1: continuation.** *Cut.*
10. **P1: privacy.** *Taken.* Shared keepsakes, per-reader stories, sign-out and deletion covered, copy for lane E.
11. **P2: present versus target.** *Taken.* Latency is given as targets beside today's measurements, and the painting time as an observation.

---

## Stage 2: the build plan

*For Codex review and the sprint master's approval. Every task lists its files and its check. `pnpm check` (typecheck, tests, bundle check) stays green after each commit.*

### How it's built

**The story's record lives on the server.** The backend stays stateless about the conversation, because the client still sends the history. It owns:
- the story's identity, status and counts;
- its plan and title;
- its ending.

So the caps can't be dodged, and the shelf needs no upload from the headset.

```
door: Start a story ──► POST /v1/storyteller/start {requestId}
                         └─ one transaction: reader's stories today < 3, everyone's < 150,
                            spend under the ceilings → stories row (active)
                         ◄─ {storyId, allowance}
book opens ──► storyTurn {storyId, turnId, phase, activeSeconds, input:'open', history…}
                         └─ story is the reader's, active, turns < 40; turnId counted once
                         └─ welcome: last 3 stories' titles and endings in the prompt
                         ◄─ beats (each line checked, then heard), listen
premise (heard, or a drawer gift, or 30 s quiet) ──► storyTurn
                         ◄─ titled {title}    (checked, saved on the row with the plan)
                         ◄─ beats…, listen
middle: heard / gift / quiet (≈20 s: someone decides) / arrived
closing (≥ 8:00 active or turn ≥ 32): phase 'closing' in each request
close (10:00 active, turn 40, or "End the story here") ──► storyTurn {input:'close'}, 12 s bound
                         ◄─ closing beats, ending {title, summary}  (checked, saved, status ended)
then, always: the beam and the end page, from what the headset has
fallback: POST /v1/storyteller/end {storyId, reason} (idempotent); the server also ends
          any story left active for 60 minutes
```

**The client's clock.**
- Active time is the show clock, which closing the book pauses.
- The session has a terminal state, `ended`: ears off, the tab hidden, no turns, a late event dropped.
- At 11:00 active, whatever is still playing fades, and the local ending runs.

**The plan** is written in the premise turn's reply, after the `titled` step. It's stored on the row, and the backend adds it to every later turn's prompt. The client never sees it.

### The contracts PR (first, its own branch, to the sprint master before anything else)

Branch `contracts-storyteller-v5` from `main`. `CONTRACT_VERSION` goes 4 → 5. `contracts/src/storyteller.ts`, `contracts/src/api.ts`, `contracts/src/account.ts`, the mocks, and `contracts/test/`:

- **`startStory`**, `POST /v1/storyteller/start`.
  - Request: `{ requestId: Id }`.
  - Response: `{ storyId: Id, allowance: { turns: number, paintings: number, storiesLeftToday: number } }`.
  - The same `requestId` returns the same story.
- **`endStory`**, `POST /v1/storyteller/end`.
  - Request: `{ storyId, reason: 'time' | 'turns' | 'reader' | 'cap' | 'failed' | 'left' }`.
  - Response: `{ ended: true }`.
  - Idempotent.
- **`StoryTurnRequest`:**
  - `sessionId` becomes `storyId` (from `startStory`);
  - adds `turnId: Id`, `phase: 'welcome' | 'middle' | 'closing'` and `activeSeconds`;
  - drops `canon`, which was always empty.
- **`TurnInput`** adds `{ kind: 'close', reason }`. A drawer premise is the existing `gift`.
- **`TurnEvent`** adds `{ kind: 'titled', title }` and `{ kind: 'ending', title, summary }`.
- **Refusal messages,** as constants beside `SIGN_IN_REQUIRED`, so the client tells them apart without parsing text:
  - `STORIES_TODAY_USED`
  - `STORYTELLER_RESTING`
  - `STORY_OVER`
  - `PAINTINGS_USED`
  - `NO_STORY` (a speech token with no story in progress)
- **`listStories`**, `GET /v1/me/stories`, an account route.
  - Response: `{ stories: StoryRecord[] }`, newest first, at most 30.
  - `StoryRecord = { id, title, summary: string | null, things: string[], startedAt, endedAt: string | null }`.
- The mock backend learns all of the above, so client tests and `MOCK_PROFILE` dev runs work without keys.

Check: `pnpm check`. Then a note to the sprint master with the diff. This lane rebases on it once merged.

### Tasks, in order

**Nov 16, slice 1**

1. **Contracts PR** (above). *Check:* `pnpm check`; contract tests for each new shape; mock backend tests for start, end, list and the new events.

2. **Sign-in: providers, Facebook and the way back.** Backend:
   - `/v1/auth/google/start|done` becomes `/v1/auth/:provider/start|done`, for `google` and `facebook`.
   - Better Auth's `facebook` provider (scopes `email`, `public_profile`) when `FACEBOOK_CLIENT_ID` and `FACEBOOK_CLIENT_SECRET` are set.
   - A Facebook account without an email returns `error=no-email`, which the return page explains: "Facebook didn't share an email. Try Google, or the code on your phone."
   - `appName`, the email's subject and text, and the default `RESEND_FROM` become Foldtales.

   Client:
   - `googleStartUrl` becomes `providerStartUrl(provider, returnTo)`.
   - The return URL carries `go=storyteller`, and the phone-code wait keeps it in `sessionStorage`, so after the reload the landing opens on the door.
   - `auth/return/` names the provider in its messages.
   - The bookplate and `link/` gain "Continue with Facebook" beside Google, in lane A's layout, as a request through the sprint master. Lane D adds the behaviour.

   *Files:*
   - `backend/src/auth/index.ts`, `backend/src/auth/email.ts`
   - `client/src/account/index.ts`
   - `client/src/pages/auth-return.tsx`, `client/src/pages/link.tsx`
   - `client/src/landing/account-ui.ts`

   *Checks:*
   - `backend/test/app.test.ts` gains: provider start for both; an unknown provider is a 404; `return` off the client's origin is refused; a done with no session returns `error`.
   - Local, Mac: Google, the email code and the phone code against this workspace's backend, with screenshots of each page state.
   - Headset over USB: Google, Facebook and the phone code (needs the two owner asks below).

3. **Stories on the server.** Backend:
   - A new `backend/src/storyteller/stories.ts` with these tables in the store's SQLite file:
     - `stories (id, user_id, request_id UNIQUE, day, status, started_at, ended_at, turns, paints, title, summary, plan, things)`;
     - `story_turns (story_id, turn_id, PRIMARY KEY)`;
     - `credit_ledger (id, story_id, object_id, credits, status)`, with `UNIQUE (story_id, object_id)`, so a retried turn can't paint twice;
     - `spend (day, provider, units)`.
   - `startStory` runs in one transaction: the reader's count and everyone's count for the day, the spend ceilings, then insert.
   - `endStory`, `listStories`, and closing any story left active for 60 minutes.
   - The painter's in-memory credit count moves to the ledger.
   - Better Auth's `afterDelete` removes the reader's stories and their `user:` usage rows.

   Guard:
   - `storyTurn` and `paintProp` need a story that is the caller's and active.
   - `speechToken` needs a story in progress.
   - `paintResult` isn't counted, and checks that the job's story is the caller's.
   - `soundEffect` is capped at 0.
   - The per-route daily caps stay, as a backstop.

   New variables, with defaults:

   | Variable | Default |
   |---|---|
   | `STORIES_PER_READER_DAY` | 3 |
   | `STORIES_PER_DAY` | 150 |
   | `TURNS_PER_STORY` | 40 |
   | `PAINTS_PER_STORY` | 6 |
   | `PAINTS_PER_READER_DAY` | 12 |
   | `PAINT_CREDIT_CAP` | 100, now lifetime, in the ledger |
   | `SPEECH_TOKENS_PER_READER_DAY` | 150 |
   | `SPEND_CLAUDE_TOKENS_DAY` | sized from 150 stories once measured |
   | `SPEND_TTS_CHARS_DAY` | the same |

   *Files:*
   - `backend/src/storyteller/stories.ts` (new)
   - `backend/src/guard.ts`, `backend/src/server.ts`, `backend/src/store.ts`
   - `backend/src/storyteller/paint.ts`, `backend/src/auth/index.ts`

   *Checks:* `backend/test/stories.test.ts`:
   - three stories then a refusal;
   - two concurrent starts with one slot left give exactly one story;
   - the same `requestId` twice gives one story;
   - turn 41 is refused with `STORY_OVER`;
   - the same `turnId` twice counts once;
   - a retried turn's PAINT of the same object reserves once;
   - the ledger stops at 100 and refunds an unaccepted job;
   - another reader's story or job is refused;
   - a speech token without a story is refused;
   - deletion removes the stories;
   - the counts survive a store reopen.

4. **The turn, shaped.**
   - `backend/src/storyteller/turn.ts` reads the story's row. It writes the phase into the prompt:
     - welcome: greet, offer both ways in, the last three stories by title and ending;
     - middle: the plan, with the reader's turns;
     - closing: head for the ending;
     - close: the ending lines.
   - A premise turn emits `titled` and stores the plan (a `PLAN |` step, never shown).
   - `quiet` in the middle tells the cast to decide the open question and go on. In the welcome it tells Moth to pick a lost thing from the drawer.
   - The close turn emits `ending` after its lines.
   - The rules drop the thunder flash and the rain's darkening.
   - Usage (tokens, voice characters) goes to `spend`.

   Output moderation in `backend/src/storyteller/moderate.ts`:
   - `checkLine(text)`, Haiku, a 2.5 s bound, **fail-closed**. It runs alongside each line's voicing, and a beat is yielded only when both are done.
   - A fail stops the turn and emits `redirect`, which the client plays from the recording, with a real page turn.
   - The same check runs on the title and the summary before they're saved. A fail saves "Tonight's story" and no summary.
   - A Claude `refusal` becomes the redirect.

   *Files:*
   - `backend/src/storyteller/turn.ts`, `backend/src/storyteller/moderate.ts`
   - `backend/src/storyteller/stories.ts`

   *Checks:* `backend/test/turn.test.ts`, with a fake Anthropic stream and fake voices:
   - phases reach the prompt;
   - the welcome carries recent titles;
   - `titled` and `ending` are emitted and saved;
   - a failing line check stops the turn with `redirect`;
   - a check that times out redirects;
   - a title that fails saves "Tonight's story";
   - a refusal redirects;
   - spend rows are written.

   Plus a red-team list of 20 lines in `backend/test/fixtures/` that must all be stopped, run against the real check only when `ANTHROPIC_API_KEY` is set (skipped in CI).

5. **The session, shaped, on the client.**
   - `client/src/storyteller/session.ts` gains:
     - `startStory` before the first turn;
     - `turnId` per turn, reused for its one retry;
     - the phase and active seconds;
     - the terminal state `ended`, with no turns, no ears and a late event dropped;
     - quiet turns without the two-in-a-row limit (about 20 s in the middle, 30 s in the welcome);
     - `close` at 10:00 active, at turn 40 or from the control;
     - the 12 s bound on the close;
     - the 11:00 hard stop;
     - blocked words removed from the history.
   - A new `client/src/storyteller/ending.ts` builds the end page's data from what the headset has. It plays the closing sequence (the light to gold, the lamp lit, the beam sweep) with no network, then calls `endStory` without waiting.
   - In `client/src/index.ts`, the Storyteller's welcome opens the drawer with three lost things, from `client/public/show/storyteller.json`'s new `welcomeDrawer: ["odd-sock", "brass-key", "paper-boat"]`.
   - Every `onError` code gets its outcome (the table above). Debug `console.info` calls go behind the dev flag.

   *Files:*
   - `client/src/storyteller/session.ts`
   - `client/src/storyteller/ending.ts` (new)
   - `client/src/storyteller/live.ts`, which gets `ended` from the session
   - `client/src/index.ts` (the Storyteller's parts only)
   - `client/public/show/storyteller.json`

   *Checks:* `tests/storyteller-session.test.ts`, on the mock backend with a fake clock:
   - **zero-speech playthrough:** open, a 30 s quiet in the welcome, quiets through the middle, closing at 8:00, close at 10:00, the end page with a title;
   - the same with the stream failing every turn, reaching the local ending;
   - turn 40 closes;
   - a paused book stops the clock;
   - 11:00 is a hard stop;
   - after `ended` no event plays;
   - a broken stream retries once with the same `turnId`;
   - speech down still ends.

   `tests/storyteller-chapters-offline.test.ts`: chapter 1 simulated end to end with the backend unreachable.

6. **The shelf and the door's state.** A new `client/src/storyteller/shelf.ts`:
   - `storytellerShelf(store)` is synchronous for lane B's `libraryState()`. It returns `{ available, door, sessions }` from a cached copy kept per reader (key `tt.storyteller.shelf.<userId>`).
   - `refreshShelf()` fetches `listStories`.
   - `doorState()` returns one of the nine states above, from sign-in, the microphone, the allowance and reachability.
   - Actions: `start`, `signIn(provider)`, `allowMic`, `startWithHands`.
   - `clearReader()` in `client/src/account/index.ts` removes the cached shelf.
   - Lane A's door and contents read only this. Lane B swaps `sessions: []` for `storytellerShelf(store)`, through the sprint master.

   *Files:*
   - `client/src/storyteller/shelf.ts` (new)
   - `client/src/account/index.ts` (one line in `clearReader`)

   *Checks:* `tests/storyteller-shelf.test.ts`:
   - every door state from its inputs;
   - the cache is per reader;
   - sign-out clears it;
   - an offline refresh keeps the last copy.

7. **Headset session A** (evening of Nov 16, over USB). In order:
   1. Google, Facebook and the phone code in Quest Browser, each ending on the door.
   2. One story by voice, start to end page.
   3. One story without a word.
   4. One with Wi-Fi off in the middle.
   5. Chapter 1 with the backend stopped.

   Telemetry for fps over the whole story. Notes go in `docs/playtest-notes.md` under this lane's dated section.

**Nov 17, slice 2**

8. **Run 023, recorded lines** (after the sprint master approves its plan, below).
   - A script, `art/runs/023-storyteller-lines/build.mjs`, voices the lines with the live voices in `art/voice/live.json`.
   - It's a dry run unless asked to spend.
   - Its output, levelled like run 010, goes to `art/sound/storyteller/`.
   - The client plays them by id for each failure outcome and the redirect.

   *Check:* each clip decodes and is levelled; the session tests' failure paths name a clip that exists.

9. **Paintings, finished.**
   - `checkPicture(png, description)` in `moderate.ts`: Haiku vision, 6 s, fail-closed, run before `paintResult` says `done`.
   - A failure is `failed`, and Moth's recorded empty-handed line plays.
   - The thing lands by whoever asked, from the turn's PAINT step and the asker's mark, not at the fixed spot.
   - The per-story painting limit plays Moth's "tired" line.

   *Files:* `backend/src/storyteller/paint.ts`, `backend/src/storyteller/moderate.ts`, `client/src/index.ts` (`collectPainting`).

   *Check:* a test where the check fails gives `failed` and no keepsake; a placement test puts it within reach of the asker's mark.

10. **Hands-only polish.** Tune the welcome's drawer timing and Moth's pick in the headset.

11. **Copy and docs:**
    - the door's words and states, handed to lane A;
    - About (`client/src/landing/page-content.json`, `about.storyteller`);
    - the PRD lines;
    - the privacy lines to lane E;
    - `docs/v2-ideas.md` for the cut items;
    - `docs/playtest-notes.md`.

12. **Headset session B, the owner's sign-off,** including the four voices. If a voice is rejected, pick a replacement from ElevenLabs' library in the session, and change only `live.json`.

13. **Moth's fetch** (last, first to cut): on a PAINT step, Moth exits toward the page's edge (ENTER and MOVE exist) and comes back carrying the thing, with GIVE to the asker.

14. **The PR.**
    - `pnpm check` green.
    - Codex reviews once.
    - The owner tests in this workspace.
    - After the sprint master merges, with lane E's OK, set these together: `TT_ACCOUNTS=on` on Railway; `TT_PUBLIC_ACCOUNTS=on` and `TT_PUBLIC_STORYTELLER` removed on Pages.
    - Then a live check on `www.foldtales.xyz` in the headset: Google, Facebook, the phone code and one story.
    - If sign-in fails live, both flags go back off at once, and the sprint master gets a card: fix, or escalate to the owner.

### Owner asks for the headset tests (after the checklist)

Sign-in in the headset over USB comes back through `localhost`, so the cookie stays on one host. The Quest reaches the Mac's two ports through `adb reverse`. Two small additions:
- **Google:** add the redirect URI `http://localhost:5121/v1/auth/callback/google` to the `Foldtales web` client. The `127.0.0.1` one stays, for the Mac.
- **Facebook:** in the Facebook app, **App menu → Create test app**, named `Foldtales test`. A test app stays in Development mode, where `localhost` redirects are allowed and you, with a role on it, can sign in. Put its App ID and secret into Railway's variables as `FACEBOOK_TEST_CLIENT_ID` and `FACEBOOK_TEST_CLIENT_SECRET`. Railway doesn't use them; I copy them into `.env.workspace` as this workspace's Facebook pair, without showing them. The live app stays for `api.foldtales.xyz`.

This workspace's `.env.workspace` then gets `BETTER_AUTH_URL=http://localhost:5121`.

**The cutoff:** if sign-in isn't working on this workspace's build by **Nov 16 at noon**, the sprint master gets one card: fix it, or escalate to the owner. There's no guest fallback.

### Art run 023: the recorded lines (plan; needs the sprint master's approval before any spend)

`art/runs/023-storyteller-lines/plan.json` has the full plan.
- **What it answers:** can the failure and redirect moments play in the cast's live voices with no network?
- **Provider:** ElevenLabs directly, with the live model and voices (`art/voice/live.json`), so they match the live lines. That's not Runway, because Runway's `eleven_v4` presets aren't these voices.
- **Lines:** 13, 712 characters in all.
- **Estimate:**
  - ElevenLabs: 712 characters on the existing plan, well under $1;
  - Runway credits: **0** (lane D's 40-credit budget is untouched);
  - cap: 2,000 characters, which covers a second take of every line.
- **Decided by:** each clip decodes and is levelled, and the owner hears them in session B.

### Risks

| Risk | What happens then |
|---|---|
| The line check adds noticeable latency | It runs alongside voicing. If the median first voice goes over 4 s, batch the first two lines into one check, and measure again |
| Better Auth's Facebook needs an email, and a reader has none | The clear "no email" return, with Google and the phone code as the other ways |
| Lane A's slots land late | The provider and the end page data are built and tested first. The door keeps today's look until lane A's lands |
| The spend ceilings are sized wrong | They're variables on Railway, changed without a deploy of code |
| A live sign-in fails after merge | Both flags off together, then the card |
