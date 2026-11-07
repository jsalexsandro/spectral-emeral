"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react"
import { toast } from "@/components/ui/sonner"
import {
  NOTIFICATIONS_ASKED_KEY,
  NOTIFICATIONS_ENABLED_KEY,
  buildNotificationPreview,
  getNotificationPermission,
  isNotificationSupported,
  readNotificationAsked,
  readNotificationEnabled,
  resolveNotificationChannel,
  writeNotificationAsked,
  writeNotificationEnabled,
  type NotificationPermissionState,
} from "@/lib/notifications"

export type NotifyInput = {
  title?: string
  body: string
}

type ChatNotificationContextValue = {
  enabled: boolean
  permission: NotificationPermissionState
  supported: boolean
  hydrated: boolean
  asked: boolean
  setEnabled: (enabled: boolean) => void
  requestPermission: () => Promise<boolean>
  notify: (input: NotifyInput) => void
}

const ChatNotificationContext =
  createContext<ChatNotificationContextValue | null>(null)

const PERMISSION_ASK_DURATION = 12_000
const DEFAULT_NOTIFICATION_TITLE = "Nova resposta"

function subscribeToHydration() {
  return () => {}
}

function getHydratedSnapshot() {
  return true
}

function getServerHydratedSnapshot() {
  return false
}

export function ChatNotificationProvider({ children }: { children: ReactNode }) {
  // `false` no servidor/hidratação e `true` depois — evita mismatch sem
  // precisar de setState dentro de efeito.
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    getHydratedSnapshot,
    getServerHydratedSnapshot,
  )

  const [supported] = useState(() => isNotificationSupported())
  const [enabledPreference, setEnabledState] = useState(() =>
    readNotificationEnabled(),
  )
  const [asked, setAskedState] = useState(() => readNotificationAsked())
  const [permission, setPermission] = useState<NotificationPermissionState>(
    () => getNotificationPermission(),
  )
  const askShownRef = useRef(false)

  // Permissão revogada no navegador desliga o aviso efetivo, mas preserva a
  // preferência salva: se o usuário liberar de novo, volta a funcionar.
  const enabled = enabledPreference && permission === "granted"

  // Mantém a permissão em sincronia com mudanças feitas no navegador.
  useEffect(() => {
    if (
      !supported ||
      typeof navigator === "undefined" ||
      !navigator.permissions
    ) {
      return
    }

    let cancelled = false
    let removeListener = () => {}

    void navigator.permissions
      .query({ name: "notifications" as PermissionName })
      .then((status) => {
        if (cancelled) {
          return
        }

        const handleChange = () => {
          setPermission(getNotificationPermission())
        }

        status.addEventListener("change", handleChange)
        removeListener = () => status.removeEventListener("change", handleChange)
      })
      .catch(() => {
        // Permissions API indisponível para notificações neste navegador.
      })

    return () => {
      cancelled = true
      removeListener()
    }
  }, [supported])

  // Sincroniza preferência entre abas.
  useEffect(() => {
    if (!supported) {
      return
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key === NOTIFICATIONS_ENABLED_KEY) {
        setEnabledState(readNotificationEnabled())
      }

      if (event.key === NOTIFICATIONS_ASKED_KEY) {
        setAskedState(readNotificationAsked())
      }
    }

    window.addEventListener("storage", handleStorage)

    return () => window.removeEventListener("storage", handleStorage)
  }, [supported])

  const markAsked = useCallback(() => {
    setAskedState(true)
    writeNotificationAsked(true)
  }, [])

  const setEnabled = useCallback(
    (next: boolean) => {
      setEnabledState(next)
      writeNotificationEnabled(next)

      if (next) {
        markAsked()
      }
    },
    [markAsked],
  )

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isNotificationSupported()) {
      return false
    }

    try {
      const result = await window.Notification.requestPermission()
      setPermission(result)
      markAsked()

      if (result === "granted") {
        setEnabledState(true)
        writeNotificationEnabled(true)
        toast.success("Notificações ativadas", {
          description: "Você será avisado quando a IA terminar de responder.",
        })
        return true
      }

      if (result === "denied") {
        toast.info("Notificações bloqueadas", {
          description:
            "Libere as notificações deste site nas permissões do navegador.",
        })
      } else {
        toast.info("Notificações não ativadas", {
          description: "Você pode ativar depois em Configurações → Geral.",
        })
      }

      return false
    } catch {
      return false
    }
  }, [markAsked])

  // Pergunta uma única vez, no fim da primeira resposta, se ainda não decidiu.
  const maybeAskPermission = useCallback(() => {
    if (askShownRef.current) {
      return
    }

    if (!hydrated || !supported) {
      return
    }

    if (enabled || asked || permission === "denied") {
      return
    }

    askShownRef.current = true

    toast("Deseja ser notificado quando o chat responder?", {
      description:
        "Avisamos por toast com a aba aberta e por notificação do sistema quando ela estiver em segundo plano.",
      duration: PERMISSION_ASK_DURATION,
      action: {
        label: "Ativar",
        onClick: () => {
          void requestPermission()
        },
      },
      onDismiss: markAsked,
    })
  }, [
    hydrated,
    supported,
    enabled,
    asked,
    permission,
    requestPermission,
    markAsked,
  ])

  const notify = useCallback(
    ({ title = DEFAULT_NOTIFICATION_TITLE, body }: NotifyInput) => {
      const preview = buildNotificationPreview(body)

      if (!preview) {
        return
      }

      const visibilityState =
        typeof document === "undefined" ? "visible" : document.visibilityState

      const channel = resolveNotificationChannel({
        enabled,
        permission,
        supported,
        visibilityState,
      })

      if (channel === "native") {
        try {
          const notification = new Notification("Spectral", {
            body: preview,
            icon: "/favicon.ico",
            tag: "spectral-chat",
          })

          notification.onclick = () => {
            window.focus()
            notification.close()
          }

          return
        } catch {
          // Construtor indisponível: cai no toast in-app abaixo.
        }
      }

      if (channel === "native" || channel === "in-app") {
        toast.info(title, { description: preview })
        return
      }

      maybeAskPermission()
    },
    [enabled, permission, supported, maybeAskPermission],
  )

  const value = useMemo<ChatNotificationContextValue>(
    () => ({
      enabled,
      permission,
      supported,
      hydrated,
      asked,
      setEnabled,
      requestPermission,
      notify,
    }),
    [
      enabled,
      permission,
      supported,
      hydrated,
      asked,
      setEnabled,
      requestPermission,
      notify,
    ],
  )

  return (
    <ChatNotificationContext.Provider value={value}>
      {children}
    </ChatNotificationContext.Provider>
  )
}

export function useChatNotification() {
  const context = useContext(ChatNotificationContext)

  if (!context) {
    throw new Error(
      "useChatNotification deve ser usado dentro de ChatNotificationProvider",
    )
  }

  return context
}
