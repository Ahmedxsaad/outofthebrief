import { AppShell } from "@/components/app/app-shell"
import { Topbar } from "@/components/app/topbar"
import { AudioMatching } from "@/components/match/audio-matching"

export default function MatchingPage() {
  return (
    <AppShell
      topbar={
        <Topbar
          title="Audio Matching"
          subtitle="Upload or record audio and match against the fingerprint index"
        />
      }
    >
      <AudioMatching />
    </AppShell>
  )
}

