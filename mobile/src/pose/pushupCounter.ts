import type { Keypoint, Pose } from './types';

/**
 * PushupCounter is a pure state machine that turns a stream of poses into a rep
 * count. It is intentionally free of any React/camera dependency so it can be
 * unit tested and reused.
 *
 * Why angles? The elbow joint angle (shoulder→elbow→wrist) is invariant to where
 * the phone sits or how the body is translated/rotated in frame. That's what lets
 * PushupClash count reps from "any camera position".
 *
 * Why *adaptive* (relative) thresholds? Validated against real pushup footage run
 * through the bundled MoveNet model: peoples' "arms extended" elbow angle varies a
 * lot (one person locks out near 170°, another tops out around 115°), and the
 * model under-reports extension. Fixed absolute thresholds therefore miss reps.
 * Instead we track the user's *own* recent min/max elbow angle over a short window
 * and trigger on relative excursions within that range. A median pre-filter rejects
 * single-frame keypoint spikes, and a debounce rejects impossibly fast reps.
 */

export interface PushupCounterOptions {
  /** Minimum keypoint confidence to trust a frame. */
  minScore?: number;
  /** Minimum ms between counted reps (debounce against impossibly fast reps). */
  minRepIntervalMs?: number;
  /** Window (ms) over which the user's min/max elbow angle is tracked. */
  rangeWindowMs?: number;
  /** Minimum observed angle range (deg) before reps can be counted (calibration). */
  minRangeDeg?: number;
  /** Fraction of the range at/below which arms count as "flexed" (down). */
  downRatio?: number;
  /** Fraction of the range at/above which arms count as "extended" (up). */
  upRatio?: number;
  /** Number of raw samples in the median spike-rejection filter. */
  medianWindow?: number;
  /** EMA smoothing factor in [0,1]; higher = less smoothing. */
  smoothingAlpha?: number;
}

export type PushupPhase = 'up' | 'down' | 'unknown';

export interface PushupState {
  reps: number;
  phase: PushupPhase;
  /** Smoothed elbow angle in degrees, or null when not enough signal. */
  angle: number | null;
  /** Whether the most recent frame had a usable pose. */
  tracking: boolean;
  /** True while still learning the user's range of motion (no reps counted yet). */
  calibrating: boolean;
}

const DEFAULTS: Required<PushupCounterOptions> = {
  minScore: 0.3,
  minRepIntervalMs: 350,
  rangeWindowMs: 4000,
  minRangeDeg: 25,
  downRatio: 0.32,
  upRatio: 0.68,
  medianWindow: 5,
  smoothingAlpha: 0.5,
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
  private medianBuf: number[] = [];
  private smoothedAngle: number | null = null;
  private history: Array<{ t: number; v: number }> = [];
  private phase: PushupPhase = 'unknown';
  private reps = 0;
  private lastRepAt = 0;
  /** Set true once we've seen a valid "down" since the last counted rep. */
  private wentDown = false;

  constructor(options: PushupCounterOptions = {}) {
    this.opts = { ...DEFAULTS, ...options };
  }

  /** Median of the last `medianWindow` raw samples — rejects single-frame spikes. */
  private median(angle: number): number {
    this.medianBuf.push(angle);
    if (this.medianBuf.length > this.opts.medianWindow) this.medianBuf.shift();
    const sorted = [...this.medianBuf].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  }

  /** Exponential moving average to damp residual jitter. */
  private smooth(angle: number): number {
    const alpha = this.opts.smoothingAlpha;
    this.smoothedAngle =
      this.smoothedAngle == null ? angle : alpha * angle + (1 - alpha) * this.smoothedAngle;
    return this.smoothedAngle;
  }

  /** Recent [min, max] of the smoothed angle within the range window. */
  private windowRange(nowMs: number): { lo: number; hi: number } {
    const cutoff = nowMs - this.opts.rangeWindowMs;
    while (this.history.length && this.history[0].t < cutoff) this.history.shift();
    let lo = Infinity;
    let hi = -Infinity;
    for (const { v } of this.history) {
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    return { lo, hi };
  }

  /**
   * Feed one pose. `nowMs` lets tests inject deterministic time; defaults to
   * Date.now(). Returns the current state snapshot.
   */
  update(pose: Pose, nowMs: number = Date.now()): PushupState {
    const raw = elbowAngle(pose, this.opts.minScore);
    if (raw == null) {
      return {
        reps: this.reps,
        phase: this.phase,
        angle: this.smoothedAngle,
        tracking: false,
        calibrating: this.history.length === 0,
      };
    }

    const angle = this.smooth(this.median(raw));
    this.history.push({ t: nowMs, v: angle });
    const { lo, hi } = this.windowRange(nowMs);
    const range = hi - lo;

    // Not enough range yet → still calibrating the user's motion; no reps.
    if (range < this.opts.minRangeDeg) {
      return { reps: this.reps, phase: this.phase, angle, tracking: true, calibrating: true };
    }

    const downThreshold = lo + this.opts.downRatio * range;
    const upThreshold = lo + this.opts.upRatio * range;

    if (angle <= downThreshold) {
      this.phase = 'down';
      this.wentDown = true;
    } else if (angle >= upThreshold) {
      // Coming back up after a valid down => one rep.
      if (
        this.phase === 'down' &&
        this.wentDown &&
        nowMs - this.lastRepAt >= this.opts.minRepIntervalMs
      ) {
        this.reps += 1;
        this.lastRepAt = nowMs;
        this.wentDown = false;
      }
      this.phase = 'up';
    }
    // Between thresholds: keep current phase (hysteresis).

    return { reps: this.reps, phase: this.phase, angle, tracking: true, calibrating: false };
  }

  get count(): number {
    return this.reps;
  }

  reset(): void {
    this.medianBuf = [];
    this.smoothedAngle = null;
    this.history = [];
    this.phase = 'unknown';
    this.reps = 0;
    this.lastRepAt = 0;
    this.wentDown = false;
  }
}
