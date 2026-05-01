import Link from "next/link"

import { cn } from "@/lib/utils"
import { navItems } from "@/components/app/nav"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"

export function Sidebar({ className }: { className?: string }) {
  return (
    <aside
      className={cn(
        "h-full w-72 border-r border-border/60 bg-sidebar text-sidebar-foreground",
        className,
      )}
    >
      <div className="flex items-center justify-between px-5 py-4">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="text-lg font-bold tracking-tight">NEXUS</span>
          <Badge variant="secondary" className="text-[11px]">
            live
          </Badge>
        </Link>
      </div>
      <ScrollArea className="h-[calc(100%-56px)] px-3 pb-6">
        <nav className="grid gap-1">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm",
                  "text-sidebar-foreground/80 hover:text-sidebar-foreground",
                  "hover:bg-sidebar-accent/70",
                )}
              >
                <span
                  className={cn(
                    "grid h-9 w-9 place-items-center rounded-xl border border-sidebar-border/50",
                    "bg-sidebar/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_10px_30px_rgba(0,0,0,0.35)]",
                    "group-hover:border-sidebar-border/80",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="font-medium">{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </ScrollArea>
    </aside>
  )
}

