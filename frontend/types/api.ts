export type MatchResponse = {
  matched: boolean
  track_id?: string | null
  track_name?: string | null
  brand?: string | null
  coherence: number
  total_hits: number
  confidence: number
  time_offset_frames: number
  query_hash_count: number
}

export type TrackSummary = {
  track_id: string
  name: string
  brand: string
  duration_sec: number
  hash_count: number
}

export type TracksResponse = {
  tracks: TrackSummary[]
  unique_hashes: number
  total_entries: number
}

export type Metrics = {
  audio_matches: number
  impressions: number
  tuneins: number
  profiles: number
  events_total: number
  uptime_sec: number
}

export type TelecomSector = {
  name: string
  capacity_pct: number
  ci_db: number
}

export type TelecomSectorsResponse = {
  sectors: TelecomSector[]
  integration_status: string
}

