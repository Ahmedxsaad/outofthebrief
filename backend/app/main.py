"""FastAPI application.

Single-process: serves both `/api/*` JSON endpoints and the static
frontend (`/`, `/demo.html`, `/dashboard.html`, asset paths). One port,
no CORS friction in dev.
"""
from contextlib import asynccontextmanager
import json
import sys
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

# Ensure parent directory is in path so 'core' module can be imported
_PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

from .api import health, match, metrics, telecom, tracks
from .config import ALLOWED_ORIGINS, FINGERPRINTS_DB_PATH, FRONTEND_DIR, TELECOM_CONFIG_PATH
from .db.store import FingerprintStore
from .schemas import TelecomSector
from .services.telecom_macro import telecom_macro


@asynccontextmanager
async def lifespan(app: FastAPI):
    store = FingerprintStore(FINGERPRINTS_DB_PATH)
    store.load()
    app.state.store = store
    if TELECOM_CONFIG_PATH.exists():
        with open(TELECOM_CONFIG_PATH) as f:
            raw = json.load(f)
        sectors = [TelecomSector(**s) for s in raw]
        telecom_macro.seed_from_static(sectors)
    yield


app = FastAPI(title="NEXUS API", version="2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routes — registered before static mount so they take precedence
app.include_router(health.router)
app.include_router(match.router)
app.include_router(tracks.router)
app.include_router(metrics.router)
app.include_router(telecom.router)

# Mount the frontend at the root. `html=True` makes `/` serve `index.html`
# and unknown paths fall through to 404 (not the SPA fallback — we don't
# need that here).
if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")
