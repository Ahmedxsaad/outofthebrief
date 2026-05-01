"use client"

import { AudioLines, RadioTower, Layers, Activity } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Metrics } from "@/types/api"
import { useLiveMetrics } from "@/components/metrics/live-metrics"

function StatCard({
  title,
  value,
  icon: Icon,
  hint,
}: {
  title: string
  value: string | number
  icon: React.ComponentType<{ className?: string }>
  hint?: string
}) {
  return (
    <Card className="bg-card/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_20px_60px_rgba(0,0,0,0.35)]">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tracking-tight">{value}</div>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  )
}

export function OverviewCards({
  initialMetrics,
  activeTracks,
  telecomSectors,
}: {
  initialMetrics: Metrics
  activeTracks: number
  telecomSectors: number
}) {
  const metrics = useLiveMetrics(initialMetrics)

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <StatCard
        title="Total Matches"
        value={metrics.audio_matches}
        hint="Real-time from SSE + snapshot"
        icon={AudioLines}
      />
      <StatCard title="Active Tracks" value={activeTracks} hint="Indexed & matchable" icon={Layers} />
      <StatCard
        title="Telecom Metrics"
        value={telecomSectors}
        hint="Configured sectors (live feed pending)"
        icon={RadioTower}
      />
      <StatCard title="System Events" value={metrics.events_total} hint="Matches + impressions + tune-ins" icon={Activity} />
    </div>
  )
}

