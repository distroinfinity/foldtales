# Sign-in walkthrough

Lane D, Nov 17. This shows the sign-in screens after lane A's audit fixes. Everything was run on the Mac against this branch's built client (`TT_PUBLIC_ACCOUNTS=on`), served over plain http on `CLIENT_PORT`, with the dev backend on `BACKEND_PORT`.

Two browser panes played the two devices:

- **The headset** was `127.0.0.1:5120` with a Quest Browser user agent.
- **The phone** was `localhost:5120`, a separate origin, so the two keep separate sign-ins.

## How each case was run

- **Real Google:**
  - **A sign-in:** the owner picked their account on Google's own page. It created the account, recorded the device, and sent the welcome email.
  - **A refused return:** an earlier Google page had been left open for over 30 minutes. Its sign-in state had lapsed (Google's lasts 10 minutes), so the backend refused it as a state mismatch. The reader then sees screen 16.
- **Google not set up:** the backend was started without `GOOGLE_CLIENT_ID`.
- **Phone codes:** the backend was started without `RESEND_API_KEY`, so it prints email codes to its log.
  - **Expired:** the code was expired in the dev database rather than waiting out its lifetime.
- **Real email:**
  - **Sending:** one code went through Resend to its test address, `delivered@resend.dev`, and Resend accepted it (screen 20).
  - **Reading it:** reading a real code from a real inbox is the owner's step.
- **Cancelled and failed Google returns:** made by sending the browser to the backend's real return route (`/v1/auth/google/done`) with `failed=1` (and Google's `error=access_denied` for a cancel).

## The screens

| # | Screen | What it is |
|---|---|---|
| 01 | Headset page, signed out | The Storyteller's door: "Sign in to start". |
| 02 | Bookplate, from the door, Google not set up | Google's button is disabled and says why; "Use your phone" is the way in. |
| 03 | Headset code | The phone code, waiting for the phone. |
| 04 | Phone: wrong headset code | "That code doesn't match a headset." |
| 05 | Phone: sign-in step, Google not set up | Only the email code is offered, and the page says why. |
| 06 | Phone: wrong email code | "That code isn't right. Check the latest email from us." |
| 07 | Phone: approve | "Sign in your headset as …?" |
| 08 | Phone: declined | "Nothing was signed in." |
| 09 | Headset after the decline | A new code, and a line saying why. |
| 10 | Phone: expired headset code | "That code has expired. Your headset shows a new one." |
| 11 | Headset after the expiry | A new code, and a line saying why. |
| 12 | Phone: approved | "Your headset is signed in. You can put your phone away." |
| 13 | Headset, signed in | Back at the same place on the page as the door that started it. The header reads "walkthrough's book", and the door now says "Start a new story". |
| 14 | Headset: Google not set up, returned | The bookplate reopens at the door with "Signing in with Google isn't available just now." |
| 15 | Headset: Google cancelled | The bookplate reopens at the door with "You didn't finish signing in with Google, so nothing changed." |
| 16 | Headset: Google failed | The bookplate reopens at the door with "Google didn't finish signing you in." |
| 17 | Phone: sign-in step | Google and an email code, with the headset's code kept. |
| 18 | Phone: Google cancelled | Back at the sign-in step with the code kept, saying what happened, and offering the email code. |
| 19 | Phone: back from Google without a session | It no longer drops silently to the code step: the sign-in step, saying so. |
| 20 | Phone: a real email code sent | Through Resend, to `delivered@resend.dev`. |

## What changed (lane A's five gaps)

1. **The door's "Sign in to start" now comes back to the door** (13). The page remembers where the reader was, in this tab, across Google's round trip and the reload after a phone code, and scrolls back there. Nothing is chosen for the reader: the chapters' card keeps its own button.
2. **A cancelled or failed Google return goes back to the page that started it and says why** (14–16 on the headset, 18–19 on the phone).
3. **Google is offered only when it's switched on.** The backend says which methods are on (`GET /v1/auth/methods`). With Google off, the bookplate disables its button and gives the reason (02), and the phone's page offers only the email code (05).
4. **`/link/` after a Google failure** shows the sign-in step with the headset's code kept and the reason (18, 19). It checks that code is still waiting first, and says so if it expired meanwhile.
5. **This walkthrough** is the proof.

## Not shown

- **Google's own pages:** the chooser and consent screens show the owner's account, so they aren't kept.
- **The welcome email:** it arrived in the owner's inbox after their Google sign-in.
