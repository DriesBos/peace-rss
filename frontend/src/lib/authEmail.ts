import 'server-only';

import { Resend } from 'resend';

let resend: Resend | null = null;

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  resend ??= new Resend(process.env.RESEND_API_KEY);
  return resend;
}

function fromAddress(): string {
  return process.env.AUTH_EMAIL_FROM || 'Komorebi Reader <no-reply@komorebi-reader.com>';
}

async function send(to: string, subject: string, text: string) {
  const client = getResend();
  if (!client) {
    // Local development without Resend: log the link instead of sending.
    console.warn(`[auth email] RESEND_API_KEY not set. To: ${to}\n${subject}\n${text}`);
    return;
  }

  const { error } = await client.emails.send({
    from: fromAddress(),
    to,
    subject,
    text,
  });
  if (error) {
    console.error('[auth email] Resend error:', error);
    throw new Error('Failed to send email');
  }
}

export function sendVerificationEmail(to: string, url: string) {
  return send(
    to,
    'Confirm your email for Komorebi',
    `Welcome to Komorebi.\n\nConfirm your email address to start reading:\n${url}\n\nIf you did not sign up, you can ignore this email.`,
  );
}

export function sendPasswordResetEmail(to: string, url: string) {
  return send(
    to,
    'Reset your Komorebi password',
    `Someone asked to reset the password for this Komorebi account.\n\nChoose a new password here (the link expires in 1 hour):\n${url}\n\nIf this was not you, you can ignore this email.`,
  );
}
