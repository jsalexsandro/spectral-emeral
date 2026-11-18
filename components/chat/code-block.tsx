"use client"

import { Check, Copy } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { codeToHtml } from "shiki"
import { cn } from "cn"

type CodeBlockProps = {
  code: string
  language?: string
  label?: string
  className?: string
  showHeader?: boolean
  wrap?: boolean
}

const highlightCache = new Map<string, string>()

function normalizeLanguage(language?: string): string | undefined {
  if (!language) return undefined
  const value = language.trim().toLowerCase()
  if (!value || value === "plaintext" || value === "text" || value === "plain") {
    return "text"
  }
  if (value === "tsx") return "tsx"
  if (value === "jsx") return "jsx"
  if (value === "js" || value === "javascript" || value === "node") return "javascript"
  if (value === "ts" || value === "typescript") return "typescript"
  if (value === "sh" || value === "bash" || value === "shell" || value === "zsh") return "bash"
  if (value === "ps" || value === "ps1" || value === "powershell" || value === "pwsh") return "powershell"
  if (value === "yml") return "yaml"
  if (value === "py") return "python"
  if (value === "rb") return "ruby"
  if (value === "rs") return "rust"
  if (value === "c++") return "cpp"
  if (value === "cs" || value === "csharp" || value === "dotnet") return "csharp"
  if (value === "golang") return "go"
  if (value === "md" || value === "markdown") return "markdown"
  return value
}

export function CodeBlock({
  code,
  language,
  label,
  className,
  showHeader = true,
  wrap = false,
}: CodeBlockProps) {
  const [highlighted, setHighlighted] = useState<{
    key: string
    html: string | null
  } | null>(null)
  const [copied, setCopied] = useState(false)

  const lang = useMemo(() => normalizeLanguage(language), [language])
  const displayLabel = label ?? (lang && lang !== "text" ? lang : undefined)
  const cacheKey = `${lang ?? "text"}\n${code}`
  const cached = highlightCache.get(cacheKey)

  useEffect(() => {
    if (cached !== undefined) {
      return
    }

    let cancelled = false

    async function highlight() {
      try {
        const result = await codeToHtml(code, {
          lang: lang && lang !== "text" ? lang : "text",
          theme: "github-dark",
        })

        highlightCache.set(cacheKey, result)
        if (!cancelled) {
          setHighlighted({ key: cacheKey, html: result })
        }
      } catch {
        if (!cancelled) {
          setHighlighted({ key: cacheKey, html: null })
        }
      }
    }

    void highlight()

    return () => {
      cancelled = true
    }
  }, [cacheKey, cached, code, lang])

  const html =
    cached !== undefined
      ? cached
      : highlighted?.key === cacheKey
        ? highlighted.html
        : null

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard indisponível
    }
  }

  return (
    <div
      className={cn(
        "group/code overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-100",
        className,
      )}
    >
      {showHeader && (
        <div className="flex items-center justify-between gap-2 border-b border-zinc-800 px-3 py-1.5">
          <span className="min-w-0 truncate font-mono text-[11px] text-zinc-400">
            {displayLabel ?? "código"}
          </span>
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
            aria-label="Copiar código"
            title="Copiar código"
          >
            {copied ? (
              <Check className="size-3.5" />
            ) : (
              <Copy className="size-3.5" />
            )}
            {copied ? "Copiado" : "Copiar"}
          </button>
        </div>
      )}
      {html ? (
        <div
          className={cn(
            "overflow-x-auto text-xs leading-relaxed [&_pre]:!m-0 [&_pre]:!rounded-none [&_pre]:!bg-transparent [&_pre]:!p-3 [&_code]:font-mono",
            wrap && "[&_pre]:whitespace-pre-wrap [&_code]:whitespace-pre-wrap",
          )}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <pre
          className={cn(
            "overflow-x-auto p-3 font-mono text-xs leading-relaxed text-zinc-100",
            wrap && "whitespace-pre-wrap break-words",
          )}
        >
          <code>{code}</code>
        </pre>
      )}
    </div>
  )
}
