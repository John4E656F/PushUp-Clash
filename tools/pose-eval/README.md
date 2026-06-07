# Pose-eval — offline rep-counter validation

Validates the PushupClash pose pipeline **without a device** by running the exact
bundled MoveNet model over a real pushup video and applying the same counting
logic as the app.

```bash
pip install -r tools/pose-eval/requirements.txt
# from the repo root, so the model path resolves:
python tools/pose-eval/evaluate.py /path/to/pushups.mp4
```

Example output:

```
video      : 434 frames @ 25fps (17.4s)
detection  : 210/217 inferred frames (97%)
angle range: 58..146 deg
angle wave : 97 91 72 ... 146 128 112 ...
REPS       : 5
```

## Why this exists

The app's rep counting can't run in CI / a headless container (it needs a camera
+ native frame processors). This harness exercises the two parts that *can* be
checked off-device:

1. the bundled `movenet-lightning.tflite` model actually loads and produces
   sensible keypoints on real frames, and
2. the median-filter + EMA + **windowed adaptive threshold** counting logic
   (ported 1:1 from `mobile/src/pose/pushupCounter.ts`) counts real reps.

## Findings that shaped the algorithm

Running this against real footage is what drove the counter design:

- **Fixed angle thresholds don't generalize.** Real athletes top out anywhere from
  ~115° to ~170° at the top of a pushup, and MoveNet under-reports extension. A
  fixed `up>=160°` rule counted **0** reps on clips where the person was clearly
  doing pushups. → switched to thresholds relative to the user's own recent
  min/max range.
- **Raw keypoints spike.** Single-frame collapses (e.g. a bogus 5° elbow) need a
  median pre-filter before smoothing.
- **Framing matters.** Letterbox-padding to square detects the person far more
  reliably than an aggressive center-crop on landscape footage.

Keep the constants in `evaluate.py` in sync with `PushupCounter` defaults.
