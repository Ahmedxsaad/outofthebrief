import { ThemeToggle } from "@/components/app/theme-toggle"
import { Separator } from "@/components/ui/separator"

export function Topbar({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="sticky top-0 z-20 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="min-w-0">
          <div className="text-base font-semibold tracking-tight">{title}</div>
          {subtitle ? (
            <div className="text-xs text-muted-foreground">{subtitle}</div>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
        </div>
      </div>
      <Separator />
    </header>
  )
}

