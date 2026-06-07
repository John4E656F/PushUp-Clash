import type { Keypoint, Pose } from './types';

/**
 * PushupCounter is a pure state machine that turns a stream of poses into a rep
 * count. It is intentionally free of any React/camera dependency so it can be
 * unit tested and reused.
 *
 * Why angles? The elbow joint angle (shoulder→elbow→wrist) is invariant to where
 * the phone sits or how the body is translated/rotated in frame. That's what lets
 * PushupClash count reps from "any camera position". A rep is a full
 * up → down → up transition, gated with hysteresis to reject jitter.
 */

export interface PushupCounterOptions {
  /** Elbow angle (deg) at/above which the arms count as "extended" (up). */
  upAngle?: number;
  /** Elbow angle (deg) at/below which the arms count as "flexed" (down). */
  downAngle?: number;
  /** Minimum keypoint confidence to trust a frame. */
  minScore?: number;
  /** Minimum ms between counted reps (debounce against impossibly fast reps). */
  minRepIntervalMs?: number;
}

export type PushupPhase = 'up' | 'down' | 'unknown';

export interface PushupState {
  reps: number;
  phase: PushupPhase;
  /** Smoothed elbow angle in degrees, or null when not enough signal. */
  angle: number | null;
  /** Whether the most recent frame had a usable pose. */
  tracking: boolean;
}

const DEFAULTS: Required<PushupCounterOptions> = {
  upAngle: 160,
  downAngle: 90,
  minScore: 0.3,
  minRepIntervalMs: 350,
};

/** Interior angle at point B (in degrees) formed by segments BA and BC. */
export function angleDeg(a: Keypoint, b: Keypoint, c: Keypoint): number {
  const abx = a.x - b.x;
  const aby = a.y - b.y;
  const cbx = c.x - b.x;
  const cby = c.y - b.y;
  const dot = abx * cbx + aby * cby;
  const magAB = Math.hypot(abx, aby);
  const magCB = Math.hypot(cbx, cby);
  if (magAB === 0 || magCB === 0) return NaN;
  const cos = Math.min(1, Math.max(-1, dot / (magAB * magCB)));
  return (Math.acos(cos) * 180) / Math.PI;
}

/**
 * Best available elbow angle from a pose. Prefers the side whose joints are most
 * confident; returns null if neither side clears `minScore`.
 */
export function elbowAngle(pose: Pose, minScore: number): number | null {
  const sides: Array<[Keypoint?, Keypoint?, Keypoint?]> = [
    [pose.leftShoulder, pose.leftElbow, pose.leftWrist],
    [pose.rightShoulder, pose.rightElbow, pose.rightWrist],
  ];

  let best: { angle: number; score: number } | null = null;
  for (const [s, e, w] of sides) {
    if (!s || !e || !w) continue;
    const score = Math.min(s.score, e.score, w.score);
    if (score < minScore) continue;
    const a = angleDeg(s, e, w);
    if (Number.isNaN(a)) continue;
    if (!best || score > best.score) best = { angle: a, score };
  }
  return best ? best.angle : null;
}

export class PushupCounter {
  private opts: Required<PushupCounterOptions>;
  private smoothedAngle: number | null = null;
  private phase: PushupPhase = 'unknown';
  private reps = 0;
  private lastRepAt = 0;
  /** Set true once we've seen a valid "down" since the last counted rep. */
  private wentDown = false;

  constructor(options: PushupCounterOptions = {}) {
    this.opts = { ...DEFAULTS, ...options };
  }

  /** Exponential moving average to damp per-frame jitter. */
  private smooth(angle: number): number {
    const alpha = 0.5;
    this.smoothedAngle =
      this.smoothedAngle == null ? angle : alpha * angle + (1 - alpha) * this.smoothedAngle;
    return this.smoothedAngle;
  }

  /**
   * Feed one pose. `nowMs` lets tests inject deterministic time; defaults to
   * Date.now(). Returns the current state snapshot.
   */
  update(pose: Pose, nowMs: number = Date.now()): PushupState {
    const raw = elbowAngle(pose, this.opts.minScore);
    if (raw == null) {
      return { reps: this.reps, phase: this.phase, angle: this.smoothedAngle, tracking: false };
    }

    const angle = this.smooth(raw);

    if (angle <= this.opts.downAngle) {
      this.phase = 'down';
      this.wentDown = true;
    } else if (angle >= this.opts.upAngle) {
      // Coming back up after a valid down => one rep.
      if (this.phase === 'down' && this.wentDown && nowMs - this.lastRepAt >= this.opts.minRepIntervalMs) {
        this.reps += 1;
        this.lastRepAt = nowMs;
        this.wentDown = false;
      }
      this.phase = 'up';
    }
    // Between thresholds: keep current phase (hysteresis).

    return { reps: this.reps, phase: this.phase, angle, tracking: true };
  }

  get count(): number {
    return this.reps;
  }

  reset(): void {
    this.smoothedAngle = null;
    this.phase = 'unknown';
    this.reps = 0;
    this.lastRepAt = 0;
    this.wentDown = false;
  }
}
