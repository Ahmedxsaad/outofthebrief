# NEXUS

Cross-channel media measurement: out-of-home (vision), broadcast (audio
fingerprinting), and telecom signals unified into a single live dashboard.

## Architecture

```
┌──────────────────────────── frontend/ (static, served by FastAPI) ────────┐
│  index.html  demo.html  dashboard.html                                    │
│                                                                           │
│  js/services/                                                             │
│    api.js                  — fetch wrapper (NexusAPI)                     │
│    audio-fingerprint.js    — client-side DSP (NexusFingerprint)           │
│                              mirrors core/fingerprint.py                  │
│  js/demo-app.js            — vision + mic capture + telecom               │
│  js/dashboard-app.js       — counters from /api/metrics + SSE feed        │
└────────────────────────────────────────┬──────────────────────────────────┘
                                         │ POST /api/match    (hashes)
                                         │ GET  /api/tracks
                                         │ GET  /api/metrics
                                         │ POST /api/metrics/event
                                         │ GET  /api/events   (SSE)
                                         │ GET  /api/telecom/sectors
┌────────────────────────────────────────▼──────────────────────────────────┐
│ backend/app/                                                              │
│   main.py            FastAPI, CORS, mounts /frontend, lifespan loads DB   │
│   api/               match · tracks · metrics · telecom · health          │
│   db/store.py        JSON-backed wrapper around core.matcher.HashIndex    │
│   services/          events (SSE pub/sub) · metrics · ingestion           │
│   schemas.py         Pydantic models (request/response)                   │
└────────────────────────────────────────┬──────────────────────────────────┘
                                         │
┌────────────────────────────────────────▼──────────────────────────────────┐
│ core/                  Pure-Python DSP library — single source of truth   │
│   config.py            STFT/peak/hash constants                           │
│   audio.py             load_audio (resample, mono-mix)                    │
│   fingerprint.py       log-STFT → adaptive-threshold local-max → hashes   │
│   matcher.py           HashIndex (inverted index + coherence scoring)     │
└────────────────────────────────────────┬──────────────────────────────────┘
                                         │
┌────────────────────────────────────────▼──────────────────────────────────┐
│ scripts/   generate_fingerprints.py · evaluate.py                         │
│ data/      audio_samples/*.wav · fingerprints_db/fingerprints.json        │
│            telecom_sectors.json (placeholder until NMS integration)       │
└───────────────────────────────────────────────────────────────────────────┘
```

**Data flow (live match)**
1. Browser captures 2 s mic audio.
2. `NexusFingerprint.compute()` produces ~2k constellation hashes locally.
3. POST `/api/match` with the hash array.
4. Backend looks up each hash in the inverted index (O(Q)) and picks the
   track with the largest coherent time-offset cluster (Shazam scoring).
5. Match result + confidence returned synchronously, AND broadcast on the
   SSE channel — the dashboard updates without polling.

## Running

```bash
# 1. Install
pip install -r backend/requirements.txt

# 2. Build the fingerprint DB (one-off, or whenever audio_samples/ changes)
python scripts/generate_fingerprints.py

# 3. Start the server (serves API + frontend on http://localhost:8000)
uvicorn backend.app.main:app --reload --port 8000
```

Open:
- http://localhost:8000/              — landing page
- http://localhost:8000/demo.html     — vision + audio fingerprint demo
- http://localhost:8000/dashboard.html — live dashboard
- http://localhost:8000/docs          — auto-generated OpenAPI docs

## Adding a track at runtime

```bash
curl -F "file=@my_ad.wav" -F "name=My Ad" -F "brand=Acme" \
     http://localhost:8000/api/tracks
```

This streams the WAV through the same DSP path used at build time, so
on-disk fingerprints from `scripts/generate_fingerprints.py` and
runtime-ingested fingerprints are bit-for-bit equivalent.

## Evaluation

```bash
python scripts/evaluate.py
```

Tests every reference track with clean / 2s / low-noise / heavy-noise /
high-noise (SNR ~8 dB) variants and synthetic-noise / sine-wave probes.
Reports top-1 accuracy, precision, recall, and the coherence gap between
real matches and false-positive probes.

Latest run: **88% top-1 / 100% recall**, real-vs-noise coherence gap
**4.6×**, FP probes safely below the threshold of 8.

## What changed in this transformation

### Removed (was fake)
| Was                                              | Now                                               |
|--------------------------------------------------|---------------------------------------------------|
| `assets/fingerprints.js` 363 KB blob loaded as a "DB" | DB lives in `data/fingerprints_db/`, served via API |
| `setInterval` random-walk on dashboard counters  | `/api/metrics` snapshot + SSE deltas              |
| Cycling list of canned events                    | SSE stream emits real match + impression events   |
| Sparkline jittered with `Math.random()`          | Sparkline tracks live `audio_matches` rate        |
| Telecom random-walk in two places                | One `/api/telecom/sectors` endpoint, static config|
| Demo `state.unified` derived metrics             | Single `/api/metrics` source of truth             |
| DSP duplicated inline in `demo-app.js`           | `frontend/js/services/audio-fingerprint.js`       |
| Algorithm constants in three files               | One `core/config.py`, mirrored once in JS         |

### Kept (was real)
- COCO-SSD vision (TF.js in browser)
- The Shazam-style fingerprint algorithm itself (now correctly factored)

### Honestly placeholdered
- `data/telecom_sectors.json` — replace `load_sectors()` in
  `backend/app/api/telecom.py` with a real NMS feed.
- Dashboard donut (audience demographics) — no real source yet, kept as
  a clearly static visual; remove or wire to a profile API.

## Scaling beyond the current in-memory matcher

`core.matcher.HashIndex` is a `dict[hash → list[(track_id, time)]]`.
For >1M hashes:

- Drop in Redis (one HSET per hash) or a Postgres btree on `hash`.
- Shard by `hash[:2]`, run multiple matcher pods behind nginx.
- The `db.store.FingerprintStore` is the only file that needs to change
  — the API and DSP layers don't care about backing storage.

For very high QPS:
- Move the SSE broker to Redis pub/sub.
- Cache `tracks()` metadata behind an LRU.
- Run uvicorn workers > 1 (the index is read-heavy and process-local;
  for write-after-load, switch to a shared store first).

## File map

```
core/                        signal processing (no I/O dependencies)
backend/app/                 FastAPI service
  api/                       request handlers
  db/                        storage adapter
  services/                  events, metrics, ingestion
frontend/                    static site (HTML, CSS, JS)
  js/services/               api.js, audio-fingerprint.js
scripts/                     CLI tools (build DB, benchmark)
data/                        audio + DB + config
```
