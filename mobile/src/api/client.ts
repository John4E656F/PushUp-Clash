// Typed client for the PushupClash Go backend. Every request carries the Clerk
// session JWT so the backend can identify the user.

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';

/** A function that returns the current Clerk session token (or null). */
export type TokenProvider = () => Promise<string | null>;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  getToken: TokenProvider,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new ApiError(res.status, data?.error ?? res.statusText);
  }
  return data as T;
}

// ---- Domain types (mirror backend JSON) ------------------------------------

export interface Me {
  id: string;
  username: string;
  email: string;
  avatarUrl: string;
  xp: number;
  level: number;
  totalReps: number;
  streak: number;
  bestStreak: number;
  badges: string[];
}

export interface Challenge {
  id: string;
  date: string;
  targetReps: number;
  xpReward: number;
}

export interface LeaderboardEntry {
  rank: number;
  username: string;
  avatarUrl: string;
  xp: number;
  level: number;
  streak: number;
  totalReps: number;
}

export interface Battle {
  id: string;
  participants: string[];
  entries: { userId: string; reps: number; submittedAt?: string }[];
  targetReps: number;
  status: 'pending' | 'active' | 'complete';
  winnerId?: string;
}

/** Build an API surface bound to a token provider (typically Clerk's getToken). */
export function createApi(getToken: TokenProvider) {
  return {
    syncUser: (profile: { username: string; email: string; avatarUrl: string }) =>
      request<Me>(getToken, 'POST', '/v1/users/sync', profile),

    me: () => request<Me>(getToken, 'GET', '/v1/users/me'),

    createWorkout: (w: { reps: number; durationSec: number; source?: string; clipUrl?: string }) =>
      request<{ xp: number; level: number; streak: number; xpToNextLevel: number }>(
        getToken,
        'POST',
        '/v1/workouts',
        w,
      ),

    listWorkouts: () =>
      request<{ workouts: { id: string; reps: number; durationSec: number; createdAt: string }[] }>(
        getToken,
        'GET',
        '/v1/workouts',
      ),

    todayChallenge: () =>
      request<{ challenge: Challenge; completed: boolean }>(getToken, 'GET', '/v1/challenges/today'),

    completeChallenge: (w: { reps: number; durationSec: number }) =>
      request<{ xp: number; level: number; streak: number; xpEarned: number }>(
        getToken,
        'POST',
        '/v1/challenges/today/complete',
        w,
      ),

    leaderboard: () =>
      request<{ leaderboard: LeaderboardEntry[] }>(getToken, 'GET', '/v1/leaderboard'),

    createBattle: (b: { opponentUserId: string; targetReps: number }) =>
      request<Battle>(getToken, 'POST', '/v1/battles', b),

    listBattles: () => request<{ battles: Battle[] }>(getToken, 'GET', '/v1/battles'),

    submitBattle: (id: string, reps: number) =>
      request<Battle>(getToken, 'POST', `/v1/battles/${id}/submit`, { reps }),

    uploadUrl: (kind: 'clip' | 'avatar', contentType: string, ext: string) =>
      request<{ uploadUrl: string; publicUrl: string; key: string }>(
        getToken,
        'POST',
        '/v1/media/upload-url',
        { kind, contentType, ext },
      ),
  };
}

export type Api = ReturnType<typeof createApi>;
