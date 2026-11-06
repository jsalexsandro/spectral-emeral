"use client"

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"
import { XCircle } from "lucide-react"
import {
  buildWidgetThemeMessage,
  clampWidgetHeight,
  requiresUserGesture,
  widgetMessageSchema,
  WIDGET_ACTION_WINDOW_MS,
  WIDGET_IFRAME_SANDBOX,
  WIDGET_MAX_ACTIONS_PER_SESSION,
  WIDGET_MAX_ACTIONS_PER_WINDOW,
} from "@/lib/ai/ui/widget-protocol"
import { buildWidgetSrcDoc, type WidgetTheme } from "@/lib/ai/ui/widget-srcdoc"
import { useActionRunner } from "./action-context"

const WIDGET_READY_TIMEOUT_MS = 4_000

const emptySubscribe = () => () => {}

function useIsClient() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  )
}

let cachedAppCss: string | null = null

function collectAppCss(): string {
  if (cachedAppCss !== null) {
    return cachedAppCss
  }

  if (typeof document === "undefined") {
    return ""
  }

  const chunks: string[] = []

  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules)) {
        chunks.push(rule.cssText)
      }
    } catch {
      // Folha de estilo de outra origem: não pode ser lida.
    }
  }

  cachedAppCss = chunks.join("\n")

  return cachedAppCss
}

function readTheme(): WidgetTheme {
  if (typeof document === "undefined") {
    return "light"
  }

  return document.documentElement.classList.contains("dark") ? "dark" : "light"
}

function WidgetError({ message }: { message: string }) {
  return (
    <div
      role="status"
      className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/5 p-3.5 text-sm"
    >
      <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
      <div className="min-w-0">
        <p className="font-medium text-destructive">
          O widget interativo não respondeu.
        </p>
        <p className="mt-0.5 break-words text-xs text-muted-foreground">
          {message}
        </p>
      </div>
    </div>
  )
}

export function WidgetFrame({
  html,
  script,
}: {
  html: string
  script?: string
}) {
  const run = useActionRunner()
  const nonce = useId()
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const actionWindowRef = useRef<number[]>([])
  const actionCountRef = useRef(0)

  const mounted = useIsClient()
  const [css] = useState(collectAppCss)
  const [fontFamily] = useState(() => {
    if (typeof document === "undefined") {
      return undefined
    }

    return window.getComputedStyle(document.body).fontFamily
  })
  const [initialTheme] = useState<WidgetTheme>(readTheme)
  const [theme, setTheme] = useState<WidgetTheme>(readTheme)
  const [height, setHeight] = useState(120)
  const [status, setStatus] = useState<"loading" | "ready" | "timeout">(
    "loading",
  )

  useEffect(() => {
    if (!mounted) {
      return
    }

    const observer = new MutationObserver(() => {
      setTheme(readTheme())
    })

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style"],
    })

    return () => observer.disconnect()
  }, [mounted])

  useEffect(() => {
    if (!mounted || status !== "loading") {
      return
    }

    const timer = window.setTimeout(() => {
      setStatus((current) => (current === "loading" ? "timeout" : current))
    }, WIDGET_READY_TIMEOUT_MS)

    return () => window.clearTimeout(timer)
  }, [mounted, status])

  const sendTheme = useCallback(() => {
    const frame = iframeRef.current

    frame?.contentWindow?.postMessage(
      buildWidgetThemeMessage(nonce, theme),
      "*",
    )
  }, [nonce, theme])

  useEffect(() => {
    if (mounted && status !== "timeout") {
      sendTheme()
    }
  }, [mounted, sendTheme, status])

  useEffect(() => {
    if (!mounted) {
      return
    }

    const handleMessage = (event: MessageEvent) => {
      const frame = iframeRef.current

      if (!frame || event.source !== frame.contentWindow) {
        return
      }

      const parsed = widgetMessageSchema.safeParse(event.data)

      if (!parsed.success || parsed.data.nonce !== nonce) {
        return
      }

      const message = parsed.data

      if (message.type === "widget:ready") {
        setStatus("ready")
        return
      }

      if (message.type === "widget:resize") {
        setHeight(clampWidgetHeight(message.height))
        return
      }

      if (message.type === "widget:open") {
        if (!message.userInitiated) {
          return
        }

        window.open(message.url, "_blank", "noopener,noreferrer")
        return
      }

      if (actionCountRef.current >= WIDGET_MAX_ACTIONS_PER_SESSION) {
        return
      }

      const now = Date.now()
      const windowStart = now - WIDGET_ACTION_WINDOW_MS

      actionWindowRef.current = actionWindowRef.current.filter(
        (timestamp) => timestamp > windowStart,
      )

      if (
        actionWindowRef.current.length >= WIDGET_MAX_ACTIONS_PER_WINDOW
      ) {
        return
      }

      if (
        requiresUserGesture(message.action.type) &&
        !message.userInitiated
      ) {
        return
      }

      actionWindowRef.current.push(now)
      actionCountRef.current += 1

      if (message.action.type === "navigate") {
        const confirmed = window.confirm(
          `Confirmar navegação para ${message.action.path}?`,
        )

        if (!confirmed) {
          return
        }
      }

      void run(message.action, { source: "user" })
    }

    window.addEventListener("message", handleMessage)

    return () => window.removeEventListener("message", handleMessage)
  }, [mounted, nonce, run])

  const srcDoc = useMemo(
    () =>
      buildWidgetSrcDoc({
        html,
        script,
        nonce,
        theme: initialTheme,
        css,
        fontFamily,
      }),
    [css, fontFamily, html, initialTheme, nonce, script],
  )

  if (status === "timeout") {
    return (
      <WidgetError message="O script do widget demorou demais para iniciar ou foi bloqueado pelo sandbox." />
    )
  }

  if (!mounted) {
    return (
      <div
        aria-busy="true"
        aria-label="Carregando widget interativo"
        className="min-h-24 w-full rounded-xl border border-border/70 bg-card"
      />
    )
  }

  return (
    <iframe
      ref={iframeRef}
      title="Widget interativo gerado pelo assistente"
      sandbox={WIDGET_IFRAME_SANDBOX}
      srcDoc={srcDoc}
      referrerPolicy="no-referrer"
      onLoad={sendTheme}
      style={{ height: `${height}px` }}
      className="w-full border-0 bg-transparent"
    />
  )
}
