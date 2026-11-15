# Lane D: the AI Storyteller, finished

*Finish sprint, Nov 15, 2026. Branch `finish-ai-storyteller`. Sign-in is required for the AI (owner's decision). It's built and switched off; this lane turns it on end to end.*

## Owner's setup checklist (do this first, today)

About 30 minutes of clicking, plus up to an hour waiting for DNS. **Type secrets only into Railway's dashboard, never into this chat or a `!` command,** so they stay out of every log.

### Already done (checked Nov 15, values not shown)

Railway, project `foldtales`, service `backend`, already has: `BETTER_AUTH_SECRET` (64 hex), `BETTER_AUTH_URL=https://api.foldtales.xyz`, `TT_CLIENT_HOST=www.foldtales.xyz`, `TT_TOKEN_SECRET`, `TT_ADMIN_TOKEN`, `DATA_DIR=/data`, `NODE_ENV=production`, and the AI keys. `https://api.foldtales.xyz/healthz` answers 200, and `/v1/auth/google/start` answers with a clean "Google isn't set up" return. This workspace's `.env.local` has its own `BETTER_AUTH_SECRET`, so a dev restart keeps you signed in. Nothing to generate.

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

### 2. Resend, for the email code on your phone (about 10 minutes, plus DNS)

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

### 3. Tell me "done"

Then I, without showing any value:

- set `RESEND_FROM=Foldtales <stories@foldtales.xyz>` on Railway;
- copy `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `RESEND_API_KEY` from Railway into this workspace's `.env.local` (ignored by git), so you can test sign-in here first;
- check that `api.foldtales.xyz/v1/auth/google/start` now goes to Google, and that a code email arrives at an address you give me.

**Not yet:** `TT_ACCOUNTS=on` (Railway) and `TT_PUBLIC_ACCOUNTS=on` (the Pages build). They go on together, in stage 3, once sign-in has passed end to end in the headset: Google in Quest Browser, and the phone code.
