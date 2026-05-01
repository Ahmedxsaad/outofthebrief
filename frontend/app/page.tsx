import { AppShell } from "@/components/app/app-shell"
import { Topbar } from "@/components/app/topbar"
import { MatchFrequencyChart } from "@/components/charts/match-frequency-chart"
import { TelecomActivityChart } from "@/components/charts/telecom-activity-chart"
import { EventsFeed } from "@/components/metrics/events-feed"
import { OverviewCards } from "@/components/metrics/overview-cards"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { nexus } from "@/services/nexus"

async function safe<T>(fn: () => Promise<T>) {
  try {
    return { ok: true as const, data: await fn() }
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : String(err) }
  }
}

export default async function DashboardPage() {
  const [metricsRes, tracksRes, telecomRes] = await Promise.all([
    safe(() => nexus.metrics()),
    safe(() => nexus.tracks()),
    safe(() => nexus.telecomSectors()),
  ])

  const metrics =
    metricsRes.ok
      ? metricsRes.data
      : {
          audio_matches: 0,
          impressions: 0,
          tuneins: 0,
          profiles: 0,
          events_total: 0,
          uptime_sec: 0,
        }

  const tracks = tracksRes.ok ? tracksRes.data.tracks : []
  const sectors = telecomRes.ok ? telecomRes.data.sectors : []

  return (
    <AppShell
      topbar={
        <Topbar
          title="Dashboard"
          subtitle="Cross-channel measurement: audio fingerprinting + telecom telemetry"
        />
      }
    >
      {!metricsRes.ok || !tracksRes.ok || !telecomRes.ok ? (
        <Card className="mb-6 border-destructive/40 bg-card/60">
          <CardHeader>
            <CardTitle className="text-sm">Backend connection</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Set <span className="font-mono">NEXT_PUBLIC_API_URL</span> (default{" "}
            <span className="font-mono">http://localhost:8000</span>) and ensure FastAPI is running.
          </CardContent>
        </Card>
      ) : null}

      <OverviewCards
        initialMetrics={metrics}
        activeTracks={tracks.length}
        telecomSectors={sectors.length}
      />

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <MatchFrequencyChart />
        <TelecomActivityChart sectors={sectors} />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <EventsFeed />
        <Card className="bg-card/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_20px_60px_rgba(0,0,0,0.35)]">
          <CardHeader>
            <CardTitle className="text-sm">System Snapshot</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Unique hashes</span>
              <span className="font-mono">{tracksRes.ok ? tracksRes.data.unique_hashes : "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Total DB entries</span>
              <span className="font-mono">{tracksRes.ok ? tracksRes.data.total_entries : "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Telecom integration</span>
              <span className="font-mono">{telecomRes.ok ? telecomRes.data.integration_status : "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Uptime (sec)</span>
              <span className="font-mono">{metricsRes.ok ? metricsRes.data.uptime_sec : "—"}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}

