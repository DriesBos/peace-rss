'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/Button/Button';
import KomorebiShader from '@/components/KomorebiShader/KomorebiShader';
import { LabeledInput } from '@/components/LabeledInput/LabeledInput';
import { authClient } from '@/lib/authClient';
import styles from './LandingPage.module.sass';

type Mode = 'intro' | 'sign-in' | 'sign-up' | 'forgot' | 'reset' | 'check-email';

export function LandingPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('intro');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Links from emails land here: /?mode=reset&token=... or /?error=...
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const linkError = params.get('error');
    if (params.get('mode') === 'reset' && token) {
      setResetToken(token);
      setMode('reset');
    } else if (linkError) {
      setMode('sign-in');
      setError(
        linkError === 'INVALID_TOKEN' || linkError === 'TOKEN_EXPIRED'
          ? 'That link has expired. Request a new one.'
          : 'Something went wrong with that link.',
      );
    }
    if (token || linkError) {
      window.history.replaceState(null, '', '/');
    }
  }, []);

  function go(next: Mode) {
    setMode(next);
    setError(null);
    setMessage(null);
    setPassword('');
  }

  async function run(action: () => Promise<{ error: { message?: string; code?: string } | null }>) {
    setPending(true);
    setError(null);
    try {
      const { error: authError } = await action();
      if (authError) {
        setError(
          authError.code === 'EMAIL_NOT_VERIFIED'
            ? 'Confirm your email first. We just sent you a new link.'
            : (authError.message ?? 'Something went wrong.'),
        );
        return false;
      }
      return true;
    } catch {
      setError('Something went wrong. Try again.');
      return false;
    } finally {
      setPending(false);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;

    if (mode === 'sign-in') {
      const ok = await run(() =>
        authClient.signIn.email({ email, password, rememberMe: true }),
      );
      if (ok) router.refresh();
    } else if (mode === 'sign-up') {
      const ok = await run(() =>
        authClient.signUp.email({
          email,
          password,
          name: name.trim() || email.split('@')[0],
          callbackURL: '/',
        }),
      );
      if (ok) {
        go('check-email');
        setMessage(`We sent a confirmation link to ${email}.`);
      }
    } else if (mode === 'forgot') {
      const ok = await run(() =>
        authClient.requestPasswordReset({ email, redirectTo: '/?mode=reset' }),
      );
      if (ok) {
        go('check-email');
        setMessage(`If ${email} has an account, a reset link is on its way.`);
      }
    } else if (mode === 'reset' && resetToken) {
      const ok = await run(() =>
        authClient.resetPassword({ newPassword: password, token: resetToken }),
      );
      if (ok) {
        go('sign-in');
        setMessage('Password updated. Sign in with your new password.');
      }
    }
  }

  const submitLabel: Record<Mode, string> = {
    intro: '',
    'sign-in': 'Sign in',
    'sign-up': 'Create account',
    forgot: 'Send reset link',
    reset: 'Save new password',
    'check-email': '',
  };

  return (
    <>
      <KomorebiShader opacity={0.1} />
      <div className={styles.landingPage}>
        <div className={styles.content}>
          <div className={styles.intro}>
            <h1 className={styles.soulSister}>Komorebi</h1>
            <p>Enjoy your reading</p>
          </div>

          {mode === 'intro' && (
            <ul className={styles.buttons}>
              <li>
                <Button variant="primary" onClick={() => go('sign-in')}>
                  <span>Sign in</span>
                </Button>
              </li>
              <li>/</li>
              <li>
                <Button variant="primary" onClick={() => go('sign-up')}>
                  <span>Sign up</span>
                </Button>
              </li>
            </ul>
          )}

          {mode === 'check-email' && (
            <div className={styles.form}>
              {message && <p className={styles.message}>{message}</p>}
              <p className={styles.hint}>Open the link in the email to continue.</p>
              <ul className={styles.links}>
                <li>
                  <Button variant="primary" onClick={() => go('sign-in')}>
                    <span>Back to sign in</span>
                  </Button>
                </li>
              </ul>
            </div>
          )}

          {mode !== 'intro' && mode !== 'check-email' && (
            <form className={styles.form} onSubmit={handleSubmit} noValidate>
              {mode === 'sign-up' && (
                <LabeledInput
                  id="auth-name"
                  label="Name"
                  value={name}
                  onChange={setName}
                  disabled={pending}
                  placeholder="Optional"
                />
              )}
              {mode !== 'reset' && (
                <LabeledInput
                  id="auth-email"
                  label="Email"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  disabled={pending}
                />
              )}
              {mode !== 'forgot' && (
                <LabeledInput
                  id="auth-password"
                  label={mode === 'reset' ? 'New password' : 'Password'}
                  type="password"
                  value={password}
                  onChange={setPassword}
                  disabled={pending}
                />
              )}

              {message && <p className={styles.message}>{message}</p>}
              {error && (
                <p className={styles.error} role="alert">
                  {error}
                </p>
              )}

              <ul className={styles.links}>
                <li>
                  <Button variant="primary" type="submit" disabled={pending}>
                    <span>{pending ? 'One moment…' : submitLabel[mode]}</span>
                  </Button>
                </li>
              </ul>

              <ul className={styles.secondary}>
                {mode === 'sign-in' && (
                  <>
                    <li>
                      <button type="button" onClick={() => go('forgot')}>
                        Forgot password?
                      </button>
                    </li>
                    <li>
                      <button type="button" onClick={() => go('sign-up')}>
                        Create an account
                      </button>
                    </li>
                  </>
                )}
                {mode !== 'sign-in' && (
                  <li>
                    <button type="button" onClick={() => go('sign-in')}>
                      Back to sign in
                    </button>
                  </li>
                )}
              </ul>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
