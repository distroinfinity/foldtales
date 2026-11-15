import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { DatabaseSync } from 'node:sqlite';

/**
 * The welcome email: sent once when a reader's Foldtales account is created (owner, Nov 16). It
 * thanks an early reader and says what Foldtales is and what to do next, in the book's look: a
 * cream page on night navy, a serif headline, the book's four colours as a thin rule.
 *
 * Once per account, recorded in the database, whichever way they signed in and however often a
 * sign-in is retried. Never on sign-in's path: it's sent after the account exists, and a failure
 * is only logged. No reply-to (owner), no tracking, nothing that invites a reply.
 */

const SITE = 'https://www.foldtales.xyz';
export const WELCOME_MARK = `${SITE}/email/mark-128.png`;
/** The site, tagged so the welcome's visits can be told apart (owner, Nov 16). */
export const welcomeLink = (content?: 'body' | 'footer'): string =>
  `${SITE}/?utm_source=welcome-email&utm_medium=email&utm_campaign=welcome${content ? `&utm_content=${content}` : ''}`;

const C = {
  navy: '#1F2A44',
  page: '#F6EFE2',
  ink: '#2B2420',
  soft: '#5B5148',
  gold: '#D4A23E',
  rust: '#B5502E',
  sage: '#76917D',
  footer: '#C9C2B4',
};
const SERIF = "'Cormorant Garamond', 'Fraunces', Georgia, 'Times New Roman', serif";
const SANS = "'Atkinson Hyperlegible', 'Atkinson Hyperlegible Next', system-ui, -apple-system, 'Segoe UI', Arial, sans-serif";

export interface WelcomeEmail {
  subject: string;
  html: string;
  text: string;
}

const escape = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** A first name, only if the provider gave a real one (never the email, never made up). */
export function firstNameOf(name: string | null | undefined, email: string): string | null {
  const n = (name ?? '').trim();
  if (!n || n.includes('@') || n.toLowerCase() === email.toLowerCase()) return null;
  const first = n.split(/\s+/)[0]!;
  return first.length > 40 ? null : first;
}

/** The words, drafted for the owner's approval, in `welcome-copy.json`. */
export const WELCOME_COPY = JSON.parse(readFileSync(new URL('./welcome-copy.json', import.meta.url), 'utf8')) as {
  subject: string;
  preheader: string;
  headline: string;
  paragraphs: string[];
  button: string;
  buttonNote: string;
  signature: string;
  why: string;
};

