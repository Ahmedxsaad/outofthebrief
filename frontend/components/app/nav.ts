import {
  Activity,
  AudioLines,
  BarChart3,
  Layers,
  RadioTower,
} from "lucide-react"

export const navItems = [
  { href: "/", label: "Dashboard", icon: BarChart3 },
  { href: "/matching", label: "Audio Matching", icon: AudioLines },
  { href: "/tracks", label: "Tracks", icon: Layers },
  { href: "/telecom", label: "Telecom Insights", icon: RadioTower },
  { href: "/metrics", label: "Metrics", icon: Activity },
] as const

