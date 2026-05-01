import { apiRequest } from "@/services/api"
import type {
  MatchResponse,
  Metrics,
  TelecomSectorsResponse,
  TracksResponse,
} from "@/types/api"

export const nexus = {
  metrics: () =>
    apiRequest<Metrics>("/api/metrics", {
      cache: "no-store",
    }),

  tracks: () =>
    apiRequest<TracksResponse>("/api/tracks", {
      cache: "no-store",
    }),

  telecomSectors: () =>
    apiRequest<TelecomSectorsResponse>("/api/telecom/sectors", {
      cache: "no-store",
    }),

  matchAudio: (file: File | Blob, filename = "audio.webm", clientId?: string) => {
    const form = new FormData()
    form.append("file", file, filename)
    if (clientId) form.append("client_id", clientId)
    return apiRequest<MatchResponse>("/api/match-audio", {
      method: "POST",
      body: form,
      cache: "no-store",
    })
  },

  reportMetricEvent: (type: "impression" | "tunein" | "profile", count = 1) =>
    apiRequest<{ ok: boolean; reason?: string }>("/api/metrics/event", {
      method: "POST",
      body: JSON.stringify({ type, count }),
      cache: "no-store",
    }),
}
