"use client"

import { useEffect, useState } from "react"
import {
  getToolName,
  isToolUIPart,
  type DynamicToolUIPart,
  type ToolUIPart,
  type UIMessage,
} from "ai"
import { ChevronDown, Loader2 } from "lucide-react"
import { RUN_ACTION_TOOL_NAME } from "@/lib/ai/actions/catalog"
import { LEGACY_EXTERN_UI_TOOL_NAME } from "@/lib/ai/actions/legacy"
import { UPDATE_PLAN_TOOL_NAME } from "@/lib/ai/plan"
import { RENDER_UI_TOOL_NAME } from "@/lib/ai/ui/catalog"
import { AgentPlanPart } from "./agent-plan"
import { ToolPartCard } from "./tool-part-card"

const hiddenToolNames = new Set<string>([
  RENDER_UI_TOOL_NAME,
  RUN_ACTION_TOOL_NAME,
  LEGACY_EXTERN_UI_TOOL_NAME,
])

type ActivityGroup = {
  step: number
  parts: Array<ToolUIPart | DynamicToolUIPart>
}

function groupActivity(parts: UIMessage["parts"]): ActivityGroup[] {
  const groups: ActivityGroup[] = []
  let current: ActivityGroup | null = null

  for (const part of parts) {
    if (part.type === "step-start") {
      current = { step: groups.length + 1, parts: [] }
      groups.push(current)
      continue
    }

    if (!isToolUIPart(part)) {
      continue
    }

    if (hiddenToolNames.has(getToolName(part))) {
      continue
    }

    if (!current) {
      current = { step: groups.length + 1, parts: [] }
      groups.push(current)
    }

    current.parts.push(part)
  }

  return groups.filter((group) => group.parts.length > 0)
}

type AgentActivityProps = {
  parts: UIMessage["parts"]
  isStreaming?: boolean
}

export function AgentActivity({ parts, isStreaming = false }: AgentActivityProps) {
  const [open, setOpen] = useState(false)
  const groups = groupActivity(parts)
  const actionCount = groups.reduce(
    (total, group) => total + group.parts.length,
    0,
  )

  useEffect(() => {
    if (isStreaming) {
      setOpen(true)
    }
  }, [isStreaming])

  if (groups.length === 0) {
    return null
  }

  return (
    <details
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className="group rounded-xl border border-border/70 bg-background/40"
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs text-muted-foreground select-none [&::-webkit-details-marker]:hidden">
        <ChevronDown className="size-3.5 shrink-0 transition-transform group-open:rotate-180" />
        <span className="font-medium text-foreground">Execução do agente</span>
        <span className="ml-auto tabular-nums">
          {groups.length} {groups.length === 1 ? "etapa" : "etapas"} ·{" "}
          {actionCount} {actionCount === 1 ? "ação" : "ações"}
        </span>
        {isStreaming && (
          <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" />
        )}
      </summary>
      <div className="space-y-4 border-t border-border/70 px-3 py-3">
        {groups.map((group) => (
          <div key={group.step} className="space-y-2">
            <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              Etapa {group.step}
            </p>
            {group.parts.map((part, index) => {
              const key = part.toolCallId ?? `${group.step}-${index}`

              if (getToolName(part) === UPDATE_PLAN_TOOL_NAME) {
                return <AgentPlanPart key={key} part={part} />
              }

              return <ToolPartCard key={key} part={part} />
            })}
          </div>
        ))}
      </div>
    </details>
  )
}
