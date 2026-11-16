/**
 * Back from Google. The address carries a one-time code; it's traded for the session at once and
 * removed from the address. A headset sign-in then records the headset and merges its book; the
 * phone's page goes back to its last step.
 *
 * Without a session (cancelled on Google's page, Google not set up, or a failure), the reader goes
 * back to the page that started it, which says what happened: the bookplate on the headset's page
 * (in front of the Storyteller's door, if that's where it began), or the sign-in step on the phone's.
 */
import { useEffect, useState } from 'react';
import { finishGoogleReturn, linkThisDevice, readLocalBook, syncBook, writeLocalBook } from '../account/index.ts';
import { failedTarget, readProblem, returnTarget, signedIn, signInFailed } from '../landing/account-ui.ts';
import { Shell, homeUrl, mount } from './shell.tsx';

/** The address is read once: React's development double-run would otherwise find it already cleared. */
let started = false;

function Return() {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (started) return;
    started = true;
    const params = new URLSearchParams(location.search);
    const ott = params.get('ott');
    const error = params.get('error');
    history.replaceState(null, '', location.pathname);
    const target = returnTarget(params.get('return'), location.href, homeUrl(2));
    const fail = (raw: string | null) => {
      const problem = readProblem(raw);
      setFailed(true);
      if (!target.pathname.includes('/link/')) signInFailed(problem);
      location.replace(failedTarget(target, problem));
    };
    if (!ott || error) return fail(error);
    void (async () => {
      if (!(await finishGoogleReturn(ott))) return fail('google');
      // The phone's page approves the headset itself; a headset records itself and merges its book.
      if (!target.pathname.includes('/link/')) {
        await linkThisDevice();
        writeLocalBook(await syncBook(readLocalBook()), 'flagship-1');
        signedIn();
      }
      location.replace(target.href);
    })();
  }, []);
  return (
    <Shell title={failed ? 'Couldn’t sign you in' : 'Signing you in…'} depth={2}>
      <p>{failed ? 'Taking you back…' : 'One moment.'}</p>
    </Shell>
  );
}

mount(<Return />);
