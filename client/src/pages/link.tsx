/**
 * On your phone or laptop: sign your headset in. Three steps, each saying what happens next:
 * enter the headset's code, sign in here (Google or an email code), then say yes to the headset.
 *
 * Google leaves this page and comes back. Back with a session, it's the last step; back without one
 * (cancelled, a failure, or Google not set up) it's the sign-in step again, saying what happened, with
 * the headset's code kept. Only the ways in the backend has switched on are offered.
 */
import { useEffect, useState, type FormEvent } from 'react';
import { approveDevice, denyDevice, emailSendCode, emailVerify, getSession, phoneVerifyCode, startGoogleSignIn, signInMethods, type SignInMethods } from '../account/index.ts';
import { signInProblemText } from '../landing/account-ui.ts';
import { ACCOUNTS_ON } from '../landing/flags.ts';
import { Shell, mount } from './shell.tsx';

const field = 'min-h-16 w-full rounded-[12px] border border-page/25 bg-[#1d1814] px-5 text-[22px] text-page outline-none focus:border-gold';
const primary = 'min-h-14 w-full cursor-pointer rounded-[12px] border-0 bg-rust px-6 text-[19px] font-medium text-page disabled:opacity-60';
const secondary = 'button flex min-h-14 w-full cursor-pointer items-center justify-center gap-3 rounded-[12px] border border-page/20 bg-page px-6 text-[19px] font-medium text-ink no-underline';
const quiet = 'cursor-pointer border-0 bg-transparent p-2 font-[inherit] text-[16px] text-page/70 underline decoration-page/30 underline-offset-4';

type Step = 'code' | 'sign-in' | 'email-code' | 'approve' | 'done' | 'declined';

