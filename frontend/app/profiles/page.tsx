import { AppShell } from "@/components/app/app-shell"
import { Topbar } from "@/components/app/topbar"
import { ChannelRoiChart } from "@/components/profiles/channel-roi-chart"
import { ProfilesKpis } from "@/components/profiles/profiles-kpis"
import { ProfilesTable } from "@/components/profiles/profiles-table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { tunisianProfiles } from "@/lib/tunisia-profiles"

function fmtTnd(v: number) {
  return `${Math.round(v).toLocaleString()} TND`
}

export default function ProfilesPage() {
  const profiles = tunisianProfiles

  const topPicks = [...profiles]
    .map((p) => {
      const best = Math.max(
        p.expected_revenue_uplift_tnd.billboards,
        p.expected_revenue_uplift_tnd.tv,
        p.expected_revenue_uplift_tnd.radio,
      )
      return { p, best }
    })
    .sort((a, b) => b.best - a.best)
    .slice(0, 3)

  return (
    <AppShell
      topbar={
        <Topbar
          title="Tunisia Profiles"
          subtitle="Hardcoded audience profiles + offline ads investment scoring (billboards / TV / radio)"
        />
      }
    >
      <ProfilesKpis profiles={profiles} />

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <ChannelRoiChart profiles={profiles} />
        <Card className="bg-card/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_20px_60px_rgba(0,0,0,0.35)]">
          <CardHeader>
            <CardTitle className="text-sm">Top Revenue Profiles</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            {topPicks.map(({ p, best }) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-xl border border-border/50 bg-card/40 px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{p.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {p.segment} • {p.city}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-xs text-muted-foreground">best uplift</div>
                  <div className="font-mono">{fmtTnd(best)}</div>
                </div>
              </div>
            ))}
            <div className="text-xs text-muted-foreground">
              Use these profiles when allocating offline ad budgets to maximize expected revenue uplift.
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <Card className="bg-card/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_20px_60px_rgba(0,0,0,0.35)]">
          <CardHeader>
            <CardTitle className="text-sm">Profiles Table</CardTitle>
          </CardHeader>
          <CardContent>
            <ProfilesTable profiles={profiles} />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}

