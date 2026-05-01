"""Pydantic request/response models for the public API."""
from typing import List, Optional

from pydantic import BaseModel, Field


# ── /api/match ────────────────────────────────────────────────────────────

class HashEntry(BaseModel):
    """One entry from a client-side fingerprint."""
    hash: str
    time: int   # anchor time-frame within the query


class MatchRequest(BaseModel):
    hashes: List[HashEntry] = Field(..., min_length=1)
    client_id: Optional[str] = None   # opaque tag, used for event attribution


class MatchResponse(BaseModel):
    matched: bool
    track_id: Optional[str] = None
    track_name: Optional[str] = None
    brand: Optional[str] = None
    coherence: int
    total_hits: int
    confidence: float
    time_offset_frames: int
    query_hash_count: int


# ── /api/tracks ───────────────────────────────────────────────────────────

class TrackSummary(BaseModel):
    track_id: str
    name: str
    brand: str
    duration_sec: float
    hash_count: int


class TracksResponse(BaseModel):
    tracks: List[TrackSummary]
    unique_hashes: int
    total_entries: int


# ── /api/metrics ──────────────────────────────────────────────────────────

class Metrics(BaseModel):
    audio_matches: int
    impressions: int
    tuneins: int
    profiles: int
    events_total: int
    uptime_sec: float


# ── /api/telecom ──────────────────────────────────────────────────────────

class TelecomSector(BaseModel):
    name: str
    capacity_pct: float
    ci_db: float


class TelecomSectorsResponse(BaseModel):
    sectors: List[TelecomSector]
    integration_status: str
