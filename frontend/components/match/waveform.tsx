"use client"

import { useEffect, useRef, useState } from "react"

import { cn } from "@/lib/utils"

type WebkitAudioWindow = Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }

async function decodePcm(blob: Blob): Promise<Float32Array | null> {
  try {
    const ab = await blob.arrayBuffer()
    const Ctx = window.AudioContext || (window as WebkitAudioWindow).webkitAudioContext
    if (!Ctx) return null
    const ctx = new Ctx()
    const audio = await ctx.decodeAudioData(ab.slice(0))
    const ch0 = audio.getChannelData(0)
    ctx.close().catch(() => {})
    return ch0
  } catch {
    return null
  }
}

function downsample(samples: Float32Array, buckets: number) {
  const step = Math.max(1, Math.floor(samples.length / buckets))
  const out: number[] = []
  for (let i = 0; i < buckets; i++) {
    const start = i * step
    const end = Math.min(samples.length, start + step)
    let peak = 0
    for (let j = start; j < end; j++) peak = Math.max(peak, Math.abs(samples[j]))
    out.push(peak)
  }
  return out
}

export function Waveform({ blob, className }: { blob: Blob | null; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => setReady(false))
    const canvas = canvasRef.current
    if (!blob || !canvas) return

    ;(async () => {
      const pcm = await decodePcm(blob)
      if (!pcm || cancelled) return
      const ctx = canvas.getContext("2d")
      if (!ctx) return
      const w = canvas.width
      const h = canvas.height
      ctx.clearRect(0, 0, w, h)

      const peaks = downsample(pcm, 160)
      ctx.fillStyle = "color-mix(in oklab, var(--chart-2) 60%, white 40%)"
      const mid = h / 2
      const barW = w / peaks.length
      for (let i = 0; i < peaks.length; i++) {
        const amp = peaks[i]
        const barH = Math.max(1, amp * h * 0.85)
        const x = i * barW
        ctx.fillRect(x, mid - barH / 2, Math.max(1, barW - 1), barH)
      }
      setReady(true)
    })()

    return () => {
      cancelled = true
    }
  }, [blob])

  return (
    <div
      className={cn(
        "rounded-xl border border-border/50 bg-card/40 p-3",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_18px_50px_rgba(0,0,0,0.35)]",
        className,
      )}
    >
      <canvas ref={canvasRef} width={760} height={96} className="h-24 w-full" />
      {!blob ? (
        <div className="mt-2 text-xs text-muted-foreground">Waveform preview</div>
      ) : !ready ? (
        <div className="mt-2 text-xs text-muted-foreground">Decoding…</div>
      ) : (
        <div className="mt-2 text-xs text-muted-foreground">Waveform</div>
      )}
    </div>
  )
}
