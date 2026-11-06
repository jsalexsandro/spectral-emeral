import { Loader2, XCircle } from "lucide-react"
import { updatePlanInputSchema } from "@/lib/ai/plan"
import { PlanTimeline } from "./plan-timeline"

type AgentPlanPartData = {
  state: string
  input?: unknown
  output?: unknown
  errorText?: string
}

export function AgentPlanPart({ part }: { part: AgentPlanPartData }) {
  if (part.state === "output-error" || part.state === "output-denied") {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-2.5 py-2 text-xs">
        <XCircle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
        <p className="break-words text-muted-foreground">
          {part.errorText ?? "Não foi possível atualizar o plano."}
        </p>
      </div>
    )
  }

  const source = part.state === "output-available" ? part.output : part.input
  const parsed = updatePlanInputSchema.safeParse(source)

  if (!parsed.success) {
    return (
      <div
        aria-busy="true"
        className="flex items-center gap-2 rounded-lg border border-border/70 bg-background/50 px-2.5 py-2 text-xs text-muted-foreground"
      >
        <Loader2 className="size-3.5 animate-spin" />
        Montando plano...
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border/70 bg-card px-3 py-3">
      <PlanTimeline title={parsed.data.title ?? "Plano"} items={parsed.data.steps} />
    </div>
  )
}
