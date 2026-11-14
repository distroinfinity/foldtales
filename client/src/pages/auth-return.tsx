/** Back from Google: trade the one-time code for a session, then go home. Wired once accounts merge. */
import { Shell, homeUrl, mount } from './shell.tsx';

mount(
  <Shell title="Signing you in…" depth={2}>
    <p>
      One moment. If nothing happens, <a href={homeUrl(2)}>go back to the book</a>.
    </p>
  </Shell>,
);
