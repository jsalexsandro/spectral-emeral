"use client"

import { Shield, ShieldAlert, ShieldCheck } from "lucide-react"
import {
  EXECUTION_MODE_DESCRIPTIONS,
  EXECUTION_MODE_LABELS,
  type ChatExecutionMode,
} from "@/lib/devices/execution-policy"
import { cn } from "@/lib/utils"

const MODE_ICONS = {
  ask: ShieldAlert,
  auto: ShieldCheck,
  full: Shield,
} as const

const MODE_STYLES: Record<ChatExecutionMode, string> = {
  ask: "text-muted-foreground hover:text-foreground",
  auto: "text-emerald-600 hover:text-emerald-500 dark:text-emerald-400",
  full: "text-amber-600 hover:text-amber-500 dark:text-amber-400",
}

type ExecutionModeChipProps = {
  mode: ChatExecutionMode
  onCycle: () => void
}

export function ExecutionModeChip({ mode, onCycle }: ExecutionModeChipProps) {
  const Icon = MODE_ICONS[mode]

  return (
    <button
      type="button"
      onClick={onCycle}
      title={`${EXECUTION_MODE_DESCRIPTIONS[mode]} (Shift+Tab alterna)`}
      aria-label={`Modo de execução: ${EXECUTION_MODE_LABELS[mode]}. Pressione para alternar.`}
      className={cn(
        "flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2 text-xs font-medium transition-colors",
        MODE_STYLES[mode],
      )}
    >
      <Icon className="size-3.5" />
      <span className="hidden sm:inline">{EXECUTION_MODE_LABELS[mode]}</span>
    </button>
  )
}
