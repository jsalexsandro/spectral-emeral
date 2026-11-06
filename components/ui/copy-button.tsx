"use client"

import { Button } from "@/components/ui/button"
import { Copy, Check } from "lucide-react"
import { useCallback, useState } from "react"

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard não disponível ou negado
    }
  }, [text])

  return (
    <Button
      size="icon"
      variant="outline"
      onClick={handleCopy}
      className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity"
      aria-label="Copiar"
      disabled={copied}
    >
      {copied ? (
        <Check className="size-4" />
      ) : (
        <Copy className="size-4" />
      )}
    </Button>
  )
}
