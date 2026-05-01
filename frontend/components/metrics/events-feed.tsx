"use client"

import { format } from "date-fns"

import { useSseEvents } from "@/hooks/use-sse"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export function EventsFeed() {
  const { events, status } = useSseEvents()
  const rows = events.slice(0, 12).map((e) => {
    const ts = format(new Date(e.received_at), "HH:mm:ss")
    if (e.type === "match") {
      return {
        key: `match-${e.received_at}`,
        ts,
        kind: "match",
        label: e.data.track_name,
        meta: `conf ${e.data.confidence}`,
        badge: <Badge>match</Badge>,
      }
    }
    return {
      key: `metric-${e.received_at}`,
      ts,
      kind: "metric",
      label: e.data.type,
      meta: `+${e.data.count}`,
      badge: <Badge variant="secondary">metric</Badge>,
    }
  })

  return (
    <Card className="bg-card/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_20px_60px_rgba(0,0,0,0.35)]">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm">Live Events</CardTitle>
        <div className="text-xs text-muted-foreground">SSE: {status}</div>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <div className="grid h-40 place-items-center text-sm text-muted-foreground">
            No events yet.
          </div>
        ) : (
          <div className="rounded-xl border border-border/50 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Time</TableHead>
                  <TableHead className="w-28">Type</TableHead>
                  <TableHead>Signal</TableHead>
                  <TableHead className="text-right">Meta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.key}>
                    <TableCell className="font-mono text-xs text-muted-foreground">{r.ts}</TableCell>
                    <TableCell>{r.badge}</TableCell>
                    <TableCell className="truncate">{r.label}</TableCell>
                    <TableCell className="text-right font-mono text-xs text-muted-foreground">
                      {r.meta}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
