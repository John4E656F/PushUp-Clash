import { PushupCounter, angleDeg, elbowAngle } from './pushupCounter';
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
});
