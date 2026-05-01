import { AppShell } from "@/components/app/app-shell"
import { Topbar } from "@/components/app/topbar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TracksTable } from "@/components/tracks/tracks-table"
import { nexus } from "@/services/nexus"

export default async function TracksPage() {
  const res = await nexus.tracks()

  return (
    <AppShell topbar={<Topbar title="Tracks Explorer" subtitle="Browse indexed tracks and sources" />}>
      <div className="grid gap-4">
        <Card className="bg-card/70">
          <CardHeader>
            <CardTitle className="text-sm">Index Summary</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Tracks</span>
              <span className="font-mono">{res.tracks.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Unique hashes</span>
              <span className="font-mono">{res.unique_hashes}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Total entries</span>
              <span className="font-mono">{res.total_entries}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_20px_60px_rgba(0,0,0,0.35)]">
          <CardHeader>
            <CardTitle className="text-sm">All Tracks</CardTitle>
          </CardHeader>
          <CardContent>
            <TracksTable tracks={res.tracks} />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}

