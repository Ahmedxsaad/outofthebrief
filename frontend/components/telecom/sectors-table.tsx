import type { TelecomSector } from "@/types/api"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

function Bar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value))
  return (
    <div className="h-2 w-full rounded-full bg-muted/40">
      <div
        className="h-2 rounded-full bg-[var(--chart-2)]"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

export function SectorsTable({ sectors }: { sectors: TelecomSector[] }) {
  return (
    <div className="rounded-xl border border-border/50 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Sector</TableHead>
            <TableHead className="w-56">Capacity</TableHead>
            <TableHead className="w-28 text-right">Capacity %</TableHead>
            <TableHead className="w-28 text-right">CI (dB)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sectors.map((s) => (
            <TableRow key={s.name}>
              <TableCell className="font-medium">{s.name}</TableCell>
              <TableCell>
                <Bar value={s.capacity_pct} />
              </TableCell>
              <TableCell className="text-right font-mono text-xs text-muted-foreground">
                {s.capacity_pct.toFixed(1)}
              </TableCell>
              <TableCell className="text-right font-mono text-xs text-muted-foreground">
                {s.ci_db.toFixed(1)}
              </TableCell>
            </TableRow>
          ))}
          {sectors.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                No sectors configured.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  )
}

