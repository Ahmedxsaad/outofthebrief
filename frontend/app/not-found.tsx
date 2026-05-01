import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function NotFound() {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <Card className="max-w-md bg-card/70">
        <CardHeader>
          <CardTitle className="text-sm">Not found</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm text-muted-foreground">
          The requested resource does not exist.
          <div>
            <Link href="/" className={buttonVariants()}>
              Back to dashboard
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
