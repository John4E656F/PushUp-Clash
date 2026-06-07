import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useFrameProcessor,
} from 'react-native-vision-camera';
import { runOnJS } from 'react-native-reanimated';
import { useApi } from '@/api/useApi';
import { Button } from '@/components/ui';
import { usePushupCounter } from '@/pose/usePushupCounter';
import type { Pose } from '@/pose/types';
import { colors, radius, spacing } from '@/theme/theme';

export default function Workout() {
  const api = useApi();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('front');
  const { state, onPose, reset } = usePushupCounter();

  const [active, setActive] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const startedAt = useRef<number>(0);

  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission, requestPermission]);

  // Bridge worklet -> JS. The pose model runs on the frame thread; we hop back
  // to JS to update the counter/UI.
  const handlePose = useCallback(
    (pose: Pose) => {
      if (active) onPose(pose);
    },
    [active, onPose],
  );

  const frameProcessor = useFrameProcessor(
    (frame) => {
      'worklet';
      // === POSE MODEL INTEGRATION POINT =====================================
      // 1. Resize `frame` to the model input (e.g. 192x192) with a resize plugin.
      // 2. Run the tflite MoveNet/BlazePose model on the pixels.
      // 3. Map the 17-keypoint output via mapMoveNetOutput() into a Pose.
      // 4. runOnJS(handlePose)(pose)
      //
      // Until the native model is bundled, no poses are emitted and the rep
      // count stays at 0 (the UI shows a "model not loaded" hint).
      // Example once wired:
      //   const out = model.runSync([resized])[0];
      //   const pose = mapMoveNetOutput(out);
      //   runOnJS(handlePose)(pose);
      void frame;
      void runOnJS;
    },
    [handlePose],
  );

  function start() {
    reset();
    startedAt.current = Date.now();
    setActive(true);
  }

  async function finish() {
    setActive(false);
    const durationSec = Math.max(1, Math.round((Date.now() - startedAt.current) / 1000));
    if (state.reps <= 0) {
      router.back();
      return;
    }
    setSubmitting(true);
    try {
      await api.createWorkout({ reps: state.reps, durationSec, source: 'free' });
      router.replace('/(tabs)/home');
    } catch (e) {
      console.warn('failed to submit workout', e);
    } finally {
      setSubmitting(false);
    }
  }

  if (!hasPermission) {
    return (
      <View style={styles.center}>
        <Text style={styles.dim}>Camera access is required to count your reps.</Text>
        <Button title="Grant camera access" onPress={requestPermission} />
      </View>
    );
  }

  if (device == null) {
    return (
      <View style={styles.center}>
        <Text style={styles.dim}>No camera device found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        frameProcessor={frameProcessor}
      />

      {/* HUD overlay */}
      <View style={[styles.hud, { paddingTop: insets.top + spacing.md }]} pointerEvents="box-none">
        <View style={styles.repBadge}>
          <Text style={styles.repCount}>{state.reps}</Text>
          <Text style={styles.repLabel}>REPS</Text>
        </View>

        <View style={styles.statusRow}>
          <Text style={[styles.status, { color: state.tracking ? colors.accent : colors.warning }]}>
            {state.tracking ? `Tracking · ${state.phase.toUpperCase()}` : 'Position yourself in frame'}
          </Text>
          {state.angle != null && (
            <Text style={styles.dim}>elbow {Math.round(state.angle)}°</Text>
          )}
        </View>

        {/* Until a pose model is bundled, make the state explicit. */}
        <Text style={styles.hint}>
          Tip: place the phone anywhere with your whole upper body visible — the AI counts by joint
          angle, not position.
        </Text>
      </View>

      <View style={[styles.controls, { paddingBottom: insets.bottom + spacing.md }]}>
        {!active ? (
          <Button title="Start set 💪" onPress={start} />
        ) : (
          <View style={styles.controlRow}>
            <Pressable style={styles.resetBtn} onPress={reset}>
              <Text style={styles.resetText}>Reset</Text>
            </Pressable>
            <View style={{ flex: 1 }}>
              <Button title="Finish & save" onPress={finish} loading={submitting} />
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  dim: { color: colors.textDim, textAlign: 'center' },
  hud: { flex: 1, alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md },
  repBadge: {
    backgroundColor: 'rgba(11,11,18,0.55)',
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
  },
  repCount: { color: colors.text, fontSize: 88, fontWeight: '900', lineHeight: 92 },
  repLabel: { color: colors.accent, fontSize: 14, fontWeight: '800', letterSpacing: 3 },
  statusRow: { alignItems: 'center', gap: 2 },
  status: { fontSize: 16, fontWeight: '700' },
  hint: {
    color: colors.textDim,
    fontSize: 12,
    textAlign: 'center',
    backgroundColor: 'rgba(11,11,18,0.55)',
    padding: spacing.sm,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  controls: { padding: spacing.md },
  controlRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  resetBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
  },
  resetText: { color: colors.textDim, fontWeight: '700' },
});
