"use client"

import { Moon, Sun } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"

type Theme = "dark" | "light"

function getTheme(): Theme {
  if (typeof window === "undefined") return "dark"
  const stored = window.localStorage.getItem("nexus:theme")
  return stored === "light" ? "light" : "dark"
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => getTheme())

  function apply(next: Theme) {
    setTheme(next)
    try {
      window.localStorage.setItem("nexus:theme", next)
    } catch {}
    document.documentElement.classList.toggle("dark", next === "dark")
  }

  return (
    <Button
      variant="secondary"
      size="icon"
      onClick={() => apply(theme === "dark" ? "light" : "dark")}
      aria-label="Toggle theme"
    >
      {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
    </Button>
  )
}
