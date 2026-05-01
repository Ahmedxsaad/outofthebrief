import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Sidebar } from "@/components/app/sidebar"
import { Menu } from "lucide-react"

export function AppShell({
  topbar,
  children,
}: {
  topbar: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-full">
      <div className="hidden lg:block">
        <Sidebar className="fixed left-0 top-0 h-full" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col lg:pl-72">
        <div className="lg:hidden">
          <div className="flex items-center gap-2 px-4 py-3">
            <Sheet>
              <SheetTrigger
                render={<Button variant="secondary" size="icon" aria-label="Open navigation" />}
              >
                <Menu className="h-4 w-4" />
              </SheetTrigger>
              <SheetContent side="left" className="w-80 p-0">
                <Sidebar className="w-full border-r-0" />
              </SheetContent>
            </Sheet>
            <div className="text-sm font-semibold tracking-tight">NEXUS</div>
          </div>
        </div>

        {topbar}

        <main className="flex-1 px-6 py-6">{children}</main>
      </div>
    </div>
  )
}
