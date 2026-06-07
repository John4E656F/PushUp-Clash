import { PushupCounter, angleDeg, elbowAngle } from './pushupCounter';
import { mapMoveNetOutput, MOVENET_INDEX } from './movenet';
import type { Pose } from './types';

const kp = (x: number, y: number, score = 1) => ({ x, y, score });

// Build a pose with a given left-elbow angle by placing the wrist relative to
// the elbow. Shoulder is straight above the elbow; angle is controlled by the
// wrist position. We just hand-craft a few canonical poses instead.
function poseWithAngle(deg: number): Pose {
  // shoulder at origin-ish, elbow below it, wrist swings to set the angle.
  const shoulder = kp(0.5, 0.2);
  const elbow = kp(0.5, 0.5);
  // vector elbow->shoulder points up (0,-1). Rotate by `deg` to get elbow->wrist.
  const rad = (deg * Math.PI) / 180;
  const dirX = Math.sin(rad);
  const dirY = -Math.cos(rad);
  const wrist = kp(0.5 + dirX * 0.3, 0.5 + dirY * 0.3);
  return { leftShoulder: shoulder, leftElbow: elbow, leftWrist: wrist };
}

describe('angleDeg', () => {
  it('measures a right angle', () => {
    expect(angleDeg(kp(0, 1), kp(0, 0), kp(1, 0))).toBeCloseTo(90, 1);
  });
  it('measures a straight angle', () => {
    expect(angleDeg(kp(0, 1), kp(0, 0), kp(0, -1))).toBeCloseTo(180, 1);
  });
});

describe('elbowAngle', () => {
  it('returns null when confidence is too low', () => {
    const pose: Pose = {
      leftShoulder: kp(0.5, 0.2, 0.1),
      leftElbow: kp(0.5, 0.5, 0.1),
      leftWrist: kp(0.7, 0.5, 0.1),
    };
    expect(elbowAngle(pose, 0.3)).toBeNull();
  });
  it('reads the crafted angle', () => {
    expect(elbowAngle(poseWithAngle(90), 0.3)).toBeCloseTo(90, 0);
  });
});

describe('mapMoveNetOutput', () => {
  it('maps [y,x,score] rows to named keypoints', () => {
    // 17 keypoints * 3. Seed each value so we can assert the mapping math.
    const out = new Array(17 * 3).fill(0);
    const idx = MOVENET_INDEX.leftElbow; // 7
    out[idx * 3] = 0.4; // y
    out[idx * 3 + 1] = 0.6; // x
    out[idx * 3 + 2] = 0.9; // score
    const pose = mapMoveNetOutput(out);
    expect(pose.leftElbow).toEqual({ x: 0.6, y: 0.4, score: 0.9 });
  });

  it('feeds a real pose into the counter end to end', () => {
    // A flat output with a ~90° left elbow should be readable by the counter.
    const out = new Array(17 * 3).fill(0);
    const set = (i: number, y: number, x: number, s = 1) => {
      out[i * 3] = y;
      out[i * 3 + 1] = x;
      out[i * 3 + 2] = s;
    };
    set(MOVENET_INDEX.leftShoulder, 0.2, 0.5);
    set(MOVENET_INDEX.leftElbow, 0.5, 0.5);
    set(MOVENET_INDEX.leftWrist, 0.5, 0.8);
    const pose = mapMoveNetOutput(out);
    const c = new PushupCounter();
    const s = c.update(pose, 0);
    expect(s.tracking).toBe(true);
    expect(Math.round(s.angle ?? 0)).toBe(90);
  });
});

describe('PushupCounter', () => {
  // A real pose model emits many frames per phase (~30fps); the counter smooths
  // them. This helper mimics that by feeding several frames at one angle.
  let clock = 0;
  function feed(c: PushupCounter, deg: number, frames = 6, stepMs = 33) {
    let s = c.update(poseWithAngle(deg), (clock += stepMs));
    for (let i = 1; i < frames; i++) s = c.update(poseWithAngle(deg), (clock += stepMs));
    return s;
  }
  beforeEach(() => {
    clock = 0;
  });

  it('counts a full up→down→up cycle as one rep', () => {
    const c = new PushupCounter();
    feed(c, 170); // up (arms extended)
    feed(c, 80); // down
    const s = feed(c, 170); // back up
    expect(s.reps).toBe(1);
    expect(s.phase).toBe('up');
  });

  it('does not count a down without a return to up', () => {
    const c = new PushupCounter();
    feed(c, 170);
    const s = feed(c, 80);
    expect(s.reps).toBe(0);
  });

  it('counts multiple reps', () => {
    const c = new PushupCounter();
    for (let i = 0; i < 3; i++) {
      feed(c, 170);
      feed(c, 80);
    }
    const s = feed(c, 170);
    expect(s.reps).toBe(3);
  });

  it('debounces impossibly fast reps', () => {
    const c = new PushupCounter({ minRepIntervalMs: 1000 });
    feed(c, 170, 2, 5);
    feed(c, 80, 2, 5);
    const s = feed(c, 170, 2, 5); // full cycle, but within the debounce window
    expect(s.reps).toBe(0);
  });

  it('reports not tracking when the pose is missing', () => {
    const c = new PushupCounter();
    const s = c.update({}, 0);
    expect(s.tracking).toBe(false);
  });

  it('counts a shallow athlete whose "up" never reaches 160° (adaptive thresholds)', () => {
    // Validated against real MoveNet footage: many people top out ~115-120°, not
    // 160°. Fixed absolute thresholds would count ZERO here; relative ones work.
    const c = new PushupCounter();
    for (let i = 0; i < 4; i++) {
      feed(c, 120); // "up" — arms not fully locked out
      feed(c, 70); // "down"
    }
    const s = feed(c, 120);
    expect(s.reps).toBe(4);
  });

  it('stays in calibration until enough range of motion is seen', () => {
    const c = new PushupCounter();
    // Tiny wobble (~4° range) should never trip a rep or leave calibration.
    for (let i = 0; i < 6; i++) {
      const s1 = feed(c, 150);
      const s2 = feed(c, 146);
      expect(s1.reps).toBe(0);
      expect(s2.calibrating).toBe(true);
    }
  });
});
