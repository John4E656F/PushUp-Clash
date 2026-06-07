import { useCallback, useMemo, useRef, useState } from 'react';
import { PushupCounter, type PushupState } from './pushupCounter';
import type { Pose } from './types';

/**
 * usePushupCounter owns a PushupCounter instance and exposes reactive state for
 * the workout screen. Feed it poses from the camera frame processor via
 * `onPose`; call `reset` to start a new set.
 *
 * The frame processor runs on a worklet thread, so `onPose` is designed to be
 * cheap and is throttled to a UI-state cadence to avoid re-render storms.
 */
export function usePushupCounter() {
  const counter = useMemo(() => new PushupCounter(), []);
  const [state, setState] = useState<PushupState>({
    reps: 0,
    phase: 'unknown',
    angle: null,
    tracking: false,
  });
  const lastEmit = useRef(0);

  const onPose = useCallback(
    (pose: Pose, nowMs: number = Date.now()) => {
      const next = counter.update(pose, nowMs);
      // Push to React state at ~15fps max; the counter itself updates every frame.
      if (nowMs - lastEmit.current >= 66) {
        lastEmit.current = nowMs;
        setState(next);
      }
    },
    [counter],
  );

  const reset = useCallback(() => {
    counter.reset();
    setState({ reps: 0, phase: 'unknown', angle: null, tracking: false });
  }, [counter]);

  return { state, onPose, reset };
}
