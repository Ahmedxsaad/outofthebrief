"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import type { TunisianProfile } from "@/lib/tunisia-profiles"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

function avg(profiles: TunisianProfile[], get: (p: TunisianProfile) => number) {
  if (!profiles.length) return 0
  return profiles.reduce((acc, p) => acc + get(p), 0) / profiles.length
}

export function ChannelRoiChart({ profiles }: { profiles: TunisianProfile[] }) {
  const data = [
    {
      channel: "Billboards",
      score: Math.round(avg(profiles, (p) => p.offline_ads_roi_score.billboards) * 10) / 10,
    },
    { channel: "TV", score: Math.round(avg(profiles, (p) => p.offline_ads_roi_score.tv) * 10) / 10 },
    {
      channel: "Radio",
      score: Math.round(avg(profiles, (p) => p.offline_ads_roi_score.radio) * 10) / 10,
    },
  ]

  return (
    <Card className="bg-card/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_20px_60px_rgba(0,0,0,0.35)]">
      <CardHeader>
        <CardTitle className="text-sm">Average Offline Ads ROI Score</CardTitle>
      </CardHeader>
      <CardContent className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ left: 6, right: 6 }}>
            <CartesianGrid stroke="color-mix(in oklab, var(--border) 60%, transparent)" vertical={false} />
            <XAxis dataKey="channel" tickLine={false} axisLine={false} />
            <YAxis domain={[0, 100]} tickLine={false} axisLine={false} width={34} />
            <Tooltip
              contentStyle={{
                background: "var(--popover)",
                borderColor: "var(--border)",
                borderRadius: 12,
              }}
              formatter={(v) => [v, "Score (0–100)"]}
            />
            <Bar dataKey="score" fill="var(--chart-2)" radius={[10, 10, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

