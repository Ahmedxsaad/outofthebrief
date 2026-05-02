# Nexus

> **Real-time measurement & visualization of offline media in Tunisia.**
> A hybrid hardware-software stack that turns billboards, TV, and radio
> into addressable, performance-grade ad inventory.

<p align="center">
  <img src="docs/hero.png" alt="Vehicle profiling demo — YOLOv11 + ByteTrack + Gemini identifying make / model / segment / price in real Tunisian traffic footage" />
  <br/>
  <sub><i>OOH ground-truth vision: YOLOv11x + ByteTrack + Gemini Flash Lite identifying make, model, body type, segment, and price for every unique vehicle.</i></sub>
</p>

## Why Nexus

Tunisian offline media (TV, Radio, Out-Of-Home) is measured the way it
was measured twenty years ago: delayed, declarative, panel-based.
Advertisers paying real money on billboards and ad slots don't get the
performance-driven feedback loop that digital advertising takes for
granted — clicks, impressions, attribution, retargeting.

**Nexus closes that gap.** It unifies three independent measurement
pillars — vision, telecom, and acoustic fingerprinting — into a single
real-time dashboard, and chains them together for the first
cross-channel attribution funnel for offline media in the country.

> Hackathon brief: *Thématique 1 — The future of media in Tunisia.*

## The three pillars

### A · OOH Hybrid Tracker — Vision + Telecom

Measuring billboards needs both **ground-truth accuracy** and
**nationwide reach**. We get both by combining two layers:

- **Micro (ground truth).** Low-cost Computer-Vision edge nodes
  (Raspberry Pi + camera) running YOLO locally on the device. Frames
  are processed in-place and **discarded immediately**; only counts and
  estimated demographics leave the device, so the system is privacy-
  compliant by construction. → [`pi_vehicle_detection/`](pi_vehicle_detection)
- **Macro (nationwide).** Each billboard's GPS coordinates are mapped
  to the cellular cell sectors that physically cover it. We then read
  per-sector telemetry — **carrier capacity utilisation** and the
  **Carrier-to-Interference (C/I) ratio** — to estimate audience
  density without deploying hardware at every billboard.

  ```
  D = f(Capacity_used, C/I)            (clamped to [0, 100])
  D = (0.65 · cap_norm + 0.35 · (1 − ci_norm)) · calibration
  ```

  The micro layer continuously **calibrates** the macro model, so
  cellular density estimates stay anchored to real footfall counts. →
  [`backend/app/api/telecom.py`](backend/app/api/telecom.py)

