"""NEXUS audio fingerprinting core library.

Single source of truth for the DSP pipeline. Used by:
  - backend/app/services/matcher.py  (live matching)
  - scripts/generate_fingerprints.py (offline DB build)
  - scripts/evaluate.py              (benchmarks)

The browser-side JS implementation in
frontend/js/services/audio-fingerprint.js MUST mirror the constants
in `core.config` and the algorithm in `core.fingerprint`.
"""
from . import config, audio, fingerprint, matcher  # noqa: F401
