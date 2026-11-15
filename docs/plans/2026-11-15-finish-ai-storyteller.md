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

*For Codex review and the sprint master's approval. Read with `docs/plans/2026-11-14-ai-storyteller.md` (the concept), `docs/plans/2026-11-14-storyteller-satchel.md`, `docs/plans/2026-11-14-ai-mode-research.md`, `docs/room-effects.md` and the M3 session in `docs/playtest-notes.md`. File references are to `e5baeed`.*

### The one-paragraph version

Today the Storyteller is a good conversation with no shape. You talk, they act, a teapot appears, and it goes on until you take the headset off. Nothing is kept, and nothing tells you it ended. The owner felt immersion at M3. What's missing is everything that makes it a product: **a story with a beginning, a middle and an end, made up with you in about ten minutes, which goes on your shelf as a page and which the cast remembers next time.** Around that sit honest failure, caps that end a story gracefully instead of going silent, and sign-in switched on. Talk in the written chapters doesn't earn its place, and stays out.

### Positioning

**What it is.** *Tonight's story, made up with you.* Pip, Wick and Moth perform a new short story on your table from whatever you say. It's voiced live, it uses your real room, and it ends on a page you keep.

**How it sits beside the chapters.** Two ways in, at equal weight once chapter 1 is finished (`docs/prd.md` §0):

| | Chapters | The AI Storyteller |
|---|---|---|
| Who decides what happens | We wrote it | You and the cast, as you go |
| How you take part | Your hands, at the moments they ask | Your voice and your hands, any time |
| Length | About 6 minutes | About 10 minutes, and it ends when the story does |
| What you keep | Keepsakes, and your place | The story's page on your shelf, everything painted for you, and a cast that remembers |
| Needs | Nothing | Sign-in, the microphone and the internet |

**The name stays "AI Storyteller".** It says what it is to a judge in two words, and the owner chose it. The word "AI" lives on the page outside the book only. Inside, nobody mentions AI (the prompt already says so, `backend/src/storyteller/turn.ts:98-131`).

