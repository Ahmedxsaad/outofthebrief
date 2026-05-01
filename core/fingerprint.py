"""Constellation-map fingerprint generation.

Pipeline: samples → log-STFT → adaptive-threshold local-max peaks →
target-zone hash pairs (Shazam-style).

Hash format: f"{quantised_bin1}|{quantised_bin2}|{frame_delta}".
Each hash entry is a (hash, anchor_time_frame) tuple.
"""
from __future__ import annotations

from collections import defaultdict
from typing import List, Tuple

import numpy as np

from .config import FingerprintConfig, DEFAULT

Hash = Tuple[str, int]   # (hash_string, anchor_time_frame)


def _hann(n: int) -> np.ndarray:
    return 0.5 * (1 - np.cos(2 * np.pi * np.arange(n) / (n - 1)))


def log_spectrogram(samples: np.ndarray, cfg: FingerprintConfig = DEFAULT) -> List[np.ndarray]:
    """STFT → log-magnitude frames clipped to [min_bin, max_bin)."""
    window = _hann(cfg.fft_size)
    frames: List[np.ndarray] = []
    for s in range(0, len(samples) - cfg.fft_size, cfg.hop_size):
        spec = np.abs(np.fft.rfft(samples[s:s + cfg.fft_size] * window))
        frames.append(np.log1p(spec[cfg.min_bin:cfg.max_bin] * 100.0))
    return frames


def extract_peaks(frames: List[np.ndarray],
                  cfg: FingerprintConfig = DEFAULT) -> List[Tuple[int, int, float]]:
    """Per-frame adaptive threshold + local-max in frequency.

    Returns (time_frame, absolute_bin, log_magnitude) tuples sorted by time.
    """
    by_t: dict[int, list] = defaultdict(list)
    r = cfg.local_max_radius
    for t, frame in enumerate(frames):
        if frame.size == 0:
            continue
        thresh = frame.mean() + cfg.thresh_k * frame.std()
        for i in range(r, len(frame) - r):
            v = frame[i]
            if v < thresh:
                continue
            if v >= frame[i - r:i + r + 1].max():
                by_t[t].append((v, i + cfg.min_bin))
        by_t[t].sort(reverse=True)
        by_t[t] = by_t[t][:cfg.peaks_per_frame]

    peaks: list[Tuple[int, int, float]] = []
    for t in sorted(by_t):
        for v, b in by_t[t]:
            peaks.append((t, b, v))
    return peaks


def hash_peaks(peaks: List[Tuple[int, int, float]],
               cfg: FingerprintConfig = DEFAULT) -> List[Hash]:
    """Anchor → fan-out target peaks within [t_min, t_max] frames."""
    out: list[Hash] = []
    q = cfg.freq_quant
    for i, (t1, b1, _) in enumerate(peaks):
        paired = 0
        for j in range(i + 1, len(peaks)):
            t2, b2, _ = peaks[j]
            dt = t2 - t1
            if dt < cfg.t_min:
                continue
            if dt > cfg.t_max:
                break
            qb1 = (b1 // q) * q
            qb2 = (b2 // q) * q
            out.append((f"{qb1}|{qb2}|{dt}", t1))
            paired += 1
            if paired >= cfg.fan_out:
                break
    return out


def fingerprint(samples: np.ndarray, cfg: FingerprintConfig = DEFAULT) -> List[Hash]:
    """End-to-end: samples → list of (hash, anchor_time) entries."""
    return hash_peaks(extract_peaks(log_spectrogram(samples, cfg), cfg), cfg)
