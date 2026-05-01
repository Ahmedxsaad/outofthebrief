"""Audio fingerprint matching endpoint."""
from fastapi import APIRouter, Depends, Request

from ..config import COHERENCE_THRESHOLD
from ..db.store import FingerprintStore
from ..schemas import MatchRequest, MatchResponse
from ..services.events import broker
from ..services.metrics import metrics

router = APIRouter(prefix="/api", tags=["match"])


def get_store(request: Request) -> FingerprintStore:
    return request.app.state.store


@router.post("/match", response_model=MatchResponse)
def match_audio(req: MatchRequest, store: FingerprintStore = Depends(get_store)):
    query = [(h.hash, h.time) for h in req.hashes]
    result = store.index.match(query, coherence_threshold=COHERENCE_THRESHOLD)

    if result.track_id is None:
        return MatchResponse(
            matched=False,
            coherence=result.coherence,
            total_hits=result.total_hits,
            confidence=0.0,
            time_offset_frames=result.time_offset,
            query_hash_count=len(query),
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
        query_hash_count=len(query),
    )

    broker.publish("match", {
        "track_id": result.track_id,
        "track_name": meta["name"],
        "brand": meta.get("brand", ""),
        "confidence": response.confidence,
        "client_id": req.client_id,
    })
    return response
