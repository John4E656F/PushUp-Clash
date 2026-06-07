import { useAuth } from '@clerk/clerk-expo';
import { useMemo } from 'react';
import { createApi, type Api } from './client';

/**
 * useApi returns a backend client bound to the signed-in user's Clerk token.
 * The token is fetched fresh per request so it never goes stale.
 */
export function useApi(): Api {
  const { getToken } = useAuth();
  return useMemo(() => createApi(() => getToken()), [getToken]);
}
