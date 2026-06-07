import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Camera,
  runAtTargetFps,
  useCameraDevice,
  useCameraPermission,
  useFrameProcessor,
} from 'react-native-vision-camera';
import { useResizePlugin } from 'vision-camera-resize-plugin';
import { useTensorflowModel } from 'react-native-fast-tflite';
import { Worklets } from 'react-native-worklets-core';
import { useApi } from '@/api/useApi';
import { Button } from '@/components/ui';
import { usePushupCounter } from '@/pose/usePushupCounter';
import { MODEL_INPUT_SIZE, MOVENET_MODEL, mapMoveNetOutput } from '@/pose/poseModel';
import { colors, radius, spacing } from '@/theme/theme';

export default function Workout() {
  const api = useApi();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('front');
  const { state, onPose, reset } = usePushupCounter();

  // On-device pose model + frame resizer.
  const { model, state: modelState } = useTensorflowModel(MOVENET_MODEL, []);
  const { resize } = useResizePlugin();

  const [active, setActive] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const startedAt = useRef<number>(0);
  const activeRef = useRef(false);

  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission, requestPermission]);

  // Marshal model output from the frame thread back to JS, then count the rep.
  const onKeypoints = useCallback(
    (keypoints: number[]) => {
      if (!activeRef.current) return;
      onPose(mapMoveNetOutput(keypoints));
    },
    [onPose],
  );
  const runOnJs = useMemo(() => Worklets.createRunOnJS(onKeypoints), [onKeypoints]);

  const frameProcessor = useFrameProcessor(
    (frame) => {
      'worklet';
      if (model == null) return;
      // Cap inference to ~12fps — plenty for pushup cadence and easy on battery.
      runAtTargetFps(12, () => {
        'worklet';
        // Center-crop + resize to the model's square uint8 RGB input.
        const resized = resize(frame, {
          scale: { width: MODEL_INPUT_SIZE, height: MODEL_INPUT_SIZE },
          pixelFormat: 'rgb',
          dataType: 'uint8',
        });
        const outputs = model.runSync([resized.buffer as ArrayBuffer]);
        const out = new Float32Array(outputs[0]);
        // Copy out of the worklet as a plain array before hopping to JS.
        const flat: number[] = [];
        for (let i = 0; i < out.length; i++) flat.push(out[i]);
        runOnJs(flat);
      });
    },
    [model, resize, runOnJs],
  );

  function start() {
    reset();
    startedAt.current = Date.now();
    activeRef.current = true;
    setActive(true);
  }

  async function finish() {
    activeRef.current = false;
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
        pixelFormat="yuv"
      />

      {/* HUD overlay */}
      <View style={[styles.hud, { paddingTop: insets.top + spacing.md }]} pointerEvents="box-none">
        <View style={styles.repBadge}>
          <Text style={styles.repCount}>{state.reps}</Text>
          <Text style={styles.repLabel}>REPS</Text>
        </View>

        <View style={styles.statusRow}>
          <Text style={[styles.status, { color: state.tracking ? colors.accent : colors.warning }]}>
            {modelState !== 'loaded'
              ? 'Loading AI model…'
              : state.tracking
                ? `Tracking · ${state.phase.toUpperCase()}`
                : 'Position yourself in frame'}
          </Text>
          {state.angle != null && <Text style={styles.dim}>elbow {Math.round(state.angle)}°</Text>}
        </View>

        <Text style={styles.hint}>
          Tip: place the phone anywhere with your whole upper body visible — the AI counts by joint
          angle, not position.
        </Text>
      </View>

      <View style={[styles.controls, { paddingBottom: insets.bottom + spacing.md }]}>
        {!active ? (
          <Button title="Start set 💪" onPress={start} disabled={modelState !== 'loaded'} />
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