export function renderWelcome({ name }: { name: string | null }): WelcomeEmail {
  const greeting = name ? `Hi ${name},` : 'Hello,';
  // The site's address in the words is a real link.
  const linked = (text: string) =>
    escape(text).replace('www.foldtales.xyz', `<a href="${escape(welcomeLink('body'))}" style="color:${C.navy};text-decoration:underline;">www.foldtales.xyz</a>`);
  const para = (text: string) =>
    `<p style="margin:0 0 18px 0;font-family:${SANS};font-size:16px;line-height:1.6;color:${C.ink};">${linked(text)}</p>`;
  // A table-cell button: the cell carries the fill, so Outlook shows it too (with square corners).
  const button = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 10px 0;"><tr>
      <td align="center" bgcolor="${C.navy}" style="background-color:${C.navy};border-radius:8px;">
        <a href="${escape(welcomeLink())}" style="display:inline-block;padding:12px 26px;font-family:${SANS};font-size:16px;line-height:20px;font-weight:700;color:${C.page};text-decoration:none;border-radius:8px;">${escape(WELCOME_COPY.button)}</a>
      </td></tr></table>
    <p style="margin:0 0 6px 0;font-family:${SANS};font-size:13px;line-height:1.5;color:${C.soft};">${escape(WELCOME_COPY.buttonNote)}</p>`;
  const rule = [C.navy, C.gold, C.rust, C.sage]
    .map((colour, i) => `<td width="${[34, 22, 16, 28][i]}%" height="3" style="height:3px;line-height:3px;font-size:0;background-color:${colour};" bgcolor="${colour}">&nbsp;</td>`)
    .join('');
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escape(WELCOME_COPY.subject)}</title>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&display=swap" rel="stylesheet">
<style>
  @media (max-width: 600px) {
    .ft-card { padding: 28px 22px 26px 22px !important; }
    .ft-title { font-size: 28px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:${C.navy};" bgcolor="${C.navy}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.navy};">${escape(WELCOME_COPY.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.navy}" style="background-color:${C.navy};">
<tr><td align="center" style="padding:40px 16px 24px 16px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
  <tr><td class="ft-card" bgcolor="${C.page}" style="background-color:${C.page};border-radius:14px;padding:40px 40px 36px 40px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td>
      <img src="${WELCOME_MARK}" width="56" height="56" alt="Foldtales" style="display:block;width:56px;height:56px;border:0;border-radius:12px;">
    </td></tr></table>
    <h1 class="ft-title" style="margin:28px 0 22px 0;font-family:${SERIF};font-size:34px;line-height:1.15;font-weight:600;color:${C.navy};">${escape(WELCOME_COPY.headline)}</h1>
    ${para(greeting)}
    ${WELCOME_COPY.paragraphs.map(para).join('\n    ')}
    ${button}
    <p style="margin:26px 0 30px 0;font-family:${SERIF};font-size:22px;line-height:1.2;font-weight:600;color:${C.navy};">${escape(WELCOME_COPY.signature)}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${rule}</tr></table>
  </td></tr>
  <tr><td align="center" style="padding:30px 24px 8px 24px;">
    <img src="${WELCOME_MARK}" width="32" height="32" alt="" style="display:block;width:32px;height:32px;border:0;border-radius:8px;margin:0 auto;">
    <p style="margin:12px 0 2px 0;font-family:${SERIF};font-size:18px;font-weight:600;color:${C.page};">Foldtales</p>
    <p style="margin:0 0 14px 0;font-family:${SANS};font-size:13px;"><a href="${escape(welcomeLink('footer'))}" style="color:${C.gold};text-decoration:none;">foldtales.xyz</a></p>
    <p style="margin:0;font-family:${SANS};font-size:12px;line-height:1.5;color:${C.footer};">${escape(WELCOME_COPY.why)}</p>
  </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>
`;
  const text = [
    WELCOME_COPY.headline,
    '',
    greeting,
    '',
    ...WELCOME_COPY.paragraphs.flatMap((p) => [p, '']),
    `${WELCOME_COPY.button}:`,
    welcomeLink(),
    WELCOME_COPY.buttonNote,
    '',
    WELCOME_COPY.signature,
    '',
    '—',
    'Foldtales',
    welcomeLink('footer'),
    WELCOME_COPY.why,
    '',
  ].join('\n');
  return { subject: WELCOME_COPY.subject, html, text };
}

/**
 * Sends one welcome. `deliveryId` is the account's durable delivery id, sent as the provider's
 * idempotency key, so a retry after a lost answer is the same email, not a second one. `sent`:
 * accepted. `failed`: certainly not sent (a refusal). `unknown`: the answer was lost.
 */
export type SendWelcome = (to: string, email: WelcomeEmail, deliveryId: string) => Promise<'sent' | 'failed' | 'unknown'>;

