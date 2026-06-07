#!/usr/bin/env python3
"""
Offline evaluation harness for the PushupClash rep counter.

Runs the *exact* MoveNet model the mobile app bundles
(`mobile/assets/models/movenet-lightning.tflite`) over a real pushup video,
mirrors the TypeScript counter logic (median spike-filter + EMA + windowed
adaptive thresholds), and reports the rep count and the elbow-angle wave.

This is how the rep-counting feature is validated without a device — the RN
native glue (Vision Camera frame processor) still needs an on-device build, but
the model + counting algorithm are exercised end-to-end here.

Usage:
    pip install -r tools/pose-eval/requirements.txt
    python tools/pose-eval/evaluate.py path/to/pushups.mp4

Keep the constants below in sync with mobile/src/pose/pushupCounter.ts.
"""
import math
import sys

import imageio.v2 as iio
import numpy as np
from ai_edge_litert.interpreter import Interpreter
from PIL import Image

MODEL = "mobile/assets/models/movenet-lightning.tflite"
INPUT = 192
# COCO keypoint indices used by the counter (must match src/pose/movenet.ts).
IDX = {"lS": 5, "rS": 6, "lE": 7, "rE": 8, "lW": 9, "rW": 10}

# Counter params — mirror PushupCounter DEFAULTS in pushupCounter.ts.
MIN_SCORE = 0.3
MEDIAN_WINDOW = 5
ALPHA = 0.5
RANGE_WINDOW_MS = 4000
MIN_RANGE_DEG = 25
DOWN_RATIO = 0.32
UP_RATIO = 0.68
MIN_REP_INTERVAL_MS = 350


def make_interpreter():
    it = Interpreter(model_path=MODEL)
    it.allocate_tensors()
    return it, it.get_input_details()[0], it.get_output_details()[0]


def infer(it, inp, out, frame):
    # Letterbox-pad to square so the whole body is preserved, then resize to the
    # model's 192x192 uint8 RGB input. (On a portrait phone the resize-plugin's
    # center-crop is fine; padding is the robust choice for arbitrary footage.)
    h, w, _ = frame.shape
    s = max(h, w)
    canvas = np.zeros((s, s, 3), np.uint8)
    canvas[(s - h) // 2 : (s - h) // 2 + h, (s - w) // 2 : (s - w) // 2 + w] = frame
    img = Image.fromarray(canvas).resize((INPUT, INPUT))
    it.set_tensor(inp["index"], np.expand_dims(np.asarray(img, np.uint8), 0))
    it.invoke()
    return it.get_tensor(out["index"])[0, 0]  # (17, 3) -> [y, x, score]


def angle(a, b, c):
    abx, aby = a[0] - b[0], a[1] - b[1]
    cbx, cby = c[0] - b[0], c[1] - b[1]
    d = abx * cbx + aby * cby
    m1, m2 = math.hypot(abx, aby), math.hypot(cbx, cby)
    if m1 == 0 or m2 == 0:
        return float("nan")
    return math.degrees(math.acos(max(-1, min(1, d / (m1 * m2)))))


def elbow_angle(kp):
    best = None
    for s, e, w in [(IDX["lS"], IDX["lE"], IDX["lW"]), (IDX["rS"], IDX["rE"], IDX["rW"])]:
        sc = min(kp[s][2], kp[e][2], kp[w][2])
        if sc < MIN_SCORE:
            continue
        a = angle(kp[s][:2], kp[e][:2], kp[w][:2])
        if not math.isnan(a) and (best is None or sc > best[1]):
            best = (a, sc)
    return best[0] if best else None


def count_reps(samples, fps):
    """samples: list of (frame_index, raw_elbow_angle | None)."""
    med_buf, sm, hist = [], None, []
    phase, reps, last, seen = "unknown", 0, -1e9, False
    wave = []
    for i, raw in samples:
        if raw is None:
            continue
        med_buf.append(raw)
        med_buf[:] = med_buf[-MEDIAN_WINDOW:]
        med = sorted(med_buf)[len(med_buf) // 2]
        sm = med if sm is None else ALPHA * med + (1 - ALPHA) * sm
        wave.append(sm)
        t = i / fps * 1000
        hist.append((t, sm))
        hist[:] = [(tt, v) for tt, v in hist if t - tt <= RANGE_WINDOW_MS]
        vs = [v for _, v in hist]
        lo, hi = min(vs), max(vs)
        rng = hi - lo
        if rng < MIN_RANGE_DEG:
            continue
        down_t, up_t = lo + DOWN_RATIO * rng, lo + UP_RATIO * rng
        if sm <= down_t:
            phase, seen = "down", True
        elif sm >= up_t:
            if phase == "down" and seen and t - last >= MIN_REP_INTERVAL_MS:
                reps += 1
                last, seen = t, False
            phase = "up"
    return reps, wave


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    path = sys.argv[1]
    it, inp, out = make_interpreter()
    reader = iio.get_reader(path, "ffmpeg")
    fps = reader.get_meta_data().get("fps", 25.0)
    samples, detected, total = [], 0, 0
    for i, frame in enumerate(reader):
        total += 1
        if i % 2:  # ~halve fps to mirror the app's ~12fps throttle
            continue
        a = elbow_angle(infer(it, inp, out, frame))
        samples.append((i, a))
        detected += a is not None

    reps, wave = count_reps(samples, fps)
    print(f"video      : {total} frames @ {fps:.0f}fps ({total / fps:.1f}s)")
    print(f"detection  : {detected}/{len(samples)} inferred frames ({detected / max(1, len(samples)) * 100:.0f}%)")
    if wave:
        step = max(1, len(wave) // 60)
        print(f"angle range: {min(wave):.0f}..{max(wave):.0f} deg")
        print("angle wave :", " ".join(f"{v:.0f}" for v in wave[::step]))
    print(f"REPS       : {reps}")


if __name__ == "__main__":
    main()
