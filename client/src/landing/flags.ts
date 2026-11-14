/**
 * Sign-in is built but switched off for now, so development goes straight into the book (owner, Nov 14).
 * Turn it on with TT_PUBLIC_ACCOUNTS=on for the client and TT_ACCOUNTS=on for the backend, together.
 */
export const ACCOUNTS_ON = import.meta.env.TT_PUBLIC_ACCOUNTS === 'on';
