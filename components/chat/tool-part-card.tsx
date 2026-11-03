import { Globe, Loader2, X } from "lucide-react"
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
}

export function ToolPartCard({ part }: ToolPartCardProps) {
  const toolName = getToolName(part)
  const state = part.state as string
  const isError = part.state === "output-error"
  const isPending =
    state === "input-streaming" ||
    state === "input-available" ||
    state === "approval-requested" ||
    state === "approval-responded"

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
