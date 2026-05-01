#!/usr/bin/env python3
"""Build the fingerprint DB from /data/audio_samples.

Run from project root:
    python -m scripts.generate_fingerprints
or:
    python scripts/generate_fingerprints.py
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from core.audio import load_audio
from core.config import DEFAULT
from core.fingerprint import fingerprint as fp_compute

AUDIO_DIR = ROOT / "data" / "audio_samples"
DB_PATH   = ROOT / "data" / "fingerprints_db" / "fingerprints.json"

# Track manifest. In a real system this would come from the API/DB —
# here it's a small static catalog of reference broadcasts.
MANIFEST = [
    ("tunisie_telecom_1.wav", "tt_pub_1", "Tunisie Telecom — Pub 1", "Tunisie Telecom"),
    ("tunisie_telecom_2.wav", "tt_pub_2", "Tunisie Telecom — Pub 2", "Tunisie Telecom"),
    ("tunisie_telecom_3.wav", "tt_pub_3", "Tunisie Telecom — Pub 3", "Tunisie Telecom"),
    ("tunisie_telecom_4.wav", "tt_pub_4", "Tunisie Telecom — Pub 4", "Tunisie Telecom"),
    ("mosaique_fm_1.wav",     "mfm_spot", "Mosaique FM — Spot",      "Mosaique FM"),
]


def main() -> None:
    cfg = DEFAULT
    fingerprints = []

    for filename, track_id, name, brand in MANIFEST:
        path = AUDIO_DIR / filename
        if not path.exists():
            print(f"  skip: {path} not found")
            continue
        samples = load_audio(str(path), cfg.sample_rate)[:cfg.sample_rate * 60]
        duration = len(samples) / cfg.sample_rate
        hashes = fp_compute(samples, cfg)
        fingerprints.append({
            "track_id":  track_id,
            "name":      name,
            "brand":     brand,
            "duration":  round(duration, 2),
            "hash_count": len(hashes),
            "hashes":    [{"hash": h, "time": t} for h, t in hashes],
        })
        print(f"  {filename}  {duration:.1f}s → {len(hashes)} hashes")

    doc = {
        "version": 7,
        "config": {
            "sample_rate":  cfg.sample_rate,
            "fft_size":     cfg.fft_size,
            "hop_size":     cfg.hop_size,
            "min_freq_hz":  cfg.min_freq_hz,
            "max_freq_hz":  cfg.max_freq_hz,
            "freq_quant":   cfg.freq_quant,
            "fan_out":      cfg.fan_out,
            "t_min":        cfg.t_min,
            "t_max":        cfg.t_max,
        },
        "fingerprints": fingerprints,
    }

    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(DB_PATH, "w") as f:
        json.dump(doc, f)

    total = sum(fp["hash_count"] for fp in fingerprints)
    uniq = len({h["hash"] for fp in fingerprints for h in fp["hashes"]})
    print(f"\n✓ wrote {DB_PATH.relative_to(ROOT)}")
    print(f"  {len(fingerprints)} tracks · {total} hashes · {uniq} unique")


if __name__ == "__main__":
    main()