function Link() {
  const params = new URLSearchParams(location.search);
  const [code, setCode] = useState(params.get('user_code') ?? params.get('code') ?? '');
  const [step, setStep] = useState<Step>('code');
  const [who, setWho] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [methods, setMethods] = useState<SignInMethods | null>(null);

  useEffect(() => {
    void signInMethods().then(setMethods);
    // Back from Google, with the headset's code still in the address.
    const back = params.get('step');
    if ((back !== 'approve' && back !== 'sign-in') || !code) return;
    const said = signInProblemText(params.get('problem'), 'phone');
    history.replaceState(null, '', `${location.pathname}?user_code=${encodeURIComponent(code)}`);
    void (async () => {
      const session = back === 'approve' ? await getSession() : null;
      if (session) {
        setWho(session.user.email);
        setStep('approve');
        return;
      }
      // No session: the sign-in step again, if the headset's code is still waiting, saying what happened.
      const waiting = await phoneVerifyCode(code);
      if (waiting === 'pending') {
        setProblem(said ?? 'Google didn’t finish signing you in. Try again, or get a code by email.');
        setStep('sign-in');
      } else if (waiting === 'expired') {
        setCode('');
        setProblem('That headset code expired while you were signing in. Your headset shows a new one: enter it here.');
      } else if (waiting === 'offline') setProblem('Couldn’t reach the server. Check your connection, then try again.');
      else setProblem(said);
    })();
  }, []);

  const checkCode = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setProblem(null);
    const result = await phoneVerifyCode(code);
    setBusy(false);
    if (result === 'pending') {
      const session = await getSession();
      if (session) {
        setWho(session.user.email);
        setStep('approve');
      } else setStep('sign-in');
    } else if (result === 'expired') setProblem('That code has expired. Your headset shows a new one; enter that instead.');
    else if (result === 'offline') setProblem('Couldn’t reach the server. Check your connection, then try again.');
    else setProblem('That code doesn’t match a headset. Check it against the one on your headset.');
  };

  const sendEmail = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setProblem(null);
    const ok = await emailSendCode(email);
    setBusy(false);
    if (ok) setStep('email-code');
    else setProblem('Couldn’t send a code to that address. Check it, then try again.');
  };

  const checkEmail = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setProblem(null);
    const result = await emailVerify(email, emailCode);
    setBusy(false);
    if (result === 'ok') {
      setWho(email);
      setStep('approve');
    } else if (result === 'wrong-code') setProblem('That code isn’t right. Check the latest email from us.');
    else if (result === 'expired') setProblem('That code has expired. Send a new one.');
    else setProblem('Couldn’t sign you in. Try again.');
  };

  const answer = async (yes: boolean) => {
    setBusy(true);
    const result = yes ? await approveDevice(code) : await denyDevice(code);
    setBusy(false);
    if (result === 'ok') setStep(yes ? 'done' : 'declined');
    else if (result === 'expired') {
      setProblem('That code expired. Your headset shows a new one: enter it here.');
      setCode('');
      setStep('code');
    }
    else setProblem('Couldn’t reach the server. Try again.');
  };

  const returnTo = `${location.origin}${location.pathname}?user_code=${encodeURIComponent(code)}&step=approve`;

  return (
    <Shell title="Sign in your headset">
      <div className="max-w-[440px]">
        {problem && (
          <p className="m-0 mb-5 text-[17px] text-[#e8907a]" role="alert">
            {problem}
          </p>
        )}
        {step === 'code' && (
          <form className="flex flex-col gap-4" onSubmit={checkCode}>
            <p className="m-0">Enter the code your headset shows. You’ll sign in here, and your headset will follow.</p>
            <label className="text-[16px] text-page/70" htmlFor="code">
              Code from your headset
            </label>
            <input id="code" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="one-time-code" autoCapitalize="characters" spellCheck={false} className={`${field} text-[28px] uppercase tracking-[0.14em]`} placeholder="KXTR-49QM" required />
            <button type="submit" className={primary} disabled={busy}>
              Continue
            </button>
          </form>
        )}
        {step === 'sign-in' && (
          <div className="flex flex-col gap-4">
            <p className="m-0">Now sign in. This is the account your headset will use.</p>
            {methods?.google === false ? (
              <p className="m-0 text-[16px] text-page/70">Google sign-in isn’t switched on here yet, so use an email code.</p>
            ) : (
              <button type="button" className={secondary} onClick={() => void startGoogleSignIn(returnTo)}>
                Continue with Google
              </button>
            )}
            {methods?.email === false ? (
              <p className="m-0 text-[16px] text-page/70">Email codes aren’t switched on here yet{methods.google ? ', so use Google' : ''}.</p>
            ) : (
              <form className="mt-2 flex flex-col gap-3" onSubmit={sendEmail}>
                <label className="text-[16px] text-page/70" htmlFor="email">
                  {methods?.google === false ? 'Get a code by email' : 'Or get a code by email'}
                </label>
                <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className={field} placeholder="you@example.com" required />
                <button type="submit" className={primary} disabled={busy}>
                  Email me a code
                </button>
              </form>
            )}
          </div>
        )}
        {step === 'email-code' && (
          <form className="flex flex-col gap-4" onSubmit={checkEmail}>
            <p className="m-0">We sent a 6-digit code to {email}.</p>
            <input value={emailCode} onChange={(e) => setEmailCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" className={`${field} tracking-[0.3em]`} placeholder="123456" aria-label="The code from the email" required />
            <button type="submit" className={primary} disabled={busy}>
              Sign in
            </button>
            <button type="button" className={quiet} onClick={() => setStep('sign-in')}>
              Use a different email
            </button>
          </form>
        )}
        {step === 'approve' && (
          <div className="flex flex-col gap-4">
            <p className="m-0">
              Sign in your headset as <strong>{who}</strong>?
            </p>
            <button type="button" className={primary} disabled={busy} onClick={() => void answer(true)}>
              Yes, sign it in
            </button>
            <button type="button" className={quiet} disabled={busy} onClick={() => void answer(false)}>
              No, that’s not my headset
            </button>
          </div>
        )}
        {step === 'done' && <p className="m-0 text-[21px] text-page">Your headset is signed in. You can put your phone away.</p>}
        {step === 'declined' && <p className="m-0">Nothing was signed in. Your headset will show a new code if you want to try again.</p>}
      </div>
    </Shell>
  );
}

mount(
  ACCOUNTS_ON ? (
    <Link />
  ) : (
    <Shell title="Sign in your headset">
      <p>Sign-in isn’t switched on yet. You don’t need an account to read the book.</p>
    </Shell>
  ),
);
