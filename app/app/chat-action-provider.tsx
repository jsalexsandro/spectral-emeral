"use client"

import { useCallback, type ReactNode } from "react"
import { ActionRunnerProvider } from "@/components/ai-ui/action-context"
import type { ActionRunner, ActionResult } from "@/lib/ai/actions/catalog"
import { useAppActions } from "./app-actions-provider"

export function ChatActionProvider({
  sendText,
  children,
}: {
  sendText: (text: string) => ActionResult
  children: ReactNode
}) {
  const { run: runApp } = useAppActions()

  const run = useCallback<ActionRunner>(
    async (action, options) => {
      if (options?.source === "tool" && action.type === "sendMessage") {
        return {
          ok: false,
          error: "sendMessage não é permitido para ações da IA.",
        }
      }

      if (action.type === "sendMessage") {
        return sendText(action.text)
      }

      return runApp(action, options)
    },
    [runApp, sendText],
  )

  return <ActionRunnerProvider run={run}>{children}</ActionRunnerProvider>
}
