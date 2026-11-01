import { Loader2, XCircle } from "lucide-react"
import {
  UI_CATALOG_VERSION,
  normalizeRenderUiOutput,
  renderUiInputSchema,
  renderUiOutputSchema,
} from "@/lib/ai/ui/catalog"
import { Skeleton } from "@/components/ui/skeleton"
import { aiUiRegistry, renderAiUiComponent } from "./registry"

export type RenderUiPartData = {
  state: string
  input?: unknown
  output?: unknown
  errorText?: string
}

function RenderUiLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Gerando visualização"
      className="space-y-3 rounded-xl border border-border/70 bg-card p-4"
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        Gerando visualização...
      </div>
      <Skeleton className="h-4 w-1/3" />
      <div className="grid grid-cols-2 gap-2">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
      <Skeleton className="h-3 w-2/3" />
    </div>
  )
}

function RenderUiError({ message }: { message?: string }) {
  return (
    <div
      role="status"
      className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/5 p-3.5 text-sm"
    >
      <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
      <div className="min-w-0">
        <p className="font-medium text-destructive">
          Não foi possível exibir esta visualização.
        </p>
        {message && (
          <p className="mt-0.5 break-words text-xs text-muted-foreground">
            {message}
          </p>
        )}
      </div>
    </div>
  )
}

export function RenderUiPart({ part }: { part: RenderUiPartData }) {
  if (part.state === "output-error") {
    return <RenderUiError message={part.errorText} />
  }

  if (part.state === "output-denied") {
    return <RenderUiError message="A visualização foi recusada." />
  }

  if (part.state === "output-available") {
    const parsed = renderUiOutputSchema.safeParse(part.output)

    if (!parsed.success) {
      return (
        <RenderUiError message="Os dados recebidos não correspondem a um componente válido." />
      )
    }

    if (parsed.data.uiVersion > UI_CATALOG_VERSION) {
      return (
        <RenderUiError message="Este componente foi criado por uma versão mais nova do Spectral." />
      )
    }

    const normalized = normalizeRenderUiOutput(parsed.data)

    if (!(normalized.component in aiUiRegistry)) {
      return <RenderUiError message="Componente não permitido." />
    }

    return renderAiUiComponent(normalized)
  }

  if (
    part.state === "input-available" ||
    part.state === "approval-requested" ||
    part.state === "approval-responded"
  ) {
    const parsed = renderUiInputSchema.safeParse(part.input)

    if (!parsed.success) {
      return <RenderUiLoading />
    }

    return (
      <div aria-busy="true" className="space-y-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          Preparando visualização...
        </div>
        <div className="pointer-events-none opacity-60">
          {renderAiUiComponent(parsed.data)}
        </div>
      </div>
    )
  }

  return <RenderUiLoading />
}
