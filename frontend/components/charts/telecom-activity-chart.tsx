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

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { TelecomSector } from "@/types/api"

export function TelecomActivityChart({ sectors }: { sectors: TelecomSector[] }) {
  const data = sectors.map((s) => ({
    name: s.name,
    capacity: Math.round(s.capacity_pct * 10) / 10,
    ci: Math.round(s.ci_db * 10) / 10,
  }))

  return (
    <Card className="bg-card/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_20px_60px_rgba(0,0,0,0.35)]">
      <CardHeader>
        <CardTitle className="text-sm">Telecom Activity</CardTitle>
      </CardHeader>
      <CardContent className="h-[280px]">
        {data.length === 0 ? (
          <div className="grid h-full place-items-center text-sm text-muted-foreground">
            No sector telemetry available.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ left: 6, right: 6 }}>
              <CartesianGrid stroke="color-mix(in oklab, var(--border) 60%, transparent)" vertical={false} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} hide />
              <YAxis tickLine={false} axisLine={false} width={34} />
              <Tooltip
                contentStyle={{
                  background: "var(--popover)",
                  borderColor: "var(--border)",
                  borderRadius: 12,
                }}
                formatter={(v, k) => [v, k === "capacity" ? "Capacity %" : "CI (dB)"]}
                labelFormatter={(label) => `Sector: ${label}`}
              />
              <Bar dataKey="capacity" fill="var(--chart-2)" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}