**Copy** (inside lane A's door, whose layout is theirs):

- Door title: **"Or make up a new story, out loud."** (today's, kept)
- Door line: **"Tell Pip, Wick and Moth what tonight's story is about. They make it up with you in their own voices, on your table and around your room, and it ends on a page you keep."** It replaces "…hand them anything, and the story is made up as you go. Every voice is live." That line sells the mechanism. The new one sells the evening.
- Under the button: **"About 10 minutes · your voice · needs sign-in and the internet"**, in the same form as chapter 1's "about 6 minutes · just your hands".
- About page (`about.storyteller`): **"Tell Pip, Wick and Moth what tonight's story is about, and they make it up with you, out loud. They answer in their own voices, paint the things you ask for, and bring the weather, the stars or the sea into your room. Each story ends on a page in your book, and they remember it next time. It needs an account and the internet."**
- PRD: a rewritten §0 bullet for the Storyteller, and §5's core loop gains the Storyteller's own loop (below). §6 "Tonight's lost thing" becomes this mode. Lane D edits only those lines.
- Rename the leftovers: the sign-in email still says "Tabletop Theater" (`backend/src/auth/email.ts:25-26`), and so do Better Auth's `appName` and the default `RESEND_FROM` (`backend/src/auth/index.ts:39, 48`). All become Foldtales.

### The journey in and out

**On the page (the headset), the door has six states.** Lane A draws them, and lane D supplies the state and the words:

| You are | The door's button | Under it |
|---|---|---|
| Signed out | Sign in to start | The bookplate: "Continue with Google" or the phone code |
| Signed in, mic not yet allowed | Let them hear you | "Your voice goes to a speech service and isn't kept." |
| Ready, no stories yet | Start a story | About 10 minutes · your voice |
| A story left unfinished | Continue "The Teapot Who Lost Its Whistle" | Start a new story |
| With finished stories | Start a story | Your stories (3), which opens their pages |
| Tonight's stories all told (cap) | Back tomorrow evening | "The lamp's oil is spent for tonight." Your stories stay readable |

**Off the headset** (desktop or phone), the door explains and sends you to your Quest, as lane A's front page does today. **Your stories are readable here too** once they're saved to your account (a should, below). It gives the phone a reason to exist after the story.

**Into the book.** One tap enters XR straight into the Storyteller, as today (`client/src/index.ts:1096`). The book searches, lands and opens, the lamp lights, and the cast is waiting (`client/src/storyteller/live.ts:89-105`). Today's second microphone prompt at the door (`index.ts:1150-1162`) is folded into one.

**Inside the book.** Lane A's single set of controls carries the Storyteller's entries. Lane D asks the sprint master for these slots:
- **pause:** closing the book, as now;
- **"End the story here":** the cast wraps up properly and you get the page, never a cut;
- **"Start a new story";**
- **"Your stories":** the contents, showing your shelf;
- **the satchel;**
- **leave.**

**Out of the book.** The end page (below), then close the book. Back on the page, the new story is on your shelf, and the door says "Start a story". Leaving mid-story keeps it as "Continue …" on this headset until you finish or start another.

### What a finished Storyteller session feels like

*An evening, about ten minutes.*

1. **The welcome (0:00–0:40).** The book opens and the lamp comes up. Pip looks up at you: "Oh! It's you." If you've been here before, the cast remembers: Wick, squinting at his logbook, "Did that teapot ever find its whistle?" Then the ask, with two ideas in case you're tongue-tied: "What shall tonight's story be about? A storm at sea, perhaps. Or you could tell us something you've lost." The paper tab in front of the book glows: *Hold to talk*.
2. **Your idea becomes the story (0:40–1:30).** You say "a lighthouse keeper's cat who's afraid of water." Within about 3 s Wick grumbles, Moth flutters, and the narrator names it: *"The Cat Who Wouldn't Swim."* The page turns to the shore. Behind the scenes, the story now has a plan: a problem, two turns that belong to you, and an ending (see "How it's built").
3. **The middle (1:30–8:00).** The cast plays it out in their own voices. Two or three times the story turns to you: "Should we build her a boat, or teach her to float?" Your answer *is* the next scene. You can interrupt any time ("Wait, what if the sea came in here?"), and the sea rises round your feet (ROOM `sea`). Ask for something and Moth flies off the page to fetch it, then comes back carrying it: a painted paper boat, in about 25 s. Stay quiet and the story carries on without you, gently.
4. **Winding down (from about 8:00).** The cast heads for the ending they planned, shaped by what you did. The reader can bring it on sooner ("let's finish it", or the controls' "End the story here").
5. **The end (about 10:00).** The narrator gathers it up: "And so the cat who wouldn't swim became the first cat to sail the Lost and Found." The lamp's beam sweeps your real room, the signature moment, kept for the ending as in chapter 1. The page lies open, printed with:
   - the title;
   - two or three lines of what happened;
   - the things painted tonight, in a row, going into your satchel;
   - *"The end of tonight's story"*, then **Tell another** and **Read your stories**.

   Close the book to stop.
6. **Next evening.** "You're back! Did the cat ever go sailing again?" Your satchel holds the boat, and the cast can bring it out by name, for free.

**The rules that make it feel finished:**
- **Every line is spoken.** If voices fail, captions carry it and the cast still acts.
- **Nothing promised that doesn't show.** This already holds for objects and room effects. It's widened to the two prompt lines that over-promise today: the thunder flash and the rain darkening the room (`turn.ts:42, 45`), which the renderer no longer does (`index.ts:838-840`).
- **Never silent, never a dead end.** Every failure has an in-story outcome (below).
- **Room effects are moments, not wallpaper.** At most one new room effect every couple of minutes, chosen because the story calls for it. The beam is saved for the end.

### The gaps today (from the code)

| Gap | Today | Finished |
|---|---|---|
| **No shape** | No premise ask, no plan, no ending. The scheduler never ends (`live.ts:134-137`) | Welcome, premise, plan, middle with your turns, wind-down, ending |
| **No ending or page** | Nothing gathers the story | Narration, beam, the end page with title, summary and tonight's things |
| **Nothing saved** | History is memory only (`session.ts:53`), checkpoints skipped (`index.ts:691`), `sessions: []` (`show/progress.ts:83`) | Finished stories on your account, an unfinished one on the headset |
| **No memory between evenings** | `canon: []` every turn | The last few stories' titles and endings go into the welcome |
| **Silent failures** | Caps, moderation refusals, Runway failures and broken streams all go quiet. `onError` ignores everything but sign-in and offline (`index.ts:512-517`) | An in-story line for each, voiced, plus a printed line on the page where it helps |
| **Painting** | Nothing shown while pending, nothing on failure (`index.ts:530`), lands at one fixed spot (`index.ts:540`), no look-bar check beyond the cut-out | Moth fetches it and brings it back, or comes back empty-handed. It lands by whoever asked. A quick vision check before it's shown |
| **The moderation redirect** | "The page turned all by itself…" but it doesn't turn (`turn.ts:417`, `session.ts:134-141`). The blocked words stay in the history (`session.ts:83`). Claude's own refusals go silent | The page really turns to a cozier set. Blocked words leave the history. A refusal plays the same redirect |
| **Caps** | Daily per-route caps only. `paintResult` polling spends about 30 calls a painting (`guard.ts:41`). The paint credit count lives in memory and resets on restart. No per-story limits | Per-user stories, turns and paintings a day, a global daily ceiling, polling free, credits counted in the database. Hitting a cap ends the story gracefully |
| **Speech** | "Wait for the glow" can stick (`index.ts:594-601`). A token fetched ahead can go stale on a long pause | The tab resets. The token is refetched when it's older than 10 minutes |
| **Copy and leftovers** | "on its way to this book", unused door labels (`index.ts:1142-1149`), "Tabletop Theater" in email, `console.info` on every press | Final copy. Debug logs only behind the dev flag |
| **Voices** | `art/voice/live.json` is "to be judged by ear in the headset", and never was | The owner approves the four voices in the headset session |
| **Sign-in** | Built, off on both sides | On end to end: Google in Quest Browser, the phone code, the email code (stage 2) |

### Cost and caps

**What a story costs** (from `docs/plans/2026-11-14-ai-storyteller.md` and M3's logs; to be measured in stage 3):
- voices: about $0.30 for a ten-minute story;
- speech to text: about $0.03;
- Claude: about 25 turns at a few cents each;
- paintings: 2 Runway credits each.

**Roughly $1 a story, plus paintings.** It's free to readers during the competition (PRD §16).

**Proposed limits, all environment variables with these defaults:**

| Limit | Default | When it's reached |
|---|---|---|
| Stories per reader per day | 3 | The door says "Back tomorrow evening". Your stories stay readable |
| Turns per story | 40 (about 15 min) | The cast winds down from turn 32, and ends by 40 |
| Paintings per story / per reader per day | 6 / 12 | Moth: "My wings are tired, but your satchel's full of treasures." The cast uses what's there |
| Stories per day, everyone | 150 (about $150 at worst) | The door says "The Storyteller is resting tonight." Chapters are untouched |
| Live painting credits, in all | 100, counted in the database (owner: "100–150 in all") | Nothing more is painted. The story goes on |

`paintResult` polls stop counting as AI calls. Painting is capped where it starts.

### Slow or failed AI: what you see and hear

The PRD's rule: never wait, never pretend, and never hide a failure behind repeated filler. Short narrator lines for these cases are **recorded once, ahead of time**, so they play even when the AI or the voices are down. They're art run **023**: about 12 lines with the live narrator's ElevenLabs voice, well under $1, no Runway credits. A written plan goes under `art/README.md` first.

| What | You see and hear |
|---|---|
| Thinking (over about 3 s) | Whoever was spoken to acts it out: Wick turns his logbook, Pip looks up at you, Moth circles the lamp. Nothing is said |
| Claude slow (over 20 s) or failed | The narrator, recorded: "The lamp flickers… where were we?" The tab glows again, and your last words are kept for the next try |
| The stream breaks partway | The lines already spoken stand, then the same recorded line |
| Voices down | Captions on the page, and the cast still acts. One printed line: "Their voices are quiet tonight, so the words are on the page." |
| Speech to text down | The tab says "I couldn't hear you just then", and resets |
| Painting fails, or fails the look check | Moth comes back empty-handed: "Couldn't find it anywhere!" The story goes on |
| Offline | Recorded narrator line, and the page says "No internet connection. The story waits here." It picks up again when you're back online |
| A cap is reached mid-story | The cast ends the story properly, and you get the page. Never a cut |

### Moderation

- **What you say** is checked before anything is spoken or painted, as today. It fails open on a moderation timeout (4 s). That's kept, so a slow check never stalls the story. Claude's PG prompt is the second line.
- **A redirect really happens.** The page turns to a cozier set, the narrator's line matches it, and the blocked words are dropped from the history, so they don't come back.
- **What's painted** is checked twice, as today (`backend/src/storyteller/paint.ts:74, 108`), plus the new look check.
- **Claude's own refusal** plays the same redirect instead of going silent.
- **Names:** the cast takes a name you give a thing, as the teapot showed. It never guesses yours (`turn.ts` rules).
- **Privacy** (to lane E for the privacy page): story titles, summaries and the names of painted things are saved to your account, and deleted with "Delete my book". The pictures stay on the headset. Your voice goes to ElevenLabs and isn't kept. The room's shapes are described to the AI.

### Talk in the written chapters: no

It doesn't earn its place in v1:
- **The owner rejected it.** The AI in a written chapter "didn't land" (session 1, Nov 14), and chapter 1 is approved as authored.
- **It works against the chapters' design.** They're built hands-only, and completable silently (PRD §8).
- **It's new risk in lanes B and C's content**, during their build.

The Storyteller is where your voice matters. The written chapters stay theatre you reach into. Talk in chapters goes to `docs/v2-ideas.md` (Talk at a chapter's asks: "Pip, use your coat as a sail!"). That's the research's shape B, worth trying once chapters 2 and 3 exist.

### How it's built (the shape, for stage 2 to detail)

- **The plan.** The first turn after your idea also returns the story's title and a short private plan: the problem, the reader's turns and the ending. The client sends it back with every turn. The backend stays stateless, as today.
- **The clock.** The turn request carries the story's time and turn count. The prompt switches from middle to winding down to the end by them, or by the reader's "End the story here".
- **The ending.** A final turn returns the closing narration and the page: title, summary and tonight's things. The client plays the beam and shows the end page in lane A's end-page layout, with a Storyteller variant.
- **Saving.**
  - Finished stories go to your account. They're small text records: title, date, summary, the names of the things.
  - The page-side shelf reads them.
  - An unfinished story stays on the headset, in IndexedDB beside the keepsakes: its plan, history and set. "Continue" replays to that set, and the narrator picks up: "Where were we… ah, the cat."
- **Memory.** The welcome turn gets your last three stories' titles and endings.
- **Contracts, one small PR, first:** the turn request's `story` (plan, time, turns, phase) and `recent` (past stories); the `ending` event; `GET`, `PUT` and `DELETE /v1/me/stories`; `LibraryState.storyteller.sessions` filled in. It's sent to the sprint master before anything else in stage 3.

### What ships by the Nov 17 freeze

**Must** (the finished product; cut nothing here):
1. **Sign-in on, end to end.** Google in Quest Browser, the phone code, the email code, `TT_ACCOUNTS` and `TT_PUBLIC_ACCOUNTS` on together. The front door plan's cutoff stands: if it isn't working on the real link by **Nov 16 at noon**, the sprint master gets one card (hold the AI to signed-in readers, or open it to guests with a nightly limit per headset).
2. **The story's shape.** Welcome with two ideas, the premise naming the story, the plan, the reader's turns, the wind-down and the ending.
3. **The end page and the beam,** with Tell another.
4. **Every failure in-story,** including the recorded lines (run 023) and the redirect that really turns the page.
5. **Caps that end stories gracefully,** with polling free and credits counted in the database.
6. **Painting finished:** Moth fetches and returns, or comes back empty-handed. It lands by whoever asked.
7. **Positioning and copy:** the door states and words, About, the PRD lines, and the Foldtales rename in auth.
8. **The owner's voice approval** in the headset session.

**Should** (in order; cut from the bottom):

9. Finished stories saved to your account, shown on the door as "Your stories", and in the book's contents.
10. The cast remembers your last stories in the welcome.
11. Continue an unfinished story on this headset.
12. The quick vision look check on paintings.
13. Your stories readable on the phone or desktop page.

**Cut, to `docs/v2-ideas.md`:**
- Talk in the written chapters;
- a SOUND step for live sound effects (the route exists, unused);
- the camera ("show them something real");
- your voice in the cast;
- the satchel following your account.

### Needs from other lanes (through the sprint master)

- **Lane A:**
  - the door's six states, with a slot for "Your stories";
  - the Storyteller's entries in the one set of controls: "End the story here", "Start a new story", "Your stories";
  - a Storyteller variant of the end page: title, two or three lines, a row of things, Tell another, Read your stories.
- **Lane E:** the privacy lines above. The submission text's line, "Sign in with Google in the headset to try the AI Storyteller". The fps check of a ten-minute story with two room effects.
- **Lanes B and C:** none. Talk stays out of the chapters.

### Decisions for the sprint master

1. **Story length:** about 10 minutes, ending by turn 40. *Recommended.*
2. **Daily limits:** 3 stories per reader, 150 for everyone, 100 live painting credits in all. *Recommended*, or name a different ceiling.
3. **Talk in the written chapters is cut** to v2. *Recommended.*
4. **Finished stories saved to the account** (a contracts PR) rather than only on the headset. *Recommended:* sign-in is required anyway, and it gives the phone page and "Delete my book" something real to do.
