"use client"

import { BellRing } from "lucide-react"
import { useChatNotification } from "./chat-notification-provider"
import { cn } from "@/lib/utils"

export function NotificationSetting() {
  const {
    enabled,
    permission,
    supported,
    hydrated,
    asked,
    setEnabled,
    requestPermission,
  } = useChatNotification()

  if (!hydrated) {
    return null
  }

  if (!supported) {
    return (
      <div className="space-y-1 border-t border-border/60 pt-6">
        <p className="text-sm font-medium">Notificações de chat</p>
        <p className="text-xs text-muted-foreground">
          Este navegador não oferece suporte a notificações.
        </p>
      </div>
    )
  }

  const blocked = permission === "denied"
  const needsPermission = permission === "default"

  async function handleClick() {
    if (blocked) {
      return
    }

    if (enabled) {
      setEnabled(false)
      return
    }

    if (needsPermission) {
      await requestPermission()
      return
    }

    setEnabled(true)
  }

  const description = blocked
    ? "Bloqueadas pelo navegador. Libere as notificações deste site nas permissões."
    : enabled
      ? "Você será avisado quando a IA terminar de responder."
      : needsPermission && !asked
        ? "Ative para receber um aviso quando a IA terminar de responder."
        : "Receba um aviso quando a IA terminar de responder."

  return (
    <div className="flex items-start justify-between gap-4 border-t border-border/60 pt-6">
      <div className="min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">Notificações de chat</p>
          {enabled && permission === "granted" && (
            <BellRing className="size-3.5 shrink-0 text-primary" />
          )}
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label="Notificações de chat"
        disabled={blocked}
        onClick={() => void handleClick()}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-transparent transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          enabled ? "bg-primary" : "bg-input",
          blocked && "cursor-not-allowed opacity-50",
        )}
      >
        <span
          className={cn(
            "inline-block size-5 rounded-full bg-background shadow-sm transition-transform",
            enabled ? "translate-x-5" : "translate-x-0.5",
          )}
        />
      </button>
    </div>
  )
}
