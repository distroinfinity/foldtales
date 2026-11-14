/**
 * Sign-in is built but switched off for now, so development goes straight into the book (owner, Nov 14).
 * Turn it on with TT_PUBLIC_ACCOUNTS=on for the client and TT_ACCOUNTS=on for the backend, together.
 */
export const ACCOUNTS_ON = import.meta.env.TT_PUBLIC_ACCOUNTS === 'on';

/**
 * The AI Storyteller, on unless a build says TT_PUBLIC_STORYTELLER=off. The live site starts with it off
 * (owner, Nov 15: host now, AI off in production), so the door says it's coming instead of opening.
 */
export const STORYTELLER_ON = import.meta.env.TT_PUBLIC_STORYTELLER !== 'off';
