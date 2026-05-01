"""FastAPI application.

Single-process: serves both `/api/*` JSON endpoints and the static
frontend (`/`, `/demo.html`, `/dashboard.html`, asset paths). One port,
no CORS friction in dev.
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .api import health, match, metrics, telecom, tracks
from .config import ALLOWED_ORIGINS, FINGERPRINTS_DB_PATH, FRONTEND_DIR
from .db.store import FingerprintStore


@asynccontextmanager
async def lifespan(app: FastAPI):
    store = FingerprintStore(FINGERPRINTS_DB_PATH)
    store.load()
    app.state.store = store
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