There is also an **offline R&D pipeline** that goes beyond counting —
[`vehicle_profiling/`](vehicle_profiling) uses YOLOv11 + ByteTrack for
persistent multi-object tracking and Gemini Flash Lite to identify
each unique vehicle's *make, model, body type, era, segment, and
ballpark price*. This unlocks vehicle-segment-aware OOH reporting
("today this billboard was seen by 2 100 economy cars and 340 luxury
SUVs") that no panel-based system in the region can produce.

### B · Ambient Audio Fingerprinting — TV & Radio

A 2-second hash captured in the user's environment, matched against
live streams of every Tunisian TV and radio broadcaster.

- **Core.** The browser/phone records 2 s of mic audio, computes a
  ~2 k constellation-hash fingerprint locally
  ([`core/fingerprint.py`](core/fingerprint.py) — mirrored bit-for-bit
  in [`frontend/services/audio-fingerprint.js`](frontend)), and POSTs
  the hashes to `/api/match`. The server picks the track with the
  largest coherent time-offset cluster (Shazam-style), publishes on
  SSE, and returns a synchronous match + confidence.
- **Distribution Strategy 1 — Trojan-Horse B2C app.** A gamified
  consumer app that rewards users (phone credit, promo codes,
  show-specific live chat rooms) for opening it while watching/
  listening. Greed and FOMO grant mic access and drive DAUs.
- **Distribution Strategy 2 — Embedded SDK as a service.** The same
  2-second hashing protocol shipped as a drop-in SDK that already-
  existing Tunisian apps (news, weather, banking, e-commerce, ride-
  hailing, transit, utilities, sports) integrate the way they already
  integrate analytics or push-notification SDKs. The SDK runs the hash
  passively in the background — no user effort, no UX disruption — and
  publishes only the hash, never raw audio.

  Crucially, **the panel's representativeness is a direct function of
  the partnership portfolio**: each integration partner brings their
  user base's specific demographic and geographic profile. News apps
  skew older and politically-engaged; ride-hailing skews urban and
  working-age; banking apps reach white-collar segments; sports apps
  reach young men; utility apps reach household decision-makers. The
  more diverse the partnership mix, the closer the resulting panel
  converges on a true cross-section of the Tunisian population — and
  the more credible the rating numbers that come out of it. Building
  the partnership network is therefore a first-class product workstream,
  not an afterthought.

**Latest evaluation:** 88 % top-1 accuracy · 100 % recall · 4.6 ×
coherence gap between real matches and noise probes.

### C · Progressive User Profiling

Raw impressions are useful; *demographic* impressions are what
advertisers pay for.

- **Onboarding.** Age + gender at sign-up in exchange for a bonus.
- **Contextual micro-surveys.** When the audio SDK matches a specific
  TV programme, the app fires a one-tap survey — *"Do you own a car?
  Yes / No for 50 extra points"* — building a deterministic, highly
  granular audience database that traditional declarative panels
  (where users self-report a week later) simply cannot match.

## Killer feature — cross-channel attribution

The three pillars together turn into the first real **offline →
online** attribution funnel in Tunisia:

```
14:00  Telecom macro detects user's device in the high-density cell
       zone facing a Tunisie Telecom billboard on Route X.

20:30  Audio SDK on the same user's phone hashes the evening news
       and matches the same brand's TV commercial.

20:31  Nexus fires a push notification with a targeted promo code.
       The offline impression converts into an online sale —
       measurable, attributable, and billable end-to-end.
```

Every legacy OOH and broadcast measurement vendor stops at step 1 or
step 2 in isolation. Nexus is the loop.

## Partnership & feasibility

The macro-telecom layer depends on access to per-sector capacity and
C/I telemetry. **In discussions with Tunisie Telecom**, the operator
confirmed that real-time cell-sector population density data
(*"how many people are in this zone right now"*) is technically
available and can be exposed to qualified partners — explicitly
including integrators like **3GS Group**, through whom the telemetry
feed can be productised. This validates the macro pillar end-to-end:
the pipeline we ship in [`backend/app/api/telecom.py`](backend/app/api/telecom.py)
is ready to consume the same telemetry once the partnership channel is
live, with the static JSON in [`data/telecom_sectors.json`](data) as
the staging fixture in the meantime.

## Modules

| Path | What it does |
|---|---|
| [`backend/`](backend) | FastAPI service — `/api/match`, `/api/tracks`, `/api/metrics`, `/api/telecom`, SSE event stream |
| [`core/`](core) | Pure-Python DSP — STFT → constellation hashes → coherence-scored matcher |
| [`frontend/`](frontend) | Next.js app (landing · demo · live dashboard) |
| [`mobile/`](mobile) | B2C companion app (the Trojan-Horse distribution strategy) |
| [`scripts/`](scripts) | CLI tools — build the fingerprint DB, evaluation, synthetic tests |
| [`data/`](data) | Reference audio, fingerprint DB, telecom sector config |
| [`pi_vehicle_detection/`](pi_vehicle_detection) | Edge live counter (Raspberry Pi + MobileNet-SSD, ~3–10 FPS) |
| [`vehicle_profiling/`](vehicle_profiling) | Offline YOLOv11 + ByteTrack + Gemini make/model/segment/price pipeline |
| [`docs/`](docs) | Architecture diagrams ([`Nexus_Architecture.pdf`](docs/Nexus_Architecture.pdf)) |

## Quick start

```bash
pip install -r backend/requirements.txt
python scripts/generate_fingerprints.py       # build the DB once
uvicorn backend.app.main:app --reload --port 8000
```

Then open:

- <http://localhost:8000/> — landing page
- <http://localhost:8000/demo.html> — vision + audio demo
- <http://localhost:8000/dashboard.html> — live dashboard
- <http://localhost:8000/docs> — auto-generated OpenAPI

```bash
# Add a track at runtime — same DSP path as the offline build
curl -F "file=@my_ad.wav" -F "name=My Ad" -F "brand=Acme" \
     http://localhost:8000/api/tracks

# Run the full evaluation suite
python scripts/evaluate.py
```

## Telecom API — quick reference

```bash
# Ingest live sector telemetry
curl -X POST http://localhost:8000/api/telecom/ingest \
  -H "Content-Type: application/json" \
  -d '{"timestamp":1714550400,"sectors":[
        {"sector_id":"tunis_a","name":"Tunis A",
         "capacity_used_pct":87.5,"ci_db":12.4,"calibration":1.05}
      ]}'

# Map billboards to one or more sectors with weights
curl -X POST http://localhost:8000/api/telecom/mappings \
  -H "Content-Type: application/json" \
  -d '{"mappings":[
        {"billboard_id":"bb_01","sector_id":"tunis_centre_a","weight":0.8},
        {"billboard_id":"bb_01","sector_id":"tunis_centre_b","weight":0.2}
      ]}'

# Query sector or per-billboard density
curl http://localhost:8000/api/telecom/macro          | jq .
curl http://localhost:8000/api/telecom/billboards/bb_01 | jq .
```

Status lifecycle: `static_config` → `live` (first ingest) → `stale`
(no update for `TELECOM_STALE_TTL_SEC = 45 s`). All thresholds and
formula weights live in [`backend/app/config.py`](backend/app/config.py).

## Architecture

Full diagram: [`docs/Nexus_Architecture.pdf`](docs/Nexus_Architecture.pdf).

```
┌──────────── frontend/ ─────────────┐
│  index.html · demo.html · dashboard│
└─────────────────┬──────────────────┘
                  │ /api/match · /api/tracks · /api/metrics
                  │ /api/telecom · /api/events (SSE)
┌─────────────────▼──────────────────┐
│ backend/app/   FastAPI + CORS + SSE│
│   api/   db/store   services/      │
└─────────────────┬──────────────────┘
                  │
┌─────────────────▼──────────────────┐
│ core/    STFT → hashes → matcher   │
└─────────────────┬──────────────────┘
                  │
┌─────────────────▼──────────────────┐
│ scripts/  data/   CLI + fixtures   │
└────────────────────────────────────┘
```

## Scaling notes

`core.matcher.HashIndex` is `dict[hash → list[(track_id, time)]]`.
For &gt; 1 M hashes, swap the in-memory dict for Redis (one `HSET`
per hash) or Postgres with a btree on `hash` —
[`db.store.FingerprintStore`](backend) is the only adapter the API
and DSP layers see, so the change is local. At high QPS, move the
SSE broker to Redis pub/sub and run uvicorn with `--workers > 1`.

For the macro-telecom pipeline, [`backend/app/api/telecom.py`](backend/app/api/telecom.py)
already reads sector fixtures from [`data/telecom_sectors.json`](data);
swap the loader to a streaming consumer (Kafka / NATS) when the live
3GS Group / Tunisie Telecom feed is available — no schema change.
