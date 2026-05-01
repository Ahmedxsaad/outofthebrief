"""Metrics + SSE event stream."""
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

from ..schemas import Metrics as MetricsSchema
from ..services.events import broker
from ..services.metrics import metrics

router = APIRouter(prefix="/api", tags=["metrics"])


@router.get("/metrics", response_model=MetricsSchema)
def get_metrics():
    return metrics.snapshot()


@router.post("/metrics/event")
async def report_event(request: Request):
    """Frontend vision/impression events flow back here so the dashboard
    is driven by the same single source of truth as audio matches."""
    body = await request.json()
    kind = body.get("type")
    delta = max(0, int(body.get("count", 1)))
    if kind == "impression":
        metrics.increment(impressions=delta)
    elif kind == "tunein":
        metrics.increment(tuneins=delta)
    elif kind == "profile":
        metrics.increment(profiles=delta)
    else:
        return {"ok": False, "reason": "unknown type"}
    broker.publish("metric", {"type": kind, "count": delta,
                              "totals": metrics.snapshot()})
    return {"ok": True}


@router.get("/events")
async def stream_events():
    """Server-Sent Events stream. Replaces frontend polling/random walks."""
    return StreamingResponse(broker.subscribe(), media_type="text/event-stream")
