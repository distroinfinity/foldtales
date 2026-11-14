export type SendCode = (email: string, code: string) => Promise<void>;

export interface EmailConfig {
  resendKey: string | undefined;
  from: string;
  dev: boolean;
  log: (message: string) => void;
}

/** Email codes go out through Resend. Without a key, dev prints the code, and production refuses to send. */
export function codeSender({ resendKey, from, dev, log }: EmailConfig): SendCode {
  if (!resendKey) {
    return async (email, code) => {
      if (!dev) throw new Error('email sign-in needs RESEND_API_KEY');
      log(`[dev] sign-in code for ${email}: ${code}`);
    };
  }
  return async (email, code) => {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${resendKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [email],
        subject: `${code} is your Tabletop Theater code`,
        text: `Your code to sign in to Tabletop Theater is ${code}.\n\nIt lasts 10 minutes. If you didn't ask for it, you can ignore this email.`,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`Resend answered ${response.status}`);
  };
}
