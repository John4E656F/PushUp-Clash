# PushupClash 💪🔥

AI-powered pushup counter with daily challenges, head-to-head battles, leaderboards, and streaks. Position your phone *anywhere* — PushupClash uses on-device pose estimation to count your reps from any angle.

## What it does

- **AI rep counting** — On-device pose detection tracks your body's keypoints and counts reps using elbow/shoulder joint angles, so the camera can sit on the floor, lean against a wall, or be propped at any angle.
- **Daily challenges** — A fresh target every day to keep the streak alive.
- **Battles** — Challenge another user to a head-to-head pushup duel.
- **Leaderboard** — Global and friends rankings.
- **Streaks & gamification** — XP, levels, badges, and streak tracking.

## Stack

| Layer | Tech |
|-------|------|
| Mobile app | [Expo](https://expo.dev) SDK 56 (React 19, RN 0.85, expo-router, TS), via **pnpm** |
| Pose / rep counting | `react-native-vision-camera` + `react-native-fast-tflite` running **MoveNet** on-device |
| Backend API | [Go](https://go.dev) (chi router) |
| Auth | [Clerk](https://clerk.com) |
| Database | [MongoDB](https://www.mongodb.com) |
| Media storage (workout clips/avatars) | [Backblaze B2](https://www.backblaze.com/cloud-storage) (S3-compatible) |

## Repo layout

```
PushUp-Clash/
├── mobile/      # Expo app (the phone client)
├── backend/     # Go API server
├── docker-compose.yml  # local MongoDB
└── README.md
```

See [`mobile/README.md`](mobile/README.md) and [`backend/README.md`](backend/README.md) for per-package setup.

## Quick start

### 1. Backend

```bash
cd backend
cp .env.example .env        # fill in Clerk / Mongo / Backblaze creds
docker compose up -d mongo  # or point MONGO_URI at Atlas
go run ./cmd/server
```

API comes up on `http://localhost:8080`. Health check: `GET /healthz`.

### 2. Mobile

```bash
cd mobile
cp .env.example .env        # set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY + API_URL
pnpm install
pnpm ios   # or: pnpm android
```

> Pose detection uses native camera modules + a bundled TFLite model, so you need a
> **development build** (`pnpm ios` / `pnpm android`, or an EAS dev build) — it won't
> run in Expo Go. See `mobile/README.md`.

## How rep counting works (any camera angle)

The counter never relies on the user's absolute position in frame. Instead it:

1. **MoveNet** (bundled TFLite model) runs per frame on-device to get body
   keypoints (shoulders, elbows, wrists, hips).
2. Computes the **elbow joint angle** (shoulder→elbow→wrist).
3. Runs a small state machine: a rep is counted on a full `up → down → up`
   transition, with smoothing + hysteresis + debounce to reject jitter.

Because angles are rotation/translation invariant, it works whether the phone is
on the floor pointed up, on a desk side-on, or held overhead. See
[`mobile/src/pose/pushupCounter.ts`](mobile/src/pose/pushupCounter.ts) and the
camera wiring in [`mobile/app/(tabs)/workout.tsx`](mobile/app/%28tabs%29/workout.tsx).

## Status

Verified so far:
- ✅ Backend builds and runs live against MongoDB (auth + indexes + routing confirmed)
- ✅ Mobile bundles through Metro (incl. the TFLite model asset), typechecks, and
  the rep-counter / pose-mapping unit tests pass (13/13)
- ✅ **AI rep counting validated against real pushup video** — the bundled MoveNet
  model + counting logic were run end-to-end on real footage (see
  [`tools/pose-eval`](tools/pose-eval)); this is what drove the adaptive,
  per-user threshold design
- 🔭 The on-device camera + live frame processor still needs a real device via a
  development build (a camera can't run in a headless/CI container)
