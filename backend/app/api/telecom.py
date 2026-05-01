"""Telecom macro endpoints."""
from fastapi import APIRouter, HTTPException, Request

from ..config import TELECOM_INGEST_TOKEN
from ..schemas import (
    BillboardMacroDensity,
    BillboardMappingUpsertRequest,
    TelecomIngestRequest,
    TelecomMacroResponse,
    TelecomSectorsResponse,
)
from ..services.events import broker
from ..services.telecom_macro import telecom_macro

router = APIRouter(prefix="/api", tags=["telecom"])


@router.post("/telecom/ingest")
def ingest_telecom(request: Request, body: TelecomIngestRequest):
    if TELECOM_INGEST_TOKEN and request.headers.get("X-Nexus-Token") != TELECOM_INGEST_TOKEN:
        raise HTTPException(status_code=401, detail="invalid token")
    telecom_macro.ingest(body.sectors, body.timestamp)
    macro = telecom_macro.get_macro_response()
    broker.publish("telecom_macro", {
        "status": macro.integration_status,
        "updated_at": macro.updated_at,
        "sector_count": len(macro.sectors),
    })
    return {"ok": True, "received": len(body.sectors), "status": macro.integration_status}


@router.post("/telecom/mappings")
def upsert_billboard_mappings(body: BillboardMappingUpsertRequest):
    telecom_macro.upsert_mappings(body.mappings)
    broker.publish("telecom_mapping", {"count": len(body.mappings)})
    return {"ok": True, "count": len(body.mappings)}


@router.get("/telecom/macro", response_model=TelecomMacroResponse)
def get_macro():
    return telecom_macro.get_macro_response()


@router.get("/telecom/billboards/{billboard_id}", response_model=BillboardMacroDensity)
def get_billboard_macro(billboard_id: str):
    result = telecom_macro.get_billboard_density(billboard_id)
    if not result:
        raise HTTPException(status_code=404, detail="unknown billboard")
    return result


@router.get("/telecom/sectors", response_model=TelecomSectorsResponse)
def get_sectors():
    macro = telecom_macro.get_macro_response()
    return TelecomSectorsResponse(
        sectors=telecom_macro.get_sectors_compat(),
        integration_status=macro.integration_status,
    )
