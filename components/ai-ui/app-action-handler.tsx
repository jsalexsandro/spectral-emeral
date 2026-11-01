"use client"

import { useEffect, useRef } from "react"
import { getToolName, isToolUIPart, type UIMessage } from "ai"
import {
  RUN_ACTION_TOOL_NAME,
  runActionOutputSchema,
} from "@/lib/ai/actions/catalog"
import { useActionRunner } from "./action-context"

type AppActionHandlerProps = {
  messages: UIMessage[]
  initialMessageIds: ReadonlySet<string>
}

export function AppActionHandler({
  messages,
  initialMessageIds,
}: AppActionHandlerProps) {
  const run = useActionRunner()
  const processedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false

    async function processActions() {
      for (const message of messages) {
        if (initialMessageIds.has(message.id)) {
          continue
        }

        for (const part of message.parts) {
          if (!isToolUIPart(part)) {
            continue
          }

          if (getToolName(part) !== RUN_ACTION_TOOL_NAME) {
            continue
          }

          if (part.state !== "output-available") {
            continue
          }

          const key = part.toolCallId ?? JSON.stringify(part.output)

          if (processedRef.current.has(key)) {
            continue
          }

          processedRef.current.add(key)

          const parsed = runActionOutputSchema.safeParse(part.output)

          if (!parsed.success) {
            continue
          }

          await run(parsed.data.action, { source: "tool" })

          if (cancelled) {
            return
          }
        }
      }
    }

    void processActions()

    return () => {
      cancelled = true
    }
  }, [messages, initialMessageIds, run])

  return null
}
