"""Audio fingerprint matching endpoints.

POST /api/match        — accepts a hash array (used by the web demo, which
                          fingerprints in the browser).
POST /api/match-audio  — accepts a raw audio upload (used by the mobile
                          app: iOS sends WAV, Android sends m4a/aac, both
                          decoded server-side via pydub→ffmpeg).
"""
import subprocess
from typing import Optional

import numpy as np
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile

from core.config import DEFAULT
from core.fingerprint import fingerprint as fp_compute


def _decode_to_mono_pcm(raw: bytes, target_sr: int) -> np.ndarray:
    """Decode any ffmpeg-supported audio blob to mono float32 at target_sr."""
    proc = subprocess.run(
        [
            "ffmpeg", "-loglevel", "error",
            "-i", "pipe:0",
            "-f", "s16le", "-ac", "1", "-ar", str(target_sr),
            "pipe:1",
        ],
        input=raw, capture_output=True, check=False,
    )
    if proc.returncode != 0:
        raise HTTPException(status_code=400,
                            detail=f"ffmpeg decode failed: {proc.stderr.decode()[:200]}")
    pcm = np.frombuffer(proc.stdout, dtype=np.int16).astype(np.float32) / 32768.0
    return pcm

from ..config import COHERENCE_THRESHOLD
from ..db.store import FingerprintStore
from ..schemas import MatchRequest, MatchResponse
from ..services.events import broker
from ..services.metrics import metrics

router = APIRouter(prefix="/api", tags=["match"])


def get_store(request: Request) -> FingerprintStore:
    return request.app.state.store


def _build_response(result, total_query_hashes: int, store: FingerprintStore,
                    client_id: Optional[str]) -> MatchResponse:
    if result.track_id is None:
        return MatchResponse(
            matched=False,
            coherence=result.coherence,
            total_hits=result.total_hits,
            confidence=0.0,
            time_offset_frames=result.time_offset,
            query_hash_count=total_query_hashes,
        )

    meta = store.index.tracks()[result.track_id]
    metrics.increment(audio_matches=1)

    response = MatchResponse(
        matched=True,
        track_id=result.track_id,
        track_name=meta["name"],
        brand=meta.get("brand", ""),
        coherence=result.coherence,
        total_hits=result.total_hits,
        confidence=round(result.confidence, 3),
        time_offset_frames=result.time_offset,
        query_hash_count=total_query_hashes,
    )
    broker.publish("match", {
        "track_id": result.track_id,
        "track_name": meta["name"],
        "brand": meta.get("brand", ""),
        "confidence": response.confidence,
        "client_id": client_id,
    })
    return response


@router.post("/match", response_model=MatchResponse)
def match_hashes(req: MatchRequest, store: FingerprintStore = Depends(get_store)):
    """Match a precomputed hash array (web client path)."""
    query = [(h.hash, h.time) for h in req.hashes]
    result = store.index.match(query, coherence_threshold=COHERENCE_THRESHOLD)
    return _build_response(result, len(query), store, req.client_id)


@router.post("/match-audio", response_model=MatchResponse)
async def match_audio_upload(
    file: UploadFile = File(...),
    client_id: Optional[str] = Form(None),
    store: FingerprintStore = Depends(get_store),
):
    """Match a raw audio upload (mobile client path).

    Accepts any format ffmpeg understands (WAV, m4a/aac, mp3, webm, …).
    Decoded → mono → resampled to the algorithm's sample rate → DSP pipeline.
    """
    blob = await file.read()
    if not blob:
        raise HTTPException(status_code=400, detail="empty upload")

    samples = _decode_to_mono_pcm(blob, DEFAULT.sample_rate)
    hashes = fp_compute(samples, DEFAULT)
    if not hashes:
        return MatchResponse(matched=False, coherence=0, total_hits=0,
                             confidence=0.0, time_offset_frames=0,
                             query_hash_count=0)

    result = store.index.match(hashes, coherence_threshold=COHERENCE_THRESHOLD)
    return _build_response(result, len(hashes), store, client_id)
