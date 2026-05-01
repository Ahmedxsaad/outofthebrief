import { AppShell } from "@/components/app/app-shell"
import { Topbar } from "@/components/app/topbar"
import { OverviewCards } from "@/components/metrics/overview-cards"
import { MetricsConsole } from "@/components/metrics/metrics-console"
import { EventsFeed } from "@/components/metrics/events-feed"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { nexus } from "@/services/nexus"

export default async function MetricsPage() {
  const [metrics, tracks, telecom] = await Promise.all([nexus.metrics(), nexus.tracks(), nexus.telecomSectors()])

  return (
    <AppShell topbar={<Topbar title="Metrics" subtitle="System counters, SSE stream, and evaluation workflow" />}>
      <OverviewCards
        initialMetrics={metrics}
        activeTracks={tracks.tracks.length}
        telecomSectors={telecom.sectors.length}
      />

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <MetricsConsole />
        <EventsFeed />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <Card className="bg-card/70">
          <CardHeader>
            <CardTitle className="text-sm">Performance Snapshot</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Uptime (sec)</span>
              <span className="font-mono">{metrics.uptime_sec}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Events total</span>
              <span className="font-mono">{metrics.events_total}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/70">
          <CardHeader>
            <CardTitle className="text-sm">Evaluation</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Evaluation currently runs as a CLI script and prints a report:
            <div className="mt-3 rounded-xl border border-border/50 bg-card/40 px-3 py-2 font-mono text-xs">
              python scripts/evaluate.py
            </div>
            <div className="mt-3">
              If you want this page to render evaluation output automatically, add an API endpoint in FastAPI (not done
              here per project constraints).
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
