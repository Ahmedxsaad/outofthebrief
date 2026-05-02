"""Detect and count cars in a video using YOLOv11 + ByteTrack.

Produces an annotated mp4 with bounding boxes, persistent track IDs,
per-frame count, and running unique-car count.

Usage:
    python tools/detect_cars.py \
        --input  assets/cars.mp4 \
        --output assets/cars_detected.mp4
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

import cv2
import numpy as np
from ultralytics import YOLO

# COCO class IDs for "car-like" vehicles. Motorcycle (3) excluded by default.
VEHICLE_CLASSES = {2: "car", 5: "bus", 7: "truck"}

# Distinct colors per track ID (BGR, OpenCV order). Cycled by id % len.
PALETTE = [
    (56, 56, 255), (151, 157, 255), (31, 112, 255), (29, 178, 255),
    (49, 210, 207), (10, 249, 72), (23, 204, 146), (134, 219, 61),
    (52, 147, 26), (187, 212, 0), (168, 153, 44), (255, 194, 0),
    (147, 69, 52), (255, 115, 100), (236, 24, 0), (255, 56, 132),
    (133, 0, 82), (255, 56, 203), (200, 149, 255), (199, 55, 255),
]


def color_for(track_id: int) -> tuple[int, int, int]:
    return PALETTE[int(track_id) % len(PALETTE)]


def draw_box(frame, x1, y1, x2, y2, label: str, color):
    cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2, lineType=cv2.LINE_AA)
    (tw, th), baseline = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
    pad = 4
    ytop = max(0, y1 - th - 2 * pad)
    cv2.rectangle(frame, (x1, ytop), (x1 + tw + 2 * pad, y1), color, -1)
    cv2.putText(
        frame, label, (x1 + pad, y1 - pad - 1),
        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2, lineType=cv2.LINE_AA,
    )


def draw_hud(frame, in_frame: int, total_unique: int, model_name: str):
    h, w = frame.shape[:2]
    panel_w, panel_h = 430, 130
    overlay = frame.copy()
    cv2.rectangle(overlay, (20, 20), (20 + panel_w, 20 + panel_h), (15, 15, 15), -1)
    cv2.addWeighted(overlay, 0.55, frame, 0.45, 0, frame)
    cv2.rectangle(frame, (20, 20), (20 + panel_w, 20 + panel_h), (90, 90, 90), 1)

    cv2.putText(
        frame, f"{model_name} + ByteTrack",
        (36, 52), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (180, 180, 180), 1, cv2.LINE_AA,
    )
    cv2.putText(
        frame, f"Cars in frame: {in_frame}",
        (36, 92), cv2.FONT_HERSHEY_SIMPLEX, 0.85, (255, 255, 255), 2, cv2.LINE_AA,
    )
    cv2.putText(
        frame, f"Total unique: {total_unique}",
        (36, 130), cv2.FONT_HERSHEY_SIMPLEX, 0.85, (80, 220, 120), 2, cv2.LINE_AA,
    )


def open_ffmpeg_writer(out_path: Path, width: int, height: int, fps: float):
    if not shutil.which("ffmpeg"):
        raise RuntimeError("ffmpeg not found on PATH")
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


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", required=True, type=Path)
    ap.add_argument("--output", required=True, type=Path)
    ap.add_argument("--weights", default="yolo11x.pt",
                    help="YOLO weights (yolo11n/s/m/l/x.pt). Default: yolo11x (most accurate).")
    ap.add_argument("--imgsz", type=int, default=960,
                    help="Inference resolution. 1080p frames are letterboxed to this.")
    ap.add_argument("--conf", type=float, default=0.35)
    ap.add_argument("--iou", type=float, default=0.5)
    ap.add_argument("--device", default=None,
                    help="'cuda:0', 'cpu', or None (auto).")
    args = ap.parse_args()

    if not args.input.exists():
        print(f"Input not found: {args.input}", file=sys.stderr)
        return 2
    args.output.parent.mkdir(parents=True, exist_ok=True)

    cap = cv2.VideoCapture(str(args.input))
    if not cap.isOpened():
        print(f"Could not open video: {args.input}", file=sys.stderr)
        return 2
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    n_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    print(f"Input: {width}x{height} @ {fps:.2f} fps, {n_frames} frames")

    print(f"Loading model: {args.weights}")
    model = YOLO(args.weights)

    writer = open_ffmpeg_writer(args.output, width, height, fps)

    seen_ids: set[int] = set()
    frame_idx = 0

    try:
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

            in_frame = 0
            if r.boxes is not None and len(r.boxes) > 0:
                xyxy = r.boxes.xyxy.cpu().numpy().astype(int)
                cls = r.boxes.cls.cpu().numpy().astype(int)
                ids = (
                    r.boxes.id.cpu().numpy().astype(int)
                    if r.boxes.id is not None
                    else np.full(len(cls), -1, dtype=int)
                )
                for (x1, y1, x2, y2), c, tid in zip(xyxy, cls, ids):
                    name = VEHICLE_CLASSES.get(int(c), "vehicle")
                    if tid >= 0:
                        seen_ids.add(int(tid))
                        label = f"{name} #{tid}"
                    else:
                        label = name
                    draw_box(frame, int(x1), int(y1), int(x2), int(y2), label, color_for(max(tid, 0)))
                    in_frame += 1

            draw_hud(frame, in_frame, len(seen_ids), args.weights.replace(".pt", "").upper())

            assert writer.stdin is not None
            writer.stdin.write(frame.tobytes())

            if frame_idx % 30 == 0 or frame_idx == n_frames:
                pct = 100.0 * frame_idx / max(n_frames, 1)
                print(f"  frame {frame_idx}/{n_frames} ({pct:5.1f}%) "
                      f"in-frame={in_frame} unique={len(seen_ids)}")
    finally:
        cap.release()
        if writer.stdin is not None:
            writer.stdin.close()
        writer.wait()

    print(f"\nDone. Wrote {args.output}")
    print(f"Total unique cars detected across video: {len(seen_ids)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
