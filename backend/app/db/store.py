"""Persistent JSON-backed wrapper around `core.matcher.HashIndex`.

Loads the DB on startup. Adding new tracks updates both memory and disk.
For >1M hashes, swap the JSON layer for a real KV store (RocksDB, Redis,
PostgreSQL with btree on `hash`) without changing the API.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Iterable, Tuple

from core.matcher import HashIndex


class FingerprintStore:
    def __init__(self, db_path: Path):
        self.path: Path = db_path
        self.index: HashIndex = HashIndex()
        self._meta: dict = {}

    # ── Persistence ───────────────────────────────────────────────────────

    def load(self) -> None:
        """Load DB from disk into the in-memory inverted index."""
        if not self.path.exists():
            print(f"[store] no DB at {self.path}, starting empty")
            return

        with open(self.path) as f:
            doc = json.load(f)
        self._meta = {k: v for k, v in doc.items() if k != "fingerprints"}

        for fp in doc.get("fingerprints", []):
            tid = fp.get("track_id") or fp["name"]
            hashes: list[Tuple[str, int]] = [(h["hash"], h["time"]) for h in fp["hashes"]]
            self.index.add_track(
                tid, hashes,
                meta={"name": fp["name"], "brand": fp.get("brand", ""),
                      "duration": fp.get("duration", 0.0),
                      "hash_count": len(hashes)},
            )
        print(f"[store] loaded {self.index.track_count} tracks, "
              f"{self.index.unique_hashes} unique hashes "
              f"({self.index.total_entries} entries)")

    def save(self) -> None:
        """Serialize the in-memory index back to disk."""
        # Rebuild from index — keeps a single source of truth
        fps = []
        per_track_hashes: dict[str, list] = {tid: [] for tid in self.index.tracks()}
        # `_table` is private but stable in this module.
        for h, entries in self.index._table.items():           # noqa: SLF001
            for tid, t in entries:
                per_track_hashes[tid].append({"hash": h, "time": t})

        for tid, meta in self.index.tracks().items():
            fps.append({"track_id": tid, **meta, "hashes": per_track_hashes[tid]})

        doc = {**self._meta, "fingerprints": fps}
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with open(self.path, "w") as f:
            json.dump(doc, f)

    # ── Mutation ──────────────────────────────────────────────────────────

    def add_track(self, track_id: str, hashes: Iterable[Tuple[str, int]],
                  meta: dict) -> None:
        self.index.add_track(track_id, hashes, meta)
        self.save()
