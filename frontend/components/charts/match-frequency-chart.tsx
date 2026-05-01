"use client"

import { useMemo } from "react"
import { format } from "date-fns"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useSseEvents } from "@/hooks/use-sse"

function bucketKey(ms: number) {
  return Math.floor(ms / 60_000) * 60_000
}

export function MatchFrequencyChart() {
  const { events, status } = useSseEvents()
  const data = useMemo(() => {
    const buckets = new Map<number, number>()
    for (const e of events) {
      if (e.type !== "match") continue
      const key = bucketKey(e.received_at)
      buckets.set(key, (buckets.get(key) || 0) + 1)
    }
    const points = [...buckets.entries()]
      .sort((a, b) => a[0] - b[0])
      .slice(-60)
      .map(([t, matches]) => ({ time: format(new Date(t), "HH:mm"), matches }))
    return points
  }, [events])

  return (
    <Card className="bg-card/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_20px_60px_rgba(0,0,0,0.35)]">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm">Match Frequency</CardTitle>
        <div className="text-xs text-muted-foreground">
          SSE: {status === "open" ? "connected" : status}
        </div>
      </CardHeader>
      <CardContent className="h-[280px]">
        {data.length === 0 ? (
          <div className="grid h-full place-items-center text-sm text-muted-foreground">
            Waiting for match events…
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ left: 6, right: 6 }}>
              <defs>
                <linearGradient id="fillMatches" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="color-mix(in oklab, var(--border) 60%, transparent)" vertical={false} />
              <XAxis dataKey="time" tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={26} />
              <Tooltip
                contentStyle={{
                  background: "var(--popover)",
                  borderColor: "var(--border)",
                  borderRadius: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="matches"
                stroke="var(--chart-2)"
                fill="url(#fillMatches)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
