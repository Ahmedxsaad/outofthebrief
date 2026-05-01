"use client"

import Link from "next/link"
import { useMemo, useState } from "react"

import type { TrackSummary } from "@/types/api"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

export function TracksTable({ tracks }: { tracks: TrackSummary[] }) {
  const [q, setQ] = useState("")

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return tracks
    return tracks.filter((t) => `${t.name} ${t.brand} ${t.track_id}`.toLowerCase().includes(s))
  }, [q, tracks])

  return (
    <div className="grid gap-3">
      <Input
        placeholder="Search tracks (name, brand, id)…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="rounded-xl border border-border/50 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Source</TableHead>
              <TableHead className="w-28 text-right">Duration</TableHead>
              <TableHead className="w-28 text-right">Hashes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((t) => (
              <TableRow key={t.track_id} className="hover:bg-muted/30">
                <TableCell className="font-medium">
                  <Link href={`/tracks/${encodeURIComponent(t.track_id)}`} className="hover:underline">
                    {t.name}
                  </Link>
                  <div className="mt-1 text-xs text-muted-foreground font-mono">{t.track_id}</div>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{t.brand}</Badge>
                </TableCell>
                <TableCell className="text-right font-mono text-xs text-muted-foreground">
                  {t.duration_sec.toFixed(1)}s
                </TableCell>
                <TableCell className="text-right font-mono text-xs text-muted-foreground">
                  {t.hash_count}
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                  No tracks match your query.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

