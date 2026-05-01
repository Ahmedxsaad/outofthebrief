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


class TelecomSectorTelemetry(BaseModel):
    sector_id: str
    name: Optional[str] = None
    capacity_used_pct: float
    ci_db: float
    calibration: Optional[float] = None
    updated_at: Optional[float] = None


class TelecomIngestRequest(BaseModel):
    timestamp: Optional[float] = None
    sectors: List[TelecomSectorTelemetry] = Field(..., min_length=1)


class BillboardSectorMapping(BaseModel):
    billboard_id: str
    sector_id: str
    weight: float = 1.0


class BillboardMappingUpsertRequest(BaseModel):
    mappings: List[BillboardSectorMapping] = Field(..., min_length=1)


class TelecomMacroSector(BaseModel):
    sector_id: str
    name: Optional[str] = None
    capacity_used_pct: float
    ci_db: float
    density: float
    calibrated_density: float
    calibration: float
    updated_at: float


class TelecomMacroResponse(BaseModel):
    integration_status: str
    updated_at: float
    sectors: List[TelecomMacroSector]


class BillboardMacroDensity(BaseModel):
    billboard_id: str
    density: float
    updated_at: float
    sectors: List[TelecomMacroSector]
