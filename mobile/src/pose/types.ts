// Pose representation shared by the model adapter and the rep counter.

/** Named keypoints we care about for pushups (subset of COCO/BlazePose). */
export type KeypointName =
  | 'leftShoulder'
  | 'rightShoulder'
  | 'leftElbow'
  | 'rightElbow'
  | 'leftWrist'
  | 'rightWrist'
  | 'leftHip'
  | 'rightHip';

/** A single detected keypoint in normalized [0,1] image coordinates. */
export interface Keypoint {
  x: number;
  y: number;
  /** Model confidence in [0,1]. */
  score: number;
}

/** A full pose is a partial map — a model may not detect every joint. */
export type Pose = Partial<Record<KeypointName, Keypoint>>;
