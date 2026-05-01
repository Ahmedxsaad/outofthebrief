import { notFound } from "next/navigation"

import { AppShell } from "@/components/app/app-shell"
import { Topbar } from "@/components/app/topbar"
import { TrackLiveMatches } from "@/components/tracks/track-live-matches"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { nexus } from "@/services/nexus"

export default async function TrackDetailPage({
  params,
}: {
  params: Promise<{ trackId: string }>
}) {
  const { trackId } = await params
  const res = await nexus.tracks()
  const track = res.tracks.find((t) => t.track_id === trackId)
  if (!track) return notFound()

  return (
    <AppShell topbar={<Topbar title="Track Detail" subtitle={track.name} />}>
      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="bg-card/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_20px_60px_rgba(0,0,0,0.35)]">
          <CardHeader>
            <CardTitle className="text-sm">Metadata</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Track ID</span>
              <span className="font-mono">{track.track_id}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Name</span>
              <span className="font-mono">{track.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Source</span>
              <span className="font-mono">{track.brand}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Duration</span>
              <span className="font-mono">{track.duration_sec.toFixed(1)}s</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Hash count</span>
              <span className="font-mono">{track.hash_count}</span>
            </div>
          </CardContent>
        </Card>

        <TrackLiveMatches trackId={track.track_id} />
      </div>
    </AppShell>
  )
}
