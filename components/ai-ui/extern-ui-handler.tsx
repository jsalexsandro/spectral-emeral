"use client"

import { useEffect, useRef } from "react"
import { getToolName, isToolUIPart } from "ai"
import { toast } from "sonner"
import { EXTERN_UI_TOOL_NAME } from "@/lib/ai/ui/extern-catalog"

const shown = new Set<string>()

export function ExternUiHandler({ parts }: { parts: unknown[] }) {
  const processedRef = useRef<Set<string>>(shown)

  useEffect(() => {
    for (const part of parts) {
      if (!isToolUIPart(part as any)) continue
      if (getToolName(part as any) !== EXTERN_UI_TOOL_NAME) continue

      const p = part as any
      if (p.state !== "output-available") continue

      const key = p.toolCallId || JSON.stringify(p.output)
      if (processedRef.current.has(key)) continue
      processedRef.current.add(key)

      const output = p.output
      if (!output || output.component !== "toast") continue

      const props = output.props || {}
      const title = props.title
      const description = props.description
      const variant = props.variant || "default"
      const duration = typeof props.duration === "number" ? props.duration : 4000

      const options = {
        description,
        duration,
        className: "border-border bg-card text-foreground",
        descriptionClassName: "text-muted-foreground",
      }

      if (variant === "success") toast.success(title, options)
      else if (variant === "error") toast.error(title, options)
      else if (variant === "warning") toast.warning(title, options)
      else if (variant === "info") toast.info(title, options)
      else toast(title, options)
    }
  }, [parts])

  return null
}
