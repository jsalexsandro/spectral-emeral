"use client"

import { useCallback, useMemo, useRef, type MouseEvent } from "react"
import { Loader2, XCircle } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { appActionSchema } from "@/lib/ai/actions/catalog"
import { sanitizeHtml } from "@/lib/ai/ui/html-sanitize"
import {
  HTML_UI_ACTION_ATTRIBUTE,
  HTML_UI_VERSION,
  renderHtmlOutputSchema,
} from "@/lib/ai/ui/html-policy"
import { useActionRunner } from "./action-context"

export type RenderHtmlPartData = {
  state: string
  input?: unknown
  output?: unknown
  errorText?: string
}

function RenderHtmlLoading() {
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

function RenderHtmlError({ message }: { message?: string }) {
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

export function RenderHtmlPart({ part }: { part: RenderHtmlPartData }) {
  const run = useActionRunner()
  const containerRef = useRef<HTMLDivElement>(null)

  const html = useMemo(() => {
    if (part.state !== "output-available") {
      return null
    }

    const parsed = renderHtmlOutputSchema.safeParse(part.output)

    if (!parsed.success || parsed.data.uiVersion > HTML_UI_VERSION) {
      return null
    }

    return sanitizeHtml(parsed.data.html)
  }, [part.output, part.state])

  const handleClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      const target = event.target

      if (!(target instanceof Element)) {
        return
      }

      const actionElement = target.closest<HTMLElement>(
        `[${HTML_UI_ACTION_ATTRIBUTE}]`,
      )

      if (
        !actionElement ||
        !containerRef.current?.contains(actionElement)
      ) {
        return
      }

      event.preventDefault()

      const rawAction = actionElement.getAttribute(HTML_UI_ACTION_ATTRIBUTE)

      if (!rawAction) {
        return
      }

      let parsedAction: unknown

      try {
        parsedAction = JSON.parse(rawAction)
      } catch {
        return
      }

      const action = appActionSchema.safeParse(parsedAction)

      if (!action.success) {
        return
      }

      if (action.data.type === "navigate") {
        const confirmed = window.confirm(
          `Confirmar navegação para ${action.data.path}?`,
        )

        if (!confirmed) {
          return
        }
      }

      void run(action.data, { source: "user" })
    },
    [run],
  )

  if (part.state === "output-error") {
    return <RenderHtmlError message={part.errorText} />
  }

  if (part.state === "output-denied") {
    return <RenderHtmlError message="A visualização foi recusada." />
  }

  if (part.state === "output-available") {
    if (!html) {
      return (
        <RenderHtmlError message="O HTML recebido não corresponde a uma visualização válida." />
      )
    }

    return (
      <div
        ref={containerRef}
        onClick={handleClick}
        className="text-sm text-foreground"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    )
  }

  if (
    part.state === "input-available" ||
    part.state === "approval-requested" ||
    part.state === "approval-responded"
  ) {
    return <RenderHtmlLoading />
  }

  return <RenderHtmlLoading />
}
