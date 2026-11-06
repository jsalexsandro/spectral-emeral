import { Check, Circle, CircleDot, XCircle } from "lucide-react"
import type { PlanStepStatus } from "@/lib/ai/plan"
import { cn } from "@/lib/utils"

const statusStyles = {
  done: {
    icon: Check,
    marker: "border-primary bg-primary text-primary-foreground",
    title: "text-foreground",
  },
  current: {
    icon: CircleDot,
    marker: "border-primary bg-background text-primary",
    title: "text-foreground",
  },
  pending: {
    icon: Circle,
    marker: "border-border bg-background text-muted-foreground",
    title: "text-muted-foreground",
  },
  failed: {
    icon: XCircle,
    marker: "border-destructive bg-destructive/10 text-destructive",
    title: "text-destructive",
  },
} as const

type PlanTimelineItem = {
  title: string
  description?: string
  status: PlanStepStatus
}

export function PlanTimeline({
  title,
  items,
}: {
  title?: string
  items: readonly PlanTimelineItem[]
}) {
  return (
    <div className="space-y-3">
      {title && <p className="text-sm font-medium text-foreground">{title}</p>}
      <ol className="space-y-3">
        {items.map((item, index) => {
          const style = statusStyles[item.status]
          const Icon = style.icon

          return (
            <li key={`${item.title}-${index}`} className="flex gap-3">
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border",
                  style.marker,
                )}
              >
                <Icon className="size-3" />
              </span>
              <div className="min-w-0 space-y-0.5 pt-0.5">
                <p className={cn("text-sm font-medium", style.title)}>
                  {item.title}
                </p>
                {item.description && (
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {item.description}
                  </p>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
