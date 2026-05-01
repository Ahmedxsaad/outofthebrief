"""Telecom macro feature service.

Maintains live sector telemetry, billboard-to-sector mappings, and
computes density values from capacity and C/I signals.
"""
from __future__ import annotations

from dataclasses import dataclass
import time

from ..config import (
    TELECOM_CAPACITY_MAX,
    TELECOM_CAPACITY_MIN,
    TELECOM_CI_MAX_DB,
    TELECOM_CI_MIN_DB,
    TELECOM_DENSITY_MAX,
    TELECOM_DENSITY_MIN,
    TELECOM_GLOBAL_CALIBRATION,
    TELECOM_STALE_TTL_SEC,
    TELECOM_WEIGHT_CAPACITY,
    TELECOM_WEIGHT_CI,
)
from ..schemas import (
    BillboardMacroDensity,
    BillboardSectorMapping,
    TelecomMacroResponse,
    TelecomMacroSector,
    TelecomSector,
    TelecomSectorTelemetry,
)


@dataclass
class _SectorState:
    sector_id: str
    name: str | None
    capacity_used_pct: float
    ci_db: float
    calibration: float
    updated_at: float


class TelecomMacroService:
    def __init__(self) -> None:
        self._sectors: dict[str, _SectorState] = {}
        self._billboard_map: dict[str, list[BillboardSectorMapping]] = {}
        self._last_update: float | None = None
        self._has_live: bool = False

    def seed_from_static(self, sectors: list[TelecomSector]) -> None:
        now = time.time()
        for sector in sectors:
            sector_id = self._sector_id_from_name(sector.name)
            self._sectors[sector_id] = _SectorState(
                sector_id=sector_id,
                name=sector.name,
                capacity_used_pct=float(sector.capacity_pct),
                ci_db=float(sector.ci_db),
                calibration=TELECOM_GLOBAL_CALIBRATION,
                updated_at=now,
            )
        if sectors:
            self._last_update = now

    def ingest(self, payload: list[TelecomSectorTelemetry], timestamp: float | None) -> None:
        ingest_ts = timestamp or time.time()
        for sector in payload:
            updated_at = sector.updated_at or ingest_ts
            state = _SectorState(
                sector_id=sector.sector_id,
                name=sector.name,
                capacity_used_pct=float(sector.capacity_used_pct),
                ci_db=float(sector.ci_db),
                calibration=float(sector.calibration or TELECOM_GLOBAL_CALIBRATION),
                updated_at=float(updated_at),
            )
            self._sectors[sector.sector_id] = state
        if payload:
            self._last_update = ingest_ts
            self._has_live = True

    def upsert_mappings(self, mappings: list[BillboardSectorMapping]) -> None:
        for mapping in mappings:
            self._billboard_map.setdefault(mapping.billboard_id, [])
            rows = [
                m for m in self._billboard_map[mapping.billboard_id]
                if m.sector_id != mapping.sector_id
            ]
            rows.append(mapping)
            self._billboard_map[mapping.billboard_id] = rows

    def get_sectors_compat(self) -> list[TelecomSector]:
        return [
            TelecomSector(
                name=state.name or state.sector_id,
                capacity_pct=state.capacity_used_pct,
                ci_db=state.ci_db,
            )
            for state in self._sectors.values()
        ]

    def get_macro_response(self) -> TelecomMacroResponse:
        now = time.time()
        sectors = [self._to_macro_sector(state) for state in self._sectors.values()]
        return TelecomMacroResponse(
            integration_status=self._integration_status(now),
            updated_at=self._last_update or now,
            sectors=sectors,
        )

    def get_billboard_density(self, billboard_id: str) -> BillboardMacroDensity | None:
        mappings = self._billboard_map.get(billboard_id)
        if not mappings:
            return None
        sector_states = []
        weights = []
        for mapping in mappings:
            state = self._sectors.get(mapping.sector_id)
            if not state:
                continue
            sector_states.append(state)
            weights.append(max(0.0, float(mapping.weight)))
        if not sector_states:
            return None
        sector_macros = [self._to_macro_sector(state) for state in sector_states]
        total_weight = sum(weights) or 1.0
        density = sum(m.calibrated_density * w for m, w in zip(sector_macros, weights)) / total_weight
        density = self._clamp(density, TELECOM_DENSITY_MIN, TELECOM_DENSITY_MAX)
        updated_at = max(m.updated_at for m in sector_macros)
        return BillboardMacroDensity(
            billboard_id=billboard_id,
            density=density,
            updated_at=updated_at,
            sectors=sector_macros,
        )

    def _integration_status(self, now: float) -> str:
        if not self._has_live:
            return "static_config"
        if self._last_update and now - self._last_update > TELECOM_STALE_TTL_SEC:
            return "stale"
        return "live"

    def _to_macro_sector(self, state: _SectorState) -> TelecomMacroSector:
        density = self._compute_density(state.capacity_used_pct, state.ci_db)
        calibrated = self._clamp(density * state.calibration, TELECOM_DENSITY_MIN, TELECOM_DENSITY_MAX)
        return TelecomMacroSector(
            sector_id=state.sector_id,
            name=state.name,
            capacity_used_pct=state.capacity_used_pct,
            ci_db=state.ci_db,
            density=density,
            calibrated_density=calibrated,
            calibration=state.calibration,
            updated_at=state.updated_at,
        )

    def _compute_density(self, capacity_used_pct: float, ci_db: float) -> float:
        cap_norm = self._normalize(capacity_used_pct, TELECOM_CAPACITY_MIN, TELECOM_CAPACITY_MAX)
        ci_norm = self._normalize(ci_db, TELECOM_CI_MIN_DB, TELECOM_CI_MAX_DB)
        ci_inverse = 1.0 - ci_norm
        weight_sum = TELECOM_WEIGHT_CAPACITY + TELECOM_WEIGHT_CI or 1.0
        density_norm = (TELECOM_WEIGHT_CAPACITY * cap_norm + TELECOM_WEIGHT_CI * ci_inverse) / weight_sum
        density = density_norm * 100.0
        return self._clamp(density, TELECOM_DENSITY_MIN, TELECOM_DENSITY_MAX)

    @staticmethod
    def _normalize(value: float, vmin: float, vmax: float) -> float:
        if vmax <= vmin:
            return 0.0
        return TelecomMacroService._clamp((value - vmin) / (vmax - vmin), 0.0, 1.0)

    @staticmethod
    def _clamp(value: float, vmin: float, vmax: float) -> float:
        return max(vmin, min(vmax, value))

    @staticmethod
    def _sector_id_from_name(name: str) -> str:
        cleaned = []
        for ch in name.lower():
            if ch.isalnum():
                cleaned.append(ch)
            elif ch in {" ", "-", "_", "/", "(" , ")"}:
                cleaned.append("_")
        slug = "".join(cleaned)
        while "__" in slug:
            slug = slug.replace("__", "_")
        return slug.strip("_")


telecom_macro = TelecomMacroService()
