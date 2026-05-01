"use client"

import { useEffect, useMemo, useState } from "react"

import { nexus } from "@/services/nexus"
import type { Metrics } from "@/types/api"
import { useSseEvents } from "@/hooks/use-sse"

type Base = { metrics: Metrics; at: number }

export function useLiveMetrics(initial: Metrics) {
  const { events } = useSseEvents()
  const [base, setBase] = useState<Base>(() => ({ metrics: initial, at: Date.now() }))

  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const fresh = await nexus.metrics()
        setBase({ metrics: fresh, at: Date.now() })
      } catch {
        // keep last-known snapshot
      }
    }, 15_000)
    return () => clearInterval(t)
  }, [])

  const derived = useMemo(() => {
    const next: Metrics = { ...base.metrics }
    const since = base.at

    for (const e of events) {
      if (e.received_at <= since) continue
      if (e.type === "match") {
        next.audio_matches += 1
      } else if (e.type === "metric") {
        const kind = e.data.type
        const delta = Math.max(0, Number(e.data.count || 0))
        if (kind === "impression") next.impressions += delta
        if (kind === "tunein") next.tuneins += delta
        if (kind === "profile") next.profiles += delta
      }
    }

    next.events_total = next.audio_matches + next.impressions + next.tuneins
    return next
  }, [base, events])

  return derived
}

