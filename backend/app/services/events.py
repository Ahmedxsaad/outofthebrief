"""In-process pub/sub for Server-Sent Events.

Each connected SSE client gets its own asyncio.Queue. The match endpoint
calls `publish()` after a successful match; SSE handlers iterate their
queue and forward to the wire. No external broker — fine for single-node;
swap with Redis pub/sub when horizontally scaling.
"""
from __future__ import annotations

import asyncio
import json
from typing import AsyncIterator


class EventBroker:
    def __init__(self) -> None:
        self._subscribers: set[asyncio.Queue] = set()

    async def subscribe(self) -> AsyncIterator[str]:
        q: asyncio.Queue = asyncio.Queue(maxsize=128)
        self._subscribers.add(q)
        try:
            while True:
                payload = await q.get()
                yield f"data: {payload}\n\n"
        finally:
            self._subscribers.discard(q)

    def publish(self, event_type: str, data: dict) -> None:
        payload = json.dumps({"type": event_type, "data": data})
        for q in list(self._subscribers):
            try:
                q.put_nowait(payload)
            except asyncio.QueueFull:
                # Drop on slow consumer rather than block the producer
                pass


broker = EventBroker()
