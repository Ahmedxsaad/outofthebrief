"""Process-wide counters. All increments come from real event sources."""
from __future__ import annotations

import time
from threading import Lock


class Metrics:
    def __init__(self) -> None:
        self._lock = Lock()
        self._started_at = time.time()
        self.audio_matches = 0
        self.impressions   = 0   # incremented externally by frontend vision events
        self.tuneins       = 0   # alias for unique-listener events
        self.profiles      = 0   # incremented when a new client_id is seen

    def increment(self, **kwargs: int) -> None:
        with self._lock:
            for k, v in kwargs.items():
                setattr(self, k, getattr(self, k) + v)

    @property
    def events_total(self) -> int:
        return self.audio_matches + self.impressions + self.tuneins

    @property
    def uptime_sec(self) -> float:
        return time.time() - self._started_at

    def snapshot(self) -> dict:
        return {
            "audio_matches": self.audio_matches,
            "impressions":   self.impressions,
            "tuneins":       self.tuneins,
            "profiles":      self.profiles,
            "events_total":  self.events_total,
            "uptime_sec":    round(self.uptime_sec, 2),
        }


metrics = Metrics()
