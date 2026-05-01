"use client"

import { useEffect, useMemo, useState } from "react"

import type { NexusEvent, NexusEventWithTs } from "@/types/events"

function getBaseUrl() {
  return process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:8000"
}

export function useSseEvents() {
  const [events, setEvents] = useState<NexusEventWithTs[]>([])
  const [status, setStatus] = useState<"connecting" | "open" | "closed" | "error">("connecting")

  const baseUrl = useMemo(() => getBaseUrl(), [])

  useEffect(() => {
    const src = new EventSource(`${baseUrl}/api/events`)

    src.onopen = () => setStatus("open")
    src.onerror = () => setStatus("error")
    src.onmessage = (msg) => {
      try {
        const parsed = JSON.parse(msg.data) as NexusEvent
        const wrapped: NexusEventWithTs = { ...parsed, received_at: Date.now() }
        setEvents((prev) => [wrapped, ...prev].slice(0, 250))
      } catch {
        // ignore malformed lines
      }
    }

    return () => {
      setStatus("closed")
      src.close()
    }
  }, [baseUrl])

  return { events, status }
}
