"""Hash-table matcher with time-offset coherence scoring.

Lookup is O(Q) where Q is the number of query hashes (independent of DB
size beyond per-hash collisions). Coherence = the size of the largest
time-offset cluster, the same scoring Shazam describes in their paper.
"""
from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from typing import Dict, Iterable, List, Tuple

Hash = Tuple[str, int]


@dataclass
class MatchResult:
    track_id: str | None
    coherence: int
    total_hits: int
    confidence: float       # 0.0–1.0
    time_offset: int        # frames; useful for "where in the track"


class HashIndex:
    """In-memory inverted index: hash → [(track_id, anchor_time)]."""

    def __init__(self) -> None:
        self._table: Dict[str, List[Tuple[str, int]]] = defaultdict(list)
        self._tracks: Dict[str, dict] = {}

    # ── Index management ──────────────────────────────────────────────────

    def add_track(self, track_id: str, hashes: Iterable[Hash], meta: dict) -> None:
        if track_id in self._tracks:
            raise ValueError(f"track {track_id} already indexed")
        self._tracks[track_id] = meta
        for h, t in hashes:
            self._table[h].append((track_id, t))

    @property
    def track_count(self) -> int:
        return len(self._tracks)

    @property
    def unique_hashes(self) -> int:
        return len(self._table)

    @property
    def total_entries(self) -> int:
        return sum(len(v) for v in self._table.values())

    def tracks(self) -> Dict[str, dict]:
        return dict(self._tracks)

    # ── Matching ──────────────────────────────────────────────────────────

    def match(self, query: Iterable[Hash],
              coherence_threshold: int = 8) -> MatchResult:
        """Return the best matching track in the index for `query`."""
        hits: Dict[str, int] = defaultdict(int)
        deltas: Dict[str, Dict[int, int]] = defaultdict(lambda: defaultdict(int))

        for qh, qt in query:
            for tid, rt in self._table.get(qh, ()):
                hits[tid] += 1
                deltas[tid][round(rt - qt)] += 1

        if not hits:
            return MatchResult(None, 0, 0, 0.0, 0)

        best_tid = max(hits, key=lambda t: max(deltas[t].values()))
        best_offset, best_coh = max(deltas[best_tid].items(), key=lambda kv: kv[1])
        total_hits = hits[best_tid]

        if best_coh < coherence_threshold:
            return MatchResult(None, best_coh, total_hits, 0.0, best_offset)

        # Confidence — log scaling against threshold, capped at 0.99
        import math
        confidence = min(0.99,
                         0.55 + math.log10(max(best_coh / coherence_threshold, 1)) * 0.35)
        return MatchResult(best_tid, best_coh, total_hits, confidence, best_offset)
