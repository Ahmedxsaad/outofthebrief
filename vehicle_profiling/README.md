# vehicle_profiling

Offline pipeline that turns raw OOH traffic footage into a fully
annotated demo: every unique vehicle is detected, tracked, identified,
and labelled with **make · model · body type · era · market segment ·
ballpark price**.

It complements the on-Pi live counter
([`pi_vehicle_detection/`](../pi_vehicle_detection)) by adding
segment-aware reporting — *"this billboard was seen by 2 100 economy
cars and 340 luxury SUVs today"* — that no traditional OOH measurement
panel produces.

## Pipeline

```
        ┌────────────────────┐    ┌────────────────────┐    ┌────────────────────┐
mp4  →  │ YOLOv11x detection │ →  │ ByteTrack tracking │ →  │ best-crop selector │
        └────────────────────┘    └────────────────────┘    └─────────┬──────────┘
                                                                       │ one jpg / track-id
                                                                       ▼
        ┌────────────────────┐    ┌────────────────────┐    ┌────────────────────┐
 mp4 ←  │  H.264 re-encode   │ ←  │ overlay renderer   │ ←  │ Gemini Flash Lite  │
        └────────────────────┘    └────────────────────┘    └────────────────────┘
```

1. **Detect + track.** `yolo11x.pt` runs over every frame; ByteTrack
   assigns a persistent ID per vehicle so the same car isn't recounted
   on every frame.
2. **Best-crop selection.** For each track ID, the frame where the
   bounding box has the largest area (= closest to camera, most
   distinguishing features visible) is kept as a JPEG with a 10 %
   context margin.
3. **Profile.** Each best crop is sent to Gemini Flash Lite with a
   structured-output schema — `{make, model_guess, body_type, era,
   segment, estimated_price_usd, confidence}`. Multiple comma-separated
   API keys in `GEMINI_API_KEY` are rotated automatically on rate
   limits.
4. **Render.** A second pass over the video draws colour-coded boxes
   (gold = luxury, magenta = premium, blue = midrange, gray = economy),
   per-vehicle profile labels, and a HUD with live count + cumulative
   unique cars + estimated fleet value. Output is a browser-ready
   H.264 mp4.

## Files

| File | Purpose |
|---|---|
| `detect_cars.py` | YOLOv11 + ByteTrack baseline (boxes + counter only) |
| `profile_cars.py` | Full pipeline (detect → profile → render) |
| `assets/cars.mp4` | Source 23 s, 1920×1080 traffic clip |
| `assets/cars_detected.mp4` | YOLO-only output — boxes + per-frame and unique counts |
| `assets/cars_profiled.mp4` | Full output — make/model/segment/price labels |
| `assets/cars_last10s.mp4` | Trim used for the demo render |
| `assets/cars_last2s.mp4` | Smoke-test trim |

## Usage

```bash
pip install ultralytics opencv-python google-genai pydantic

# YOLO-only (no API key needed)
python detect_cars.py \
    --input  assets/cars.mp4 \
    --output assets/cars_detected.mp4 \
    --device cpu

# Full profiling pipeline
GEMINI_API_KEY="key1,key2,key3" python profile_cars.py \
    --input  assets/cars.mp4 \
    --output assets/cars_profiled.mp4 \
    --device cpu
```

Phase 1 (detection) is the long bit (~22 min for 23 s of 1080p video on
CPU; seconds on a recent GPU). Phase 2 (Gemini) and phase 3 (render)
together take under a minute. Intermediate state — per-frame
detections, best-crop JPEGs, and Gemini responses — is cached under
`.profile_cache/`, so re-running with a tweaked overlay or different
prompt skips straight to the render pass.

## Flags worth knowing

| Flag | Default | Purpose |
|---|---|---|
| `--weights` | `yolo11x.pt` | Any Ultralytics YOLO weight (`yolo11n/s/m/l/x.pt`) |
| `--imgsz` | `960` | Inference resolution (1080p frames are letterboxed) |
| `--conf` | `0.35` | Detection confidence threshold |
| `--gemini-model` | `gemini-3.1-flash-lite-preview` | Vision model for profiling |
| `--min-crop` | `80` | Minimum crop side (px) below which Gemini is skipped |
| `--workers` | `6` | Parallel Gemini calls |
| `--force-detect` | — | Invalidate detection cache |
| `--force-profile` | — | Invalidate Gemini cache |

## Notes

- **Privacy.** This pipeline runs offline on R&D / demo footage. It is
  *not* the production tracker — production runs on-Pi and never
  transmits frames (see [`pi_vehicle_detection/`](../pi_vehicle_detection)).
- **The CTrain.** YOLO occasionally tags Calgary's Siemens S70 light
  rail as a vehicle. Gemini correctly identifies it as a train and
  reports `body_type = "unknown"`, which the renderer treats as a
  signal to suppress the label so it doesn't pollute the demo.
