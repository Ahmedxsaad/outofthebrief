"""Track listing + new-track ingestion."""
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile

from ..db.store import FingerprintStore
from ..schemas import TrackSummary, TracksResponse
from ..services.ingestion import ingest_wav_bytes

router = APIRouter(prefix="/api", tags=["tracks"])


def get_store(request: Request) -> FingerprintStore:
    return request.app.state.store


@router.get("/tracks", response_model=TracksResponse)
def list_tracks(store: FingerprintStore = Depends(get_store)):
    summaries = [
        TrackSummary(
            track_id=tid, name=meta["name"], brand=meta.get("brand", ""),
            duration_sec=float(meta.get("duration", 0.0)),
            hash_count=int(meta.get("hash_count", 0)),
        )
        for tid, meta in store.index.tracks().items()
    ]
    return TracksResponse(
        tracks=summaries,
        unique_hashes=store.index.unique_hashes,
        total_entries=store.index.total_entries,
    )


@router.post("/tracks")
async def add_track(
    name: str = Form(...),
    brand: str = Form(...),
    file: UploadFile = File(...),
    store: FingerprintStore = Depends(get_store),
):
    if not file.filename.lower().endswith(".wav"):
        raise HTTPException(status_code=400, detail="only WAV uploads supported")
    data = await file.read()
    return ingest_wav_bytes(store, data, name=name, brand=brand)
