"""Backend runtime configuration. All paths resolved from project root."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

DATA_DIR              = ROOT / "data"
AUDIO_SAMPLES_DIR     = DATA_DIR / "audio_samples"
FINGERPRINTS_DB_PATH  = DATA_DIR / "fingerprints_db" / "fingerprints.json"
TELECOM_CONFIG_PATH   = DATA_DIR / "telecom_sectors.json"

FRONTEND_DIR          = ROOT / "frontend"

COHERENCE_THRESHOLD   = 8

# CORS — allow same-origin (FastAPI serves frontend) plus localhost dev tooling
ALLOWED_ORIGINS = ["http://localhost:8000", "http://127.0.0.1:8000",
                   "http://localhost:3000", "http://127.0.0.1:3000"]
