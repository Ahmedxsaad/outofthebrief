"""Detect, track, profile (via Gemini), and annotate cars in a video.

Phase 1: YOLOv11 + ByteTrack -> per-frame detections + best crop per track ID
Phase 2: Gemini vision call per unique track ID -> {make, model, body, segment, price}
Phase 3: Re-read video, draw boxes + profile labels, encode H.264 mp4

Usage:
    GEMINI_API_KEY=... python tools/profile_cars.py \
        --input assets/cars.mp4 --output assets/cars_profiled.mp4

Intermediate state is cached under tools/.profile_cache/ so phases can be
re-run independently. Use --force-detect or --force-profile to invalidate.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import cv2
import numpy as np
from google import genai
from google.genai import types as gtypes
from pydantic import BaseModel
from ultralytics import YOLO

VEHICLE_CLASSES = {2: "car", 5: "bus", 7: "truck"}

PALETTE = [
    (56, 56, 255), (151, 157, 255), (31, 112, 255), (29, 178, 255),
    (49, 210, 207), (10, 249, 72), (23, 204, 146), (134, 219, 61),
    (52, 147, 26), (187, 212, 0), (168, 153, 44), (255, 194, 0),
    (147, 69, 52), (255, 115, 100), (236, 24, 0), (255, 56, 132),
    (133, 0, 82), (255, 56, 203), (200, 149, 255), (199, 55, 255),
]

# Segment -> box color (BGR). Drives the visual "tier" of each car.
SEGMENT_COLORS = {
    "economy":  (170, 170, 170),
    "midrange": (255, 170, 60),
    "premium":  (210, 100, 220),
    "luxury":   (60, 200, 255),
    "unknown":  (110, 110, 110),
}


class CarProfile(BaseModel):
    make: str
    model_guess: str
    body_type: str
    era: str
    segment: str
    estimated_price_usd: int
    confidence: str


PROFILE_PROMPT = """Identify the vehicle in this image. Output JSON only.

Fields:
- make: brand (e.g. "Honda", "Mercedes-Benz", "Ford"). Use "Unknown" if not identifiable.
- model_guess: specific model line if recognizable (e.g. "Accord", "GLE", "F-150"). Use "Unknown" otherwise.
- body_type: one of [sedan, SUV, pickup, van, minivan, coupe, hatchback, wagon, unknown]
- era: approximate decade — one of ["2000s", "2010s", "2020s", "unknown"]
- segment: one of [economy, midrange, premium, luxury, unknown]
- estimated_price_usd: integer ballpark USD price for this vehicle in average used condition. Use 0 if unknown.
- confidence: one of [low, medium, high] — reflect how clearly you can see distinguishing features (grille, badge, body shape).

