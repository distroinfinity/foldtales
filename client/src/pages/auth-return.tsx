/**
 * Back from Google. The address carries a one-time code; it's traded for the session at once and
 * removed from the address. A headset sign-in then records the headset and merges its book; the
 * phone's page goes back to its last step.
 */
import { useEffect, useState } from 'react';
import { finishGoogleReturn, linkThisDevice, readLocalBook, syncBook, writeLocalBook } from '../account/index.ts';
import { Shell, homeUrl, mount } from './shell.tsx';

function Return() {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const ott = params.get('ott');
    const requested = params.get('return');
    history.replaceState(null, '', location.pathname);
    let target = homeUrl(2);
    try {
      const url = requested ? new URL(requested, location.href) : null;
      if (url && url.origin === location.origin) target = url.href;
    } catch {
      // Home it is.
    }
    if (!ott || params.get('error')) {
      setFailed(true);
      return;
    }
    void (async () => {
      if (!(await finishGoogleReturn(ott))) return setFailed(true);
      // The phone's page approves the headset itself; a headset records itself and merges its book.
      if (!new URL(target).pathname.includes('/link/')) {
        await linkThisDevice();
        writeLocalBook(await syncBook(readLocalBook()), 'flagship-1');
      }
      location.replace(target);
    })();
  }, []);
  return (
    <Shell title={failed ? 'Couldn’t sign you in' : 'Signing you in…'} depth={2}>
      {failed ? (
        <p>
          Google didn’t finish signing you in. <a href={homeUrl(2)}>Go back to the book</a> and try again, or use your phone instead.
        </p>
      ) : (
        <p>One moment.</p>
      )}
    </Shell>
  );
}

mount(<Return />);
