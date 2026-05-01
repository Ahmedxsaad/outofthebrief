"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"

import { nexus } from "@/services/nexus"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export function MetricsConsole() {
  const [count, setCount] = useState("1")
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function send(kind: "impression" | "tunein" | "profile") {
    setLoading(true)
    setMsg(null)
    try {
      const n = Math.max(1, Number.parseInt(count || "1", 10) || 1)
      const res = await nexus.reportMetricEvent(kind, n)
      setMsg(res.ok ? `Sent ${kind} +${n}` : `Rejected: ${res.reason || "unknown"}`)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="bg-card/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_20px_60px_rgba(0,0,0,0.35)]">
      <CardHeader>
        <CardTitle className="text-sm">Event Console</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-2">
          <div className="text-xs text-muted-foreground">Count</div>
          <Input value={count} onChange={(e) => setCount(e.target.value)} inputMode="numeric" />
        </div>

        <Tabs defaultValue="impression">
          <TabsList className="grid grid-cols-3">
            <TabsTrigger value="impression">Impression</TabsTrigger>
            <TabsTrigger value="tunein">Tune-in</TabsTrigger>
            <TabsTrigger value="profile">Profile</TabsTrigger>
          </TabsList>
          <TabsContent value="impression" className="mt-3">
            <Button onClick={() => send("impression")} disabled={loading} className="w-full">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Report impression
            </Button>
          </TabsContent>
          <TabsContent value="tunein" className="mt-3">
            <Button onClick={() => send("tunein")} disabled={loading} className="w-full">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Report tune-in
            </Button>
          </TabsContent>
          <TabsContent value="profile" className="mt-3">
            <Button onClick={() => send("profile")} disabled={loading} className="w-full">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Report profile
            </Button>
          </TabsContent>
        </Tabs>

        {msg ? <div className="text-xs text-muted-foreground">{msg}</div> : null}

        <div className="text-xs text-muted-foreground">
          Uses <span className="font-mono">POST /api/metrics/event</span> to keep dashboard counters driven by a single
          source of truth.
        </div>
      </CardContent>
    </Card>
  )
}

