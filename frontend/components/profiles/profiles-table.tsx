"use client"

import { useMemo, useState } from "react"

import type { TunisianProfile } from "@/lib/tunisia-profiles"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type Channel = "billboards" | "tv" | "radio"

function fmtTnd(v: number) {
  return `${Math.round(v).toLocaleString()}`
}

function bestChannel(p: TunisianProfile): Channel {
  const entries: Array<[Channel, number]> = [
    ["billboards", p.offline_ads_roi_score.billboards],
    ["tv", p.offline_ads_roi_score.tv],
    ["radio", p.offline_ads_roi_score.radio],
  ]
  entries.sort((a, b) => b[1] - a[1])
  return entries[0][0]
}

function label(ch: Channel) {
  if (ch === "billboards") return "Billboards"
  if (ch === "tv") return "TV"
  return "Radio"
}

export function ProfilesTable({ profiles }: { profiles: TunisianProfile[] }) {
  const [q, setQ] = useState("")

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return profiles
    return profiles.filter((p) =>
      `${p.name} ${p.city} ${p.governorate} ${p.segment} ${p.id}`.toLowerCase().includes(s),
    )
  }, [profiles, q])

  const ranked = useMemo(() => {
    const rows = [...filtered]
    rows.sort((a, b) => {
      const aBest = Math.max(
        a.expected_revenue_uplift_tnd.billboards,
        a.expected_revenue_uplift_tnd.tv,
        a.expected_revenue_uplift_tnd.radio,
      )
      const bBest = Math.max(
        b.expected_revenue_uplift_tnd.billboards,
        b.expected_revenue_uplift_tnd.tv,
        b.expected_revenue_uplift_tnd.radio,
      )
      return bBest - aBest
    })
    return rows
  }, [filtered])

  return (
    <div className="grid gap-3">
      <Input
        placeholder="Search Tunisian profiles (name, city, segment)…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="rounded-xl border border-border/50 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Profile</TableHead>
              <TableHead>Segment</TableHead>
              <TableHead className="w-28 text-right">Intent</TableHead>
              <TableHead className="w-28 text-right">Best ROI</TableHead>
              <TableHead className="w-36 text-right">Best Uplift</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ranked.map((p) => {
              const ch = bestChannel(p)
              const roi = p.offline_ads_roi_score[ch]
              const uplift = p.expected_revenue_uplift_tnd[ch]
              return (
                <TableRow key={p.id} className="hover:bg-muted/30">
                  <TableCell className="font-medium">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate">{p.name}</div>
                        <div className="mt-1 text-xs text-muted-foreground font-mono">
                          {p.id} • {p.sex}, {p.age} • {p.city}, {p.governorate}
                        </div>
                      </div>
                      <Badge variant="secondary">{label(ch)}</Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.segment}</TableCell>
                  <TableCell className="text-right font-mono text-xs text-muted-foreground">
                    {p.purchase_intent}/100
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs text-muted-foreground">
                    {roi}/100
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs text-muted-foreground">
                    {fmtTnd(uplift)} TND
                  </TableCell>
                </TableRow>
              )
            })}
            {ranked.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                  No profiles match your query.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