/** Sends through Resend, from RESEND_FROM. A reply-to only if WELCOME_REPLY_TO is set (it isn't: owner, Nov 16). */
export function resendWelcome({ resendKey, from, replyTo, fetch: send = fetch }: { resendKey: string; from: string; replyTo?: string | undefined; fetch?: typeof fetch }): SendWelcome {
  return async (to, email, deliveryId) => {
    let response: Response;
    try {
      response = await send('https://api.resend.com/emails', {
        method: 'POST',
        headers: { authorization: `Bearer ${resendKey}`, 'content-type': 'application/json', 'Idempotency-Key': `welcome/${deliveryId}` },
        body: JSON.stringify({ from, to: [to], subject: email.subject, html: email.html, text: email.text, ...(replyTo ? { reply_to: replyTo } : {}) }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      // It may have been accepted before the answer was lost.
      return 'unknown';
    }
    if (response.ok) return 'sent';
    // A server error may still have sent it; a client error (bad request, rate limit) certainly didn't.
    return response.status >= 500 ? 'unknown' : 'failed';
  };
}

export interface Welcomer {
  /** Called after a sign-in's session exists. Returns at once; the email goes out on its own. */
  afterSignIn(userId: string): void;
  /** Resolves when every email started so far has been tried (for tests). */
  settled(): Promise<void>;
  /** A deleted reader's record. */
  forget(userId: string): void;
}

/** Only accounts this new get a welcome, so readers from before this shipped aren't surprised by one. */
const NEW_ACCOUNT_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Once per account, durably: each account has one delivery id, and its state. `sending` while a
 * send is in flight; `sent` once accepted; `unknown` when the answer was lost, retried at the next
 * sign-in with the same id (the provider keeps one email per id); a definite failure releases it.
 */
export function createWelcomer(db: DatabaseSync, send: SendWelcome | null, log: (message: string) => void, now: () => Date = () => new Date()): Welcomer {
  db.exec("CREATE TABLE IF NOT EXISTS welcome_delivery (user_id TEXT PRIMARY KEY, delivery_id TEXT NOT NULL, state TEXT NOT NULL, at TEXT NOT NULL)");
  const read = db.prepare('SELECT delivery_id, state FROM welcome_delivery WHERE user_id = ?');
  const claimNew = db.prepare("INSERT OR IGNORE INTO welcome_delivery (user_id, delivery_id, state, at) VALUES (?, ?, 'sending', ?)");
  const claimRetry = db.prepare("UPDATE welcome_delivery SET state = 'sending', at = ? WHERE user_id = ? AND state = 'unknown'");
  const mark = db.prepare('UPDATE welcome_delivery SET state = ?, at = ? WHERE user_id = ?');
  const release = db.prepare('DELETE FROM welcome_delivery WHERE user_id = ?');
  // Prepared on first use: Better Auth creates its `user` table after this runs.
  let user: ReturnType<DatabaseSync['prepare']> | null = null;
  const userRow = (id: string) => (user ??= db.prepare('SELECT name, email, createdAt FROM user WHERE id = ?')).get(id);
  const inFlight = new Set<Promise<void>>();

  /** Claims this account's send, in one write: the delivery id to send under, or null when it's sent or in flight. */
  function claim(userId: string): string | null {
    const at = now().toISOString();
    const known = read.get(userId) as { delivery_id: string; state: string } | undefined;
    if (!known) return claimNew.run(userId, randomUUID(), at).changes === 1 ? (read.get(userId) as { delivery_id: string }).delivery_id : null;
    if (known.state === 'unknown' && claimRetry.run(at, userId).changes === 1) return known.delivery_id;
    return null;
  }

  async function welcome(userId: string): Promise<void> {
    const row = userRow(userId) as { name: string | null; email: string; createdAt: string | number } | undefined;
    if (!row?.email) return;
    const created = new Date(typeof row.createdAt === 'number' ? row.createdAt : String(row.createdAt)).getTime();
    if (Number.isFinite(created) && now().getTime() - created > NEW_ACCOUNT_MS) return;
    const deliveryId = claim(userId);
    if (!deliveryId) return;
    const outcome = await send!(row.email, renderWelcome({ name: firstNameOf(row.name, row.email) }), deliveryId).catch(() => 'unknown' as const);
    if (outcome === 'sent') mark.run('sent', now().toISOString(), userId);
    else if (outcome === 'unknown') mark.run('unknown', now().toISOString(), userId);
    else release.run(userId);
    log(`welcome email ${outcome}`);
  }

  return {
    afterSignIn(userId) {
      if (!send) return;
      const p = Promise.resolve()
        .then(() => welcome(userId))
        .catch((cause: unknown) => log(`welcome email failed: ${String(cause).slice(0, 120)}`))
        .finally(() => inFlight.delete(p));
      inFlight.add(p);
    },
    async settled() {
      await Promise.all([...inFlight]);
    },
    forget(userId) {
      release.run(userId);
    },
  };
}
