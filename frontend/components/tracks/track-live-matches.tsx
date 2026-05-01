"use client"

import { useMemo } from "react"

import { useSseEvents } from "@/hooks/use-sse"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { NexusEventWithTs } from "@/types/events"

export function TrackLiveMatches({ trackId }: { trackId: string }) {
  const { events, status } = useSseEvents()

  const matches = useMemo(() => {
    const isForTrack = (
      e: NexusEventWithTs,
    ): e is Extract<NexusEventWithTs, { type: "match" }> =>
      e.type === "match" && e.data.track_id === trackId
    return events.filter(isForTrack).slice(0, 10)
  }, [events, trackId])

  return (
    <Card className="bg-card/70">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm">Live Matches</CardTitle>
        <div className="text-xs text-muted-foreground">SSE: {status}</div>
      </CardHeader>
      <CardContent className="grid gap-2 text-sm">
        {matches.length === 0 ? (
          <div className="text-muted-foreground">No live matches for this track yet.</div>
        ) : (
          matches.map((m) => (
            <div
              key={m.received_at}
              className="flex items-center justify-between rounded-xl border border-border/50 bg-card/40 px-3 py-2"
            >
              <div className="min-w-0">
                <div className="truncate font-medium">{m.data.track_name}</div>
                <div className="text-xs text-muted-foreground font-mono">{m.data.brand || "—"}</div>
              </div>
              <Badge className="font-mono">conf {m.data.confidence}</Badge>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
