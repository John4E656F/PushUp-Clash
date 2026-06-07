# PushupClash — Mobile (Expo)

The PushupClash phone client. Built with Expo Router + TypeScript on **Expo SDK 56**
(React 19, React Native 0.85), Clerk for auth, and `react-native-vision-camera`
for **on-device pushup rep counting** with a bundled MoveNet pose model.

Package manager: **pnpm**.

## Setup

```bash
cp .env.example .env   # set Clerk key + API URL
pnpm install
```

> pnpm note: `.npmrc` sets `node-linker=hoisted` because Metro can't resolve
> pnpm's default symlinked layout. Keep it.

### Running

Pose detection uses native modules (Vision Camera frame processors + a TFLite
model), so the app needs a **development build** — it will **not** run in Expo Go.

```bash
# iOS (Mac + Xcode)
pnpm ios

# Android (Android Studio / SDK)
pnpm android

# or with EAS, no local toolchain needed:
#   npx eas-cli build --profile development --platform android
```

The non-camera screens (auth, home, leaderboard, battles, profile) also load via
`pnpm start` if you just want to click through the UI in a dev build.

## Structure

```
assets/models/movenet-lightning.tflite   bundled MoveNet SinglePose model
app/                     expo-router routes (file-based)
  _layout.tsx            ClerkProvider + auth gate
  index.tsx              redirect based on auth state
  (auth)/sign-in.tsx     Clerk email/password sign-in
  (auth)/sign-up.tsx     Clerk sign-up + email verification
  (tabs)/                main app tabs
    home.tsx             dashboard: streak, today's challenge
    workout.tsx          the AI pushup counter (camera + live inference)
    leaderboard.tsx      global rankings
    battles.tsx          duels
    profile.tsx          stats + sign out
src/
  api/        typed client for the Go backend (auto-attaches Clerk JWT)
  pose/       rep-counting state machine, MoveNet mapping, camera hook
  theme/      colors / spacing
  components/ shared UI
```

## How the AI rep counter works

The pipeline (all on-device, real-time):

1. **Vision Camera** frame processor grabs frames on a worklet thread.
2. **`vision-camera-resize-plugin`** center-crops + resizes each frame to the
   model's `192×192×3` uint8 RGB input.
3. **`react-native-fast-tflite`** runs **MoveNet SinglePose Lightning** (bundled
   at `assets/models/movenet-lightning.tflite`) → 17 keypoints `[y,x,score]`.
4. `src/pose/movenet.ts` maps that output into named joints.
5. `src/pose/pushupCounter.ts` — a pure, unit-tested state machine — counts a rep
   on each `up → down → up` transition of the **elbow joint angle**
   (shoulder→elbow→wrist), with smoothing + hysteresis + debounce.

Because it counts by **joint angle** (rotation/translation invariant), it works
with the phone placed at any angle, as long as your upper body is in frame.

Wiring lives in `app/(tabs)/workout.tsx`. Inference is throttled to ~12fps via
`runAtTargetFps`.

## Tests

```bash
pnpm test        # rep-counter + MoveNet mapping (pure logic, no native deps)
pnpm typecheck   # tsc --noEmit
```

## Native stack notes

- **Vision Camera is pinned to v4** (`react-native-vision-camera@4.7.x`). v5 is a
  Nitro rewrite that dropped the `useFrameProcessor` API the TFLite + resize
  pipeline depends on; the ecosystem hasn't migrated. Everything else is latest.
- Two worklet runtimes are present and both Babel plugins are configured (see
  `babel.config.js`): `react-native-worklets-core` (Vision Camera frame
  processors) and `react-native-worklets` (Reanimated 4). If a native build hits
  a worklets conflict, the fallback is to pin `react-native-reanimated` to v3.
- New Architecture is **required** (fast-tflite v3 is Nitro-based) and enabled in
  `app.json`.
