'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/Button/Button';
import { authClient } from '@/lib/authClient';
import styles from './AccountMenu.module.sass';

/** Replaces Clerk's UserButton: shows who is signed in, with a sign-out action. */
export function AccountMenu() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await authClient.signOut();
      // Drop the previous user's cached feeds and entries.
      queryClient.clear();
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className={styles.accountMenu}>
      {session?.user.email && (
        <span className={styles.email}>{session.user.email}</span>
      )}
      <Button
        variant="primary"
        onClick={() => void handleSignOut()}
        disabled={signingOut}
      >
        <span>{signingOut ? 'Signing out…' : 'Sign out'}</span>
      </Button>
    </div>
  );
}
