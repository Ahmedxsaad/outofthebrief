"use client"

import { useRef, useState } from "react"
import { Mic, Upload, Loader2 } from "lucide-react"

import { nexus } from "@/services/nexus"
import type { MatchResponse } from "@/types/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Waveform } from "@/components/match/waveform"

function MatchResultCard({ result }: { result: MatchResponse }) {
  return (
    <Card className="bg-card/70">
      <CardHeader>
        <CardTitle className="text-sm">Match Result</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Matched</span>
          <span className="font-mono">{result.matched ? "true" : "false"}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Confidence</span>
          <span className="font-mono">{result.confidence}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Coherence</span>
          <span className="font-mono">{result.coherence}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Track</span>
          <span className="font-mono">{result.track_name || "—"}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Brand / Source</span>
          <span className="font-mono">{result.brand || "—"}</span>
        </div>
      </CardContent>
    </Card>
  )
}

async function blobFromFile(file: File) {
  return new Blob([await file.arrayBuffer()], { type: file.type || "application/octet-stream" })
}

export function AudioMatching() {
  const [tab, setTab] = useState<"upload" | "record">("upload")
  const [file, setFile] = useState<File | null>(null)
  const [recording, setRecording] = useState(false)
  const [recorded, setRecorded] = useState<Blob | null>(null)
  const [result, setResult] = useState<MatchResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])

  async function submit(blob: Blob, filename: string) {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await nexus.matchAudio(blob, filename)
      setResult(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  async function startRecording() {
    setError(null)
    setResult(null)
    setRecorded(null)
    chunksRef.current = []
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const rec = new MediaRecorder(stream, { mimeType: "audio/webm" })
    mediaRef.current = rec
    rec.ondataavailable = (evt) => {
      if (evt.data.size > 0) chunksRef.current.push(evt.data)
    }
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop())
      const blob = new Blob(chunksRef.current, { type: "audio/webm" })
      setRecorded(blob)
    }
    rec.start()
    setRecording(true)
  }

  function stopRecording() {
    const rec = mediaRef.current
    if (!rec) return
    rec.stop()
    setRecording(false)
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
      <Card className="bg-card/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_20px_60px_rgba(0,0,0,0.35)]">
        <CardHeader>
          <CardTitle className="text-sm">Audio Matching</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Tabs
            value={tab}
            onValueChange={(v) => setTab(v === "record" ? "record" : "upload")}
          >
            <TabsList className="grid grid-cols-2">
              <TabsTrigger value="upload">
                <Upload className="mr-2 h-4 w-4" />
                Upload
              </TabsTrigger>
              <TabsTrigger value="record">
                <Mic className="mr-2 h-4 w-4" />
                Record
              </TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="mt-4 grid gap-3">
              <Input
                type="file"
                accept="audio/*"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <div className="flex gap-2">
                <Button
                  onClick={async () => {
                    if (!file) return
                    const blob = await blobFromFile(file)
                    await submit(blob, file.name)
                  }}
                  disabled={!file || loading}
                >
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Match audio
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setFile(null)
                    setResult(null)
                    setError(null)
                  }}
                  disabled={loading}
                >
                  Clear
                </Button>
              </div>
              <Waveform blob={file} />
            </TabsContent>

            <TabsContent value="record" className="mt-4 grid gap-3">
              <div className="flex flex-wrap gap-2">
                {!recording ? (
                  <Button onClick={startRecording} disabled={loading}>
                    <Mic className="mr-2 h-4 w-4" />
                    Start recording
                  </Button>
                ) : (
                  <Button variant="destructive" onClick={stopRecording}>
                    Stop
                  </Button>
                )}
                <Button
                  onClick={async () => {
                    if (!recorded) return
                    await submit(recorded, "mic.webm")
                  }}
                  disabled={!recorded || loading}
                >
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Match recording
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setRecorded(null)
                    setResult(null)
                    setError(null)
                  }}
                  disabled={loading}
                >
                  Clear
                </Button>
              </div>
              <Waveform blob={recorded} />
              {recorded ? (
                <audio controls src={URL.createObjectURL(recorded)} className="w-full" />
              ) : null}
            </TabsContent>
          </Tabs>

          {error ? (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
              <div className="font-semibold">Match failed</div>
              <div className="mt-1 text-muted-foreground">{error}</div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {loading ? (
          <Card className="bg-card/70">
            <CardHeader>
              <CardTitle className="text-sm">Match Result</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-5 w-1/2" />
            </CardContent>
          </Card>
        ) : result ? (
          <MatchResultCard result={result} />
        ) : (
          <Card className="bg-card/70">
            <CardHeader>
              <CardTitle className="text-sm">Match Result</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Upload or record audio to run a match against the fingerprint index.
            </CardContent>
          </Card>
        )}

        <Card className="bg-card/70">
          <CardHeader>
            <CardTitle className="text-sm">API Endpoint</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Uses <span className="font-mono">POST /api/match-audio</span> (ffmpeg decode + DSP server-side).
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
