"use client"

import { createContext, useContext, type ReactNode } from "react"
import type { ActionRunner } from "@/lib/ai/actions/catalog"

const unavailableRunner: ActionRunner = async () => ({
  ok: false,
  error: "unavailable",
})

const ActionRunnerContext = createContext<ActionRunner>(unavailableRunner)

export function ActionRunnerProvider({
  run,
  children,
}: {
  run: ActionRunner
  children: ReactNode
}) {
  return (
    <ActionRunnerContext.Provider value={run}>
      {children}
    </ActionRunnerContext.Provider>
  )
}

export function useActionRunner() {
  return useContext(ActionRunnerContext)
}
