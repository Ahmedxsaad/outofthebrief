import { Banknote, MapPin, Radio, Tv } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { TunisianProfile } from "@/lib/tunisia-profiles"

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

function maxByChannel(profiles: TunisianProfile[], channel: "billboards" | "tv" | "radio") {
  let best: TunisianProfile | null = null
  for (const p of profiles) {
    if (!best || p.offline_ads_roi_score[channel] > best.offline_ads_roi_score[channel]) best = p
  }
  return best
}

function fmtTnd(v: number) {
  return `${Math.round(v).toLocaleString()} TND`
}

export function ProfilesKpis({ profiles }: { profiles: TunisianProfile[] }) {
  const bestOOH = maxByChannel(profiles, "billboards")
  const bestTV = maxByChannel(profiles, "tv")
  const bestRadio = maxByChannel(profiles, "radio")

  const totalPotential = profiles.reduce((acc, p) => {
    const best = Math.max(
      p.expected_revenue_uplift_tnd.billboards,
      p.expected_revenue_uplift_tnd.tv,
      p.expected_revenue_uplift_tnd.radio,
    )
    return acc + best
  }, 0)

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <StatCard
        title="Profiles"
        value={profiles.length}
        hint="Hardcoded dataset (Tunisia)"
        icon={MapPin}
      />
      <StatCard
        title="Best OOH (Billboards)"
        value={bestOOH ? `${bestOOH.offline_ads_roi_score.billboards}/100` : "—"}
        hint={bestOOH ? bestOOH.name : undefined}
        icon={MapPin}
      />
      <StatCard
        title="Best TV"
        value={bestTV ? `${bestTV.offline_ads_roi_score.tv}/100` : "—"}
        hint={bestTV ? bestTV.name : undefined}
        icon={Tv}
      />
      <StatCard
        title="Best Radio"
        value={bestRadio ? `${bestRadio.offline_ads_roi_score.radio}/100` : "—"}
        hint={bestRadio ? bestRadio.name : undefined}
        icon={Radio}
      />
      <div className="md:col-span-2 xl:col-span-4">
        <Card className="bg-card/70">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Total Potential (best-channel uplift per profile)
            </CardTitle>
            <Banknote className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight">{fmtTnd(totalPotential)}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Sum of each profile’s highest expected uplift across billboards/TV/radio.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
