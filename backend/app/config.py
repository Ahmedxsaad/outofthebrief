"""Backend runtime configuration. All paths resolved from project root."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

DATA_DIR              = ROOT / "data"
AUDIO_SAMPLES_DIR     = DATA_DIR / "audio_samples"
FINGERPRINTS_DB_PATH  = DATA_DIR / "fingerprints_db" / "fingerprints.json"
TELECOM_CONFIG_PATH   = DATA_DIR / "telecom_sectors.json"

FRONTEND_DIR          = ROOT / "frontend"

COHERENCE_THRESHOLD   = 8

# Telecom macro feature configuration
TELECOM_STALE_TTL_SEC = 45
TELECOM_CAPACITY_MIN = 0.0
TELECOM_CAPACITY_MAX = 100.0
TELECOM_CI_MIN_DB = 0.0
TELECOM_CI_MAX_DB = 30.0
TELECOM_DENSITY_MIN = 0.0
TELECOM_DENSITY_MAX = 100.0
TELECOM_WEIGHT_CAPACITY = 0.65
TELECOM_WEIGHT_CI = 0.35
TELECOM_GLOBAL_CALIBRATION = 1.0
TELECOM_INGEST_TOKEN = None

# CORS — allow same-origin (FastAPI serves frontend) plus localhost dev tooling
ALLOWED_ORIGINS = ["http://localhost:8000", "http://127.0.0.1:8000",
                   "http://localhost:3000", "http://127.0.0.1:3000"]
