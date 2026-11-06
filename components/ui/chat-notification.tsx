"use client"

import { Bell, BellOff } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/sonner"

type NotificationPermission = "granted" | "denied" | "default"

const NOTIFICATION_ENABLED_KEY = "spectral-chat-notifications"
const NOTIFICATION_ASKED_KEY = "spectral-chat-notification-asked"

export function useChatNotification() {
  const [enabled, setEnabled] = useState<boolean>(false)
  const [permission, setPermission] = useState<NotificationPermission>("default")
  const [asked, setAsked] = useState<boolean>(false)
  const lastAssistantMessage = useRef<string>("")

  // Carrega preferência salva ao montar
  useEffect(() => {
    const saved = localStorage.getItem(NOTIFICATION_ENABLED_KEY)
    const wasAsked = localStorage.getItem(NOTIFICATION_ASKED_KEY)

    if (saved !== null) {
      setEnabled(saved === "true")
    }
    if (wasAsked !== null) {
      setAsked(wasAsked === "true")
    }

    if (typeof window !== "undefined" && "Notification" in window) {
      setPermission(Notification.permission)
    }
  }, [])

  // Atualiza permissão quando muda
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      const perm = Notification.permission
      setPermission(perm)
    }
  }, [enabled])

  const requestPermission = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return false
    }

    const perm = await Notification.requestPermission()
    setPermission(perm)

    if (perm === "granted") {
      setEnabled(true)
      localStorage.setItem(NOTIFICATION_ENABLED_KEY, "true")
      localStorage.setItem(NOTIFICATION_ASKED_KEY, "true")
      setAsked(true)
      toast.success("Notificações ativadas", {
        description: "Você será avisado quando o chat responder.",
      })
      return true
    }

    localStorage.setItem(NOTIFICATION_ASKED_KEY, "true")
    setAsked(true)
    toast.info("Notificações não ativadas", {
      description: "Você pode ativar nas configurações (Geral).",
    })
    return false
  }, [])

  const toggleNotifications = useCallback(() => {
    if (enabled) {
      setEnabled(false)
      localStorage.setItem(NOTIFICATION_ENABLED_KEY, "false")
      toast.info("Notificações desativadas", {
        description: "Você não será mais avisado quando o chat responder.",
      })
    } else {
      void requestPermission()
    }
  }, [enabled, requestPermission])

  const showNotification = useCallback(
    (title: string, body: string) => {
      if (!enabled || permission !== "granted") {
        return
      }

      // Só notifica se a janela não estiver focada
      if (document.hasFocus()) {
        return
      }

      try {
        new Notification(title, {
          body,
          icon: "/favicon.ico",
          tag: "spectral-chat",
          requireInteraction: false,
        })
      } catch {
        // Notificação bloqueada pelo navegador
      }
    },
    [enabled, permission],
  )

  const setLastAssistantMessage = useCallback((text: string) => {
    lastAssistantMessage.current = text
  }, [])

  const notifyAssistantResponse = useCallback(() => {
    const text = lastAssistantMessage.current.trim()
    if (!text) return

    // Pega as primeiras 100 chars como preview
    const preview = text.length > 100 ? text.slice(0, 100) + "..." : text

    showNotification("Spectral - Nova resposta", preview)
  }, [showNotification])

  const shouldAskPermission = enabled === false && !asked && permission === "default"

  return {
    enabled,
    permission,
    asked,
    requestPermission,
    toggleNotifications,
    setLastAssistantMessage,
    notifyAssistantResponse,
    shouldAskPermission,
  }
}

/**
 * Componente de toggle de notificações para usar nas configurações (seção Geral).
 */
export function ChatNotificationToggle() {
  const {
    enabled,
    permission,
    asked,
    toggleNotifications,
    requestPermission,
  } = useChatNotification()

  return (
    <div className="flex items-center justify-between py-3 border-t border-border/50">
      <div>
        <p className="text-sm font-medium text-foreground">
          Notificações de chat
        </p>
        <p className="text-xs text-muted-foreground">
          Receba um aviso quando a IA responder
        </p>
      </div>
      <div className="flex items-center gap-2">
        {permission === "default" && !asked ? (
          <Button
            size="sm"
            variant="outline"
            onClick={requestPermission}
            className="size-8"
          >
            Ativar
          </Button>
        ) : (
          <button
            onClick={toggleNotifications}
            className={`rounded-md p-1.5 transition-colors ${
              enabled
                ? "bg-primary text-primary-foreground"
                : "bg-input text-muted-foreground"
            }`}
            aria-label={enabled ? "Desativar notificações" : "Ativar notificações"}
            title={enabled ? "Desativar notificações" : "Ativar notificações"}
          >
            {enabled ? (
              <Bell className="size-4" />
            ) : (
              <BellOff className="size-4" />
            )}
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * Componente que exibe um toast perguntando se o usuário quer ativar notificações.
 * Deve ser renderizado uma vez por sessão.
 */
export function ChatNotificationAsk() {
  const { shouldAskPermission, requestPermission } = useChatNotification()
  const [dismissed, setDismissed] = useState(false)

  if (dismissed || !shouldAskPermission) {
    return null
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      toast("Deseja ser notificado quando o chat responder?", {
        description:
          "Você receberá um aviso na tela mesmo com a aba em segundo plano.",
        duration: 8000,
        action: {
          label: "Ativar",
          onClick: () => {
            setDismissed(true)
            void requestPermission()
          },
        },
      })
    }, 2000)

    return () => clearTimeout(timer)
  }, [requestPermission])

  return null
}
