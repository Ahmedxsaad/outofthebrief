"""Telecom sectors endpoint.

This is currently backed by a static JSON config file. Real integration
with the operator's NMS / RAN telemetry feed should replace
`load_sectors()` with a live pull (or push from the NMS into a queue).
"""
import json

from fastapi import APIRouter

from ..config import TELECOM_CONFIG_PATH
from ..schemas import TelecomSector, TelecomSectorsResponse

router = APIRouter(prefix="/api", tags=["telecom"])


def load_sectors() -> list[TelecomSector]:
    if not TELECOM_CONFIG_PATH.exists():
        return []
    with open(TELECOM_CONFIG_PATH) as f:
        raw = json.load(f)
    return [TelecomSector(**s) for s in raw]


@router.get("/telecom/sectors", response_model=TelecomSectorsResponse)
def get_sectors():
    return TelecomSectorsResponse(
        sectors=load_sectors(),
        # Honest about provenance — frontend can show a "static config" badge
        integration_status="static_config",
    )
