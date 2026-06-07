// Pure MoveNet helpers — no asset/require, so this is safe to unit test.
import type { Pose } from './types';

/** Square input width/height the camera frame is resized to before inference. */
export const MODEL_INPUT_SIZE = 192;

// MoveNet outputs 17 keypoints as [y, x, score] rows. These are the COCO
// indices for the joints PushupClash needs.
export const MOVENET_INDEX = {
  leftShoulder: 5,
  rightShoulder: 6,
  leftElbow: 7,
  rightElbow: 8,
  leftWrist: 9,
  rightWrist: 10,
  leftHip: 11,
  rightHip: 12,
} as const;

/**
 * Map a flat MoveNet output (length 17*3, [y,x,score] rows) into our Pose.
 * Called on the JS thread with the model's output copied out of the
 * frame-processor worklet. x/y are normalized to [0,1] of the square input.
 */
export function mapMoveNetOutput(out: ArrayLike<number>): Pose {
  const pose: Pose = {};
  for (const [name, idx] of Object.entries(MOVENET_INDEX)) {
    const base = idx * 3;
    const y = out[base];
    const x = out[base + 1];
    const score = out[base + 2];
    if (x == null || y == null) continue;
    pose[name as keyof Pose] = { x, y, score: score ?? 0 };
  }
  return pose;
}
