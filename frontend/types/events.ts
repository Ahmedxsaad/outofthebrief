export type NexusEvent =
  | { type: "match"; data: MatchEventData }
  | { type: "metric"; data: MetricEventData }

export type NexusEventWithTs = NexusEvent & { received_at: number }

export type MatchEventData = {
  track_id: string
  track_name: string
  brand?: string
  confidence: number
  client_id?: string | null
}

export type MetricEventData = {
  type: "impression" | "tunein" | "profile"
  count: number
  totals?: unknown
}
