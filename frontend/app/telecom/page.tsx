import { AppShell } from "@/components/app/app-shell"
import { Topbar } from "@/components/app/topbar"
import { TelecomActivityChart } from "@/components/charts/telecom-activity-chart"
import { SectorsTable } from "@/components/telecom/sectors-table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { nexus } from "@/services/nexus"

export default async function TelecomPage() {
  const res = await nexus.telecomSectors()

  return (
    <AppShell
      topbar={
        <Topbar
          title="Telecom Insights"
          subtitle="Sector capacity + CI telemetry (static config until NMS integration)"
        />
      }
    >
      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="bg-card/70">
          <CardHeader>
            <CardTitle className="text-sm">Integration Status</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>Status</span>
              <span className="font-mono">{res.integration_status}</span>
            </div>
          </CardContent>
        </Card>
        <TelecomActivityChart sectors={res.sectors} />
      </div>

      <div className="mt-6">
        <Card className="bg-card/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_20px_60px_rgba(0,0,0,0.35)]">
          <CardHeader>
            <CardTitle className="text-sm">Sectors</CardTitle>
          </CardHeader>
          <CardContent>
            <SectorsTable sectors={res.sectors} />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}

