#!/usr/bin/env python3
"""Benchmark the matcher on clean / noisy / partial clips.

Reports top-1 accuracy, precision, recall, and the coherence gap
between real matches and synthetic-noise/sine-wave probes.
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from core.audio import load_audio
from core.config import DEFAULT
from core.fingerprint import fingerprint as fp_compute
from core.matcher import HashIndex

AUDIO_DIR = ROOT / "data" / "audio_samples"

REFERENCES = [
    ("tunisie_telecom_1.wav", "TT1"),
    ("tunisie_telecom_2.wav", "TT2"),
    ("tunisie_telecom_3.wav", "TT3"),
    ("tunisie_telecom_4.wav", "TT4"),
    ("mosaique_fm_1.wav",     "MFM"),
]

SCENARIOS = [
    ("clean",       0.000, 5),
    ("2s-clean",    0.000, 2),
    ("low-noise",   0.030, 5),
    ("heavy-noise", 0.150, 5),
    ("high-noise",  0.300, 5),
]

COH_THRESHOLD = 8


def add_noise(clip: np.ndarray, sigma: float) -> np.ndarray:
    return clip + (np.random.randn(len(clip)) * sigma).astype(np.float32)


def main() -> None:
    cfg = DEFAULT
    refs: list[tuple[np.ndarray, str]] = []
    for fn, label in REFERENCES:
        p = AUDIO_DIR / fn
        if p.exists():
            refs.append((load_audio(str(p), cfg.sample_rate), label))
    if not refs:
        print("ERROR: no reference audio found.")
        return

    print("Building index…")
    index = HashIndex()
    for i, (samples, label) in enumerate(refs):
        index.add_track(label, fp_compute(samples[:cfg.sample_rate * 60], cfg), {"name": label})

    # ── Synthetic FP probes ──
    rng = np.random.default_rng(42)
    nc = index.match(fp_compute(rng.standard_normal(cfg.sample_rate * 5).astype(np.float32) * 0.1, cfg)).coherence
    sine = (0.3 * np.sin(2 * np.pi * 440 * np.arange(cfg.sample_rate * 5) / cfg.sample_rate)).astype(np.float32)
    sc = index.match(fp_compute(sine, cfg)).coherence

    print(f"\n{'─'*72}")
    print(f"{'Scenario':<14} {'Track':<6} {'Predicted':<10} {'Coh':>6}  Result")
    print(f"{'─'*72}")

    tp = fp_count = fn = 0
    real_min = float("inf")

    for true_idx, (samples, label) in enumerate(refs):
        mid = len(samples) // 2
        for scenario, sigma, secs in SCENARIOS:
            clip = samples[mid: mid + cfg.sample_rate * secs].copy()
            if sigma > 0:
                clip = add_noise(clip, sigma)
            res = index.match(fp_compute(clip, cfg), coherence_threshold=COH_THRESHOLD)
            pred = res.track_id or "—"
            correct = (pred == label)
            detected = res.track_id is not None

            if correct and detected:    tp += 1
            elif detected:              fp_count += 1
            else:                       fn += 1

            mark = "✓" if (correct and detected) else ("FP" if detected else "✗")
            print(f"{scenario:<14} {label:<6} {pred:<10} {res.coherence:>6}  {mark}")

            if scenario != "2s-clean" or sigma == 0:
                real_min = min(real_min, res.coherence)

    print(f"{'─'*72}")
    total = tp + fp_count + fn
    print(f"  Top-1 accuracy : {tp/total*100:.1f}%   ({tp}/{total})")
    print(f"  Precision      : {tp/max(tp+fp_count,1)*100:.1f}%")
    print(f"  Recall         : {tp/max(tp+fn,1)*100:.1f}%")
    print(f"  FP probes      : noise={nc}  sine={sc}  (threshold {COH_THRESHOLD})")
    print(f"  Coherence gap  : real={real_min} vs FP={max(nc, sc, 1)} → "
          f"{real_min/max(nc, sc, 1):.1f}×")


if __name__ == "__main__":
    main()