Be honest about uncertainty. Distant, blurry, or rear-only views → use "Unknown" with confidence "low"."""


# ----------------- drawing helpers -----------------

def color_for_track(tid: int) -> tuple[int, int, int]:
    return PALETTE[int(tid) % len(PALETTE)]


def draw_label(frame, x, y, lines: list[tuple[str, float]], color):
    """Draw a multi-line label anchored at top-left (x, y). lines = [(text, scale), ...]."""
    pad = 5
    line_h = 0
    sizes = []
    for text, scale in lines:
        (tw, th), _ = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, scale, 2)
        sizes.append((tw, th))
        line_h += th + 6
    box_w = max(s[0] for s in sizes) + 2 * pad
    box_h = line_h + pad
    y0 = max(0, y - box_h)
    cv2.rectangle(frame, (x, y0), (x + box_w, y0 + box_h), color, -1)
    cy = y0 + pad
    for (text, scale), (tw, th) in zip(lines, sizes):
        cy += th
        cv2.putText(
            frame, text, (x + pad, cy),
            cv2.FONT_HERSHEY_SIMPLEX, scale, (255, 255, 255), 2, cv2.LINE_AA,
        )
        cy += 6


def draw_box(frame, x1, y1, x2, y2, color):
    cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2, cv2.LINE_AA)


def draw_hud(frame, in_frame: int, total_unique: int, total_value_usd: int, model_name: str):
    panel_w, panel_h = 480, 170
    overlay = frame.copy()
    cv2.rectangle(overlay, (20, 20), (20 + panel_w, 20 + panel_h), (15, 15, 15), -1)
    cv2.addWeighted(overlay, 0.55, frame, 0.45, 0, frame)
    cv2.rectangle(frame, (20, 20), (20 + panel_w, 20 + panel_h), (90, 90, 90), 1)
    cv2.putText(frame, f"{model_name} + ByteTrack + Gemini",
                (36, 52), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (180, 180, 180), 1, cv2.LINE_AA)
    cv2.putText(frame, f"Cars in frame: {in_frame}",
                (36, 92), cv2.FONT_HERSHEY_SIMPLEX, 0.85, (255, 255, 255), 2, cv2.LINE_AA)
    cv2.putText(frame, f"Total unique: {total_unique}",
                (36, 130), cv2.FONT_HERSHEY_SIMPLEX, 0.85, (80, 220, 120), 2, cv2.LINE_AA)
    cv2.putText(frame, f"Fleet value (est): ${total_value_usd:,}",
                (36, 168), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (60, 200, 255), 2, cv2.LINE_AA)


# ----------------- ffmpeg -----------------

def open_ffmpeg_writer(out_path: Path, width: int, height: int, fps: float):
    if not shutil.which("ffmpeg"):
        raise RuntimeError("ffmpeg not on PATH")
    cmd = [
        "ffmpeg", "-y", "-loglevel", "error",
        "-f", "rawvideo", "-vcodec", "rawvideo",
        "-s", f"{width}x{height}", "-pix_fmt", "bgr24",
        "-r", f"{fps}", "-i", "-",
        "-an",
        "-c:v", "libx264", "-preset", "medium", "-crf", "18",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart",
        str(out_path),
    ]
    return subprocess.Popen(cmd, stdin=subprocess.PIPE)


# ----------------- PHASE 1: detect + track -----------------

def run_detect_phase(args, crops_dir: Path, detections_path: Path):
    print(f"[phase 1] detecting + tracking on {args.input}")
    cap = cv2.VideoCapture(str(args.input))
    if not cap.isOpened():
        raise RuntimeError(f"cannot open {args.input}")
    n_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    model = YOLO(args.weights)

    # frame_idx (str) -> [{tid, bbox:[x1,y1,x2,y2], cls, area}, ...]
    detections: dict[str, list[dict]] = {}
    # tid -> (best_area, jpeg_bytes)
    best_crop: dict[int, tuple[int, bytes]] = {}

    for f in crops_dir.glob("*.jpg"):
        f.unlink()

    frame_idx = 0
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        frame_idx += 1
        results = model.track(
            frame,
            persist=True,
            tracker="bytetrack.yaml",
            classes=list(VEHICLE_CLASSES.keys()),
            conf=args.conf,
            iou=args.iou,
            imgsz=args.imgsz,
            device=args.device,
            verbose=False,
        )
        r = results[0]
        per_frame = []
        if r.boxes is not None and len(r.boxes) > 0:
            xyxy = r.boxes.xyxy.cpu().numpy().astype(int)
            cls = r.boxes.cls.cpu().numpy().astype(int)
            ids = (r.boxes.id.cpu().numpy().astype(int) if r.boxes.id is not None
                   else np.full(len(cls), -1, dtype=int))
            for (x1, y1, x2, y2), c, tid in zip(xyxy, cls, ids):
                area = max(0, (x2 - x1)) * max(0, (y2 - y1))
                per_frame.append({"tid": int(tid), "bbox": [int(x1), int(y1), int(x2), int(y2)],
                                  "cls": int(c), "area": int(area)})
                if tid >= 0:
                    prev = best_crop.get(int(tid))
                    if prev is None or area > prev[0]:
                        # 10% padding around the car for context
                        pad_x = int((x2 - x1) * 0.1)
                        pad_y = int((y2 - y1) * 0.1)
                        cx1 = max(0, x1 - pad_x)
                        cy1 = max(0, y1 - pad_y)
                        cx2 = min(frame.shape[1], x2 + pad_x)
                        cy2 = min(frame.shape[0], y2 + pad_y)
                        crop = frame[cy1:cy2, cx1:cx2]
                        if crop.size > 0:
                            ok_enc, jpg = cv2.imencode(".jpg", crop, [cv2.IMWRITE_JPEG_QUALITY, 92])
                            if ok_enc:
                                best_crop[int(tid)] = (int(area), jpg.tobytes())
        detections[str(frame_idx)] = per_frame

        if frame_idx % 30 == 0 or frame_idx == n_frames:
            pct = 100.0 * frame_idx / max(n_frames, 1)
            print(f"  frame {frame_idx}/{n_frames} ({pct:5.1f}%) tracks_so_far={len(best_crop)}")

    cap.release()

    for tid, (_, jpg) in best_crop.items():
        (crops_dir / f"{tid:05d}.jpg").write_bytes(jpg)
    detections_path.write_text(json.dumps(detections))
    print(f"[phase 1] wrote {detections_path} and {len(best_crop)} crops to {crops_dir}")


# ----------------- PHASE 2: profile via Gemini -----------------

class KeyPool:
    """Round-robin pool of Gemini API keys with rate-limit-aware rotation."""

    def __init__(self, keys: list[str]):
        if not keys:
            raise ValueError("no API keys provided")
        self._clients = [genai.Client(api_key=k) for k in keys]
        self._idx = 0
        self._lock = __import__("threading").Lock()

    def next_client(self):
        with self._lock:
            c = self._clients[self._idx % len(self._clients)]
            self._idx += 1
            return c

    def __len__(self):
        return len(self._clients)


def _is_rate_limited(err: Exception) -> bool:
    s = str(err).lower()
    return ("429" in s or "rate" in s or "quota" in s or "resource_exhausted" in s
            or "exhausted" in s)


def profile_one(pool: "KeyPool", model_id: str, tid: int, crop_path: Path,
                max_attempts: int = 6) -> tuple[int, dict | None, str | None]:
    img = crop_path.read_bytes()
    last_err = None
    for attempt in range(max_attempts):
        client = pool.next_client()
        try:
            resp = client.models.generate_content(
                model=model_id,
                contents=[
                    gtypes.Part.from_bytes(data=img, mime_type="image/jpeg"),
                    PROFILE_PROMPT,
                ],
                config=gtypes.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=CarProfile,
                    temperature=0.2,
                ),
            )
            data = json.loads(resp.text)
            CarProfile(**data)
            return tid, data, None
        except Exception as e:
            last_err = e
            if _is_rate_limited(e):
                # rotate is automatic via next_client; backoff if all keys are tight
                time.sleep(min(2 ** attempt, 20))
                continue
            return tid, None, f"{type(e).__name__}: {e}"
    return tid, None, f"rate-limited after {max_attempts} attempts: {last_err}"


def run_profile_phase(args, crops_dir: Path, track_ids: list[int], api_keys: list[str]) -> dict:
    pool = KeyPool(api_keys)
    crops = []
    skipped: list[int] = []
    for tid in track_ids:
        p = crops_dir / f"{tid:05d}.jpg"
        if not p.exists():
            continue
        img = cv2.imdecode(np.frombuffer(p.read_bytes(), np.uint8), cv2.IMREAD_COLOR)
        if img is None:
            continue
        h, w = img.shape[:2]
        if min(h, w) < args.min_crop:
            skipped.append(tid)
            continue
        crops.append((tid, p))

    print(f"[phase 2] profiling {len(crops)} cars via Gemini ({args.gemini_model}) "
          f"with {len(pool)} key(s); skipped {len(skipped)} below {args.min_crop}px")

    profiles: dict[str, dict] = {}
    failures = 0
    t0 = time.time()
    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futures = {ex.submit(profile_one, pool, args.gemini_model, tid, path): tid
                   for tid, path in crops}
        done = 0
        for fut in as_completed(futures):
            tid, data, err = fut.result()
            done += 1
            if err is not None:
                failures += 1
                if failures <= 5:
                    print(f"  [tid {tid}] failed: {err}")
            else:
                profiles[str(tid)] = data
            if done % 10 == 0 or done == len(crops):
                elapsed = time.time() - t0
                print(f"  {done}/{len(crops)} profiled ({elapsed:.1f}s, fails={failures})")

    for tid in skipped:
        profiles[str(tid)] = {
            "make": "Unknown", "model_guess": "Unknown", "body_type": "unknown",
            "era": "unknown", "segment": "unknown", "estimated_price_usd": 0,
            "confidence": "low",
        }
    return profiles


# ----------------- PHASE 3: render -----------------

def short_price(p: int) -> str:
    if not p:
        return ""
    if p >= 1000:
        return f"~${p/1000:.0f}k"
    return f"~${p}"


def make_labels_for(profile: dict | None, tid: int) -> list[tuple[str, float]] | None:
    """Return the label lines for a track, or None to suppress the label entirely
    (for distant / unidentifiable cars — keep just the box)."""
    if not profile:
        return None
    make = profile.get("make", "Unknown")
    model = profile.get("model_guess", "Unknown")
    body = profile.get("body_type", "unknown")
    seg = profile.get("segment", "unknown")
    price = short_price(int(profile.get("estimated_price_usd", 0) or 0))

    # body_type == "unknown" is Gemini's signal that this isn't a clearly-identifiable
    # road vehicle (e.g. the Calgary CTrain it correctly tagged as "Siemens S70").
    # Suppress label so it doesn't pollute the demo.
    if body == "unknown":
        return None
    if make == "Unknown" and model == "Unknown":
        line1 = f"#{tid} {body}"
    elif model == "Unknown":
        line1 = f"#{tid} {make}"
    else:
        line1 = f"#{tid} {make} {model}"

    parts = []
    if body != "unknown":
        parts.append(body)
    if price:
        parts.append(price)
    if seg != "unknown":
        parts.append(seg)
    line2 = " | ".join(parts) if parts else ""

    out = [(line1, 0.6)]
    if line2:
        out.append((line2, 0.5))
    return out


def run_render_phase(args, detections: dict, profiles: dict):
    print(f"[phase 3] rendering -> {args.output}")
    cap = cv2.VideoCapture(str(args.input))
    if not cap.isOpened():
        raise RuntimeError(f"cannot open {args.input}")
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    n_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    args.output.parent.mkdir(parents=True, exist_ok=True)
    writer = open_ffmpeg_writer(args.output, width, height, fps)

    seen_ids: set[int] = set()
    fleet_value = 0
    counted_for_value: set[int] = set()

    frame_idx = 0
    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            frame_idx += 1
            in_frame = 0
            for det in detections.get(str(frame_idx), []):
                tid = det["tid"]
                x1, y1, x2, y2 = det["bbox"]
                profile = profiles.get(str(tid))
                seg = (profile or {}).get("segment", "unknown")
                color = SEGMENT_COLORS.get(seg, color_for_track(max(tid, 0)))
                box_w = x2 - x1
                draw_box(frame, x1, y1, x2, y2, color)
                # Only label cars big enough that the label won't overlap distant ones.
                # Below ~140px wide, labels in the back of the scene start stacking.
                if box_w >= 140:
                    labels = make_labels_for(profile, tid)
                    if labels is not None:
                        draw_label(frame, x1, y1, labels, color)
                if tid >= 0:
                    seen_ids.add(tid)
                    if tid not in counted_for_value and profile:
                        fleet_value += int(profile.get("estimated_price_usd", 0) or 0)
                        counted_for_value.add(tid)
                in_frame += 1

            draw_hud(frame, in_frame, len(seen_ids), fleet_value,
                     args.weights.replace(".pt", "").upper())
            assert writer.stdin is not None
            writer.stdin.write(frame.tobytes())

            if frame_idx % 60 == 0 or frame_idx == n_frames:
                pct = 100.0 * frame_idx / max(n_frames, 1)
                print(f"  render {frame_idx}/{n_frames} ({pct:5.1f}%)")
    finally:
        cap.release()
        if writer.stdin is not None:
            writer.stdin.close()
        writer.wait()


# ----------------- main -----------------

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", required=True, type=Path)
    ap.add_argument("--output", required=True, type=Path)
    ap.add_argument("--cache", type=Path, default=Path("tools/.profile_cache"))
    ap.add_argument("--weights", default="yolo11x.pt")
    ap.add_argument("--device", default="cpu")
    ap.add_argument("--imgsz", type=int, default=960)
    ap.add_argument("--conf", type=float, default=0.35)
    ap.add_argument("--iou", type=float, default=0.5)
    ap.add_argument("--gemini-model", default="gemini-3.1-flash-lite-preview")
    ap.add_argument("--min-crop", type=int, default=80)
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--force-detect", action="store_true")
    ap.add_argument("--force-profile", action="store_true")
    args = ap.parse_args()

    raw = os.environ.get("GEMINI_API_KEY", "")
    api_keys = [k.strip() for k in raw.split(",") if k.strip()]
    if not api_keys:
        print("ERROR: GEMINI_API_KEY env var not set (comma-separate for multiple keys).",
              file=sys.stderr)
        return 2
    if not args.input.exists():
        print(f"ERROR: input not found: {args.input}", file=sys.stderr)
        return 2

    args.cache.mkdir(parents=True, exist_ok=True)
    crops_dir = args.cache / "crops"
    crops_dir.mkdir(exist_ok=True)
    detections_path = args.cache / "detections.json"
    profiles_path = args.cache / "profiles.json"

    if args.force_detect or not detections_path.exists():
        run_detect_phase(args, crops_dir, detections_path)
    else:
        print(f"[phase 1] reusing {detections_path}")

    detections = json.loads(detections_path.read_text())
    track_ids = sorted({int(d["tid"]) for fs in detections.values() for d in fs if d["tid"] >= 0})
    print(f"[phase 1] {len(track_ids)} unique tracks")

    if args.force_profile or not profiles_path.exists():
        profiles = run_profile_phase(args, crops_dir, track_ids, api_keys)
        profiles_path.write_text(json.dumps(profiles, indent=2))
    else:
        profiles = json.loads(profiles_path.read_text())
        print(f"[phase 2] reusing {profiles_path} ({len(profiles)} profiles)")

    run_render_phase(args, detections, profiles)
    print(f"\nDone. Wrote {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
