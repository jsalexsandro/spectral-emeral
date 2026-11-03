import { AlertTriangle, Check, Globe, Loader2, X } from "lucide-react"
import {
  getToolName,
  type DynamicToolUIPart,
  type ToolUIPart,
} from "ai"

function getToolUrl(part: ToolUIPart | DynamicToolUIPart): string | null {
  const input: unknown = part.input

  if (typeof input !== "object" || input === null) {
    return null
  }

  const url = (input as { url?: unknown }).url

  return typeof url === "string" ? url : null
}

function getDisplayHost(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

type ToolPartCardProps = {
  part: ToolUIPart | DynamicToolUIPart
  onApprove?: (approvalId: string, approved: boolean) => void
}

export function ToolPartCard({
  part,
  onApprove,
}: ToolPartCardProps) {
  const toolName = getToolName(part)
  const isApprovalRequested = part.state === "approval-requested"
  const isApprovalResponded = part.state === "approval-responded"
  const isApproval = isApprovalRequested || isApprovalResponded
  const isError = part.state === "output-error"
  const state = part.state as string
  const isPending =
    state === "input-streaming" ||
    state === "input-available" ||
    state === "approval-requested" ||
    state === "approval-responded"

  // --- Aprovação (qualquer tool) ---
  if (isApproval) {
    const approvalId =
      "approval" in part && part.approval
        ? (part.approval as { id?: string }).id
        : undefined
    const isApproved =
      "approval" in part && part.approval
        ? (part.approval as { approved?: boolean }).approved === true
        : false

    if (isApprovalRequested && onApprove && approvalId) {
      return (
        <div className="flex items-start gap-2 rounded-lg border border-border/70 bg-warning/50 px-2.5 py-2 text-xs">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning-foreground" />
          <div className="min-w-0">
            <p className="font-medium text-warning-foreground">
              O assistente quer executar &quot;{toolName}&quot;. Aprovar?
            </p>
            <div className="flex gap-1 mt-1">
              <button
                onClick={() => onApprove(approvalId, true)}
                className="px-2 py-0.5 text-xs bg-success text-success-foreground rounded hover:bg-success/80"
              >
                Aprovar
              </button>
              <button
                onClick={() => onApprove(approvalId, false)}
                className="px-2 py-0.5 text-xs bg-destructive text-destructive-foreground rounded hover:bg-destructive/80"
              >
                Recusar
              </button>
            </div>
          </div>
        </div>
      )
    }

    if (isApprovalResponded) {
      return (
        <div className="flex items-start gap-2 rounded-lg border border-border/70 bg-background/50 px-2.5 py-2 text-xs">
          {isApproved ? (
            <Check className="mt-0.5 size-3.5 shrink-0 text-success-foreground" />
          ) : (
            <X className="mt-0.5 size-3.5 shrink-0 text-destructive" />
          )}
          <div className="min-w-0">
            <p className="font-medium">
              {isApproved ? "Aprovado" : "Recusado"}:
              {" "}
              {toolName}
            </p>
          </div>
        </div>
      )
    }
  }

  // --- Resultado da execução (qualquer tool) ---
  if (isPending || isError) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-border/70 bg-background/50 px-2.5 py-2 text-xs">
        {isPending ? (
          <Loader2 className="mt-0.5 size-3.5 shrink-0 animate-spin text-muted-foreground" />
        ) : isError ? (
          <X className="mt-0.5 size-3.5 shrink-0 text-destructive" />
        ) : (
          <Globe className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
        )}
        <div className="min-w-0">
          <p className="font-medium">
            {isPending
              ? "Executando"
              : isError
                ? "Falha ao executar"
                : "Executou"}
            {" "}
            {toolName}
          </p>
          {isError && part.errorText && (
            <p className="mt-0.5 break-words text-muted-foreground">
              {part.errorText}
            </p>
          )}
        </div>
      </div>
    )
  }

  return null
}
