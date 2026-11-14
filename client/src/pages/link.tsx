/**
 * On your phone or laptop: sign your headset in. Enter the code it shows, sign in here, then approve.
 * Wired to the accounts layer once it's merged.
 */
import { Shell, mount } from './shell.tsx';

function Link() {
  const code = new URLSearchParams(location.search).get('code') ?? '';
  return (
    <Shell title="Sign in your headset">
      <p>Enter the code your headset shows. You’ll sign in here, and your headset will follow.</p>
      <form className="mt-6 flex max-w-[420px] flex-col gap-4" onSubmit={(e) => e.preventDefault()}>
        <label className="text-[17px] text-page/80" htmlFor="code">
          Code from your headset
        </label>
        <input
          id="code"
          name="code"
          defaultValue={code}
          autoComplete="one-time-code"
          autoCapitalize="characters"
          spellCheck={false}
          className="min-h-16 rounded-[10px] border border-page/25 bg-night px-5 text-[28px] uppercase tracking-[0.14em] text-page outline-none focus:border-gold"
          placeholder="KXTR-49QM"
        />
        <button type="submit" className="min-h-14 cursor-pointer rounded-[10px] border-0 bg-rust px-6 text-[19px] font-medium text-page">
          Continue
        </button>
      </form>
    </Shell>
  );
}

mount(<Link />);
