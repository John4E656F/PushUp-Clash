/**
 * MoveNet SinglePose (Lightning, int8) pose-estimation model.
 *
 * Input:  1 x 192 x 192 x 3  uint8  (RGB)
 * Output: 1 x 1 x 17 x 3     float32 — 17 keypoints as [y, x, score] rows,
 *         with x/y normalized to [0,1] of the (center-cropped, square) input.
 *
 * The model is bundled as an asset and loaded on-device by
 * react-native-fast-tflite. Because the rep counter works off joint *angles*
 * (see pushupCounter.ts), normalized keypoints are all it needs — which is what
 * lets PushupClash count from any camera position.
 *
 * The pure mapping helpers live in ./movenet so they stay unit-testable without
 * pulling in the binary asset.
 */
export { MODEL_INPUT_SIZE, MOVENET_INDEX, mapMoveNetOutput } from './movenet';

// Bundled model asset (see metro.config.js, which registers the `.tflite` ext).
export const MOVENET_MODEL = require('../../assets/models/movenet-lightning.tflite');
