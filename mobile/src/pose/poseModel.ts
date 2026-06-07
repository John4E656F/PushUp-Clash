import type { Pose } from './types';

/**
 * PoseModel is the seam between the camera frame processor and a real pose
 * estimation model. Keeping it an interface means the rep counter and UI never
 * depend on which model ships.
 *
 * INTEGRATION (the one remaining native piece):
 *   1. Add a model with `react-native-fast-tflite`:
 *        const model = useTensorflowModel(require('../../assets/movenet.tflite'))
 *   2. In the vision-camera frame processor, resize the frame to the model's
 *      input (e.g. 192x192) with `vision-camera-resize-plugin`, run the model,
 *      and map its 17-keypoint output into the `Pose` shape below.
 *   3. MoveNet/BlazePose output keypoints in [0,1] already — wire indices to the
 *      named joints in `KeypointName`.
 *
 * Until that's wired, `mapMoveNetOutput` documents the exact mapping, and the
 * UI surfaces a "model not loaded" state rather than guessing.
 */
export interface PoseModel {
  /** Run inference on a single frame, returning detected keypoints. */
  estimate(frame: unknown): Pose;
  readonly ready: boolean;
}

// MoveNet SinglePose outputs 17 keypoints as [y, x, score] rows. These are the
// COCO indices for the joints PushupClash needs.
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
 * Pure + tested-able; call this from inside the frame processor once you have
 * the model tensor as a JS array.
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
