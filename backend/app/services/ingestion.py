"""Audio-track ingestion: WAV bytes → fingerprint → indexed track."""
from __future__ import annotations

import io
import uuid

import numpy as np
from scipy.io import wavfile

from core.audio import load_audio
from core.config import DEFAULT
from core.fingerprint import fingerprint as fp_compute

from ..db.store import FingerprintStore


def ingest_wav_bytes(store: FingerprintStore, wav_bytes: bytes,
                     name: str, brand: str) -> dict:
    """Add a new track to the fingerprint DB from in-memory WAV bytes."""
    # Reuse the file-based loader by going through scipy directly here
    sr, data = wavfile.read(io.BytesIO(wav_bytes))
    if data.dtype == np.int16:
        data = data.astype(np.float32) / 32768.0
    elif data.dtype == np.int32:
        data = data.astype(np.float32) / 2147483648.0
    if data.ndim > 1:
        data = data.mean(axis=1)
    if sr != DEFAULT.sample_rate:
        from scipy.signal import resample
        data = resample(data, int(len(data) * DEFAULT.sample_rate / sr))
    samples = data.astype(np.float32)

    duration = len(samples) / DEFAULT.sample_rate
    hashes = fp_compute(samples)
    track_id = f"track_{uuid.uuid4().hex[:8]}"

    store.add_track(
        track_id, hashes,
        meta={"name": name, "brand": brand, "duration": round(duration, 2),
              "hash_count": len(hashes)},
    )
    return {"track_id": track_id, "name": name, "brand": brand,
            "duration": round(duration, 2), "hash_count": len(hashes)}


def ingest_file(store: FingerprintStore, path: str, name: str, brand: str) -> dict:
    """Add a new track from a WAV file on disk."""
    samples = load_audio(path, DEFAULT.sample_rate)
    duration = len(samples) / DEFAULT.sample_rate
    hashes = fp_compute(samples)
    track_id = f"track_{uuid.uuid4().hex[:8]}"
    store.add_track(
        track_id, hashes,
        meta={"name": name, "brand": brand, "duration": round(duration, 2),
              "hash_count": len(hashes)},
    )
    return {"track_id": track_id, "name": name, "brand": brand,
            "duration": round(duration, 2), "hash_count": len(hashes)}
