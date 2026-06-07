# PushupClash — Mobile (Expo)

The PushupClash phone client. Built with Expo Router + TypeScript, Clerk for
auth, and `react-native-vision-camera` for on-device pushup rep counting.

## Setup

```bash
cp .env.example .env   # set Clerk key + API URL
npm install
```

### Running

Pose detection relies on native camera modules and a frame processor, so the app
needs a **development build** — it will not run inside Expo Go.

```bash
# iOS (Mac + Xcode)
npx expo run:ios

# Android (Android Studio / SDK)
npx expo run:android
```

The non-camera screens (auth, home, leaderboard, battles, profile) do run in
Expo Go via `npx expo start` if you just want to click around the UI.

## Structure

```
app/                     expo-router routes (file-based)
  _layout.tsx            ClerkProvider + auth gate
  index.tsx              redirect based on auth state
  (auth)/sign-in.tsx     Clerk email/password sign-in
  (auth)/sign-up.tsx     Clerk sign-up
  (tabs)/                main app tabs
    home.tsx             dashboard: streak, today's challenge
    workout.tsx          the AI pushup counter (camera)
    leaderboard.tsx      global rankings
    battles.tsx          duels
    profile.tsx          stats + sign out
src/
  api/        typed client for the Go backend (auto-attaches Clerk JWT)
  pose/       rep-counting state machine + pose types + camera hook
  theme/      colors / spacing
  components/ shared UI
```

## The rep counter

`src/pose/pushupCounter.ts` is a pure, unit-tested state machine. It takes a
stream of normalized pose keypoints and emits rep counts based on **elbow joint
angle** — so it's invariant to where the phone is placed.

`src/pose/usePushupCounter.ts` wires that state machine to the vision-camera
frame processor. The actual pose-model inference (MoveNet / BlazePose via
`react-native-fast-tflite`) is marked with a `TODO` where the model output is
mapped into keypoints — see the comments there for the integration steps.

Run the counter tests with `npm test`.
