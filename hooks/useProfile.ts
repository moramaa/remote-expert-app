'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getStoredUserId, getStoredRole, type UserRole } from '@/lib/identity';

type ProfileState =
  | { status: 'loading' }
  | { status: 'ready'; userId: string; role: UserRole }
  | { status: 'missing' };

/**
 * Reads localStorage identity and verifies the profile exists in the DB.
 * Redirects to /onboarding/<role> if no profile is found.
 * Redirects to / if no role is set at all.
 */
export function useProfile(expectedRole?: UserRole): ProfileState {
  const router = useRouter();
  const [state, setState] = useState<ProfileState>({ status: 'loading' });

  useEffect(() => {
    const userId = getStoredUserId();
    const role   = getStoredRole();

    if (!userId || !role) {
      router.replace('/');
      setState({ status: 'missing' });
      return;
    }

    if (expectedRole && role !== expectedRole) {
      router.replace('/');
      setState({ status: 'missing' });
      return;
    }

    // Verify DB profile exists
    fetch(`/api/me?id=${userId}&role=${role}`)
      .then((res) => {
        if (res.ok) {
          setState({ status: 'ready', userId, role });
        } else {
          router.replace(`/onboarding/${role}`);
          setState({ status: 'missing' });
        }
      })
      .catch(() => {
        // Network error — be lenient, allow in (server may be cold)
        setState({ status: 'ready', userId, role });
      });
  }, [router, expectedRole]);

  return state;
}
