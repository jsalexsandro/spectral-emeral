"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { useRouter } from "next/navigation"
import { toast } from "@/components/ui/sonner"
import { useTheme } from "@/components/theme-provider"
import type {
  ActionRunner,
  ActionResult,
  AppAction,
} from "@/lib/ai/actions/catalog"
import type { ConfigSection } from "@/lib/config-sections"
import { ConfigComponent, type ConfigUser } from "./config-component"

type AppActionsContextValue = {
  run: ActionRunner
  openSettings: (section?: ConfigSection) => void
}

const AppActionsContext = createContext<AppActionsContextValue | null>(null)

function showToast(action: Extract<AppAction, { type: "toast" }>) {
  const options = {
    description: action.description,
    duration: action.duration ?? 4_000,
  }

  if (action.variant === "success") {
    toast.success(action.title, options)
  } else if (action.variant === "error") {
    toast.error(action.title, options)
  } else if (action.variant === "warning") {
    toast.warning(action.title, options)
  } else if (action.variant === "info") {
    toast.info(action.title, options)
  } else {
    toast(action.title, options)
  }
}

function deviceAppErrorMessage(code: string | undefined, fallback?: string) {
  switch (code) {
    case "device_offline":
      return "O PC está offline. Verifique se o driver está conectado."
    case "device_busy":
      return "O PC ainda está executando outro comando."
    case "device_disconnected":
      return "O PC desconectou antes de concluir o comando."
    case "command_timeout":
      return "O PC demorou para responder. Tente novamente."
    case "device_not_found":
      return "Dispositivo não encontrado ou removido."
    case "invalid_app":
    case "app_not_allowed":
      return "Esse aplicativo não está na lista permitida."
    case "rate_limited":
      return "Muitas tentativas. Aguarde um instante."
    default:
      return fallback ?? "Não foi possível abrir o aplicativo."
  }
}

function readErrorPayload(payload: unknown) {
  if (typeof payload !== "object" || payload === null) {
    return {}
  }

  const record = payload as Record<string, unknown>

  return {
    code: typeof record.error === "string" ? record.error : undefined,
    message: typeof record.message === "string" ? record.message : undefined,
  }
}

export function AppActionsProvider({
  user,
  children,
}: {
  user: ConfigUser
  children: ReactNode
}) {
  const router = useRouter()
  const { setTheme } = useTheme()
  const [configOpen, setConfigOpen] = useState(false)
  const [configSection, setConfigSection] = useState<ConfigSection>("general")

  const openSettings = useCallback((section: ConfigSection = "general") => {
    setConfigSection(section)
    setConfigOpen(true)
  }, [])

  const handleConfigOpenChange = useCallback((open: boolean) => {
    setConfigOpen(open)

    if (!open) {
      setConfigSection("general")
    }
  }, [])

  const run = useCallback<ActionRunner>(
    async (action, options): Promise<ActionResult> => {
    try {
      switch (action.type) {
        case "toast": {
          showToast(action)
          return { ok: true }
        }
        case "setTheme": {
          setTheme(action.theme)
          return { ok: true }
        }
        case "openSettings": {
          openSettings(action.section)
          return { ok: true }
        }
        case "navigate": {
          // Se a actionvier da IA (source === "tool"), pedir confirmação
          if (options?.source === "tool" && action.type === "navigate") {
            if (!window.confirm("O assistente quer navegar para " + action.path + ". Confirmar?")) {
              return { ok: false, error: "navigate cancelled" }
            }
          }
          setConfigOpen(false)
          router.push(action.path)
          return { ok: true }
        }
        case "copy": {
          await navigator.clipboard.writeText(action.text)
          return { ok: true }
        }
        case "sendMessage": {
          return {
            ok: false,
            error: "sendMessage deve ser executado pelo chat.",
          }
        }
        case "openDeviceApp": {
          const response = await fetch(
            `/api/devices/${encodeURIComponent(action.deviceId)}/open-app`,
            {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ appId: action.appId }),
            },
          )

          const payload: unknown = await response.json().catch(() => null)

          if (!response.ok) {
            const { code, message: serverMessage } = readErrorPayload(payload)
            const message = deviceAppErrorMessage(code, serverMessage)

            toast.error("Não foi possível abrir o aplicativo", {
              description: message,
            })

            return { ok: false, error: message }
          }

          toast.success("Aplicativo aberto no PC")
          return { ok: true }
        }
      }
    } catch {
      toast.error("Não foi possível executar a ação.")
      return { ok: false, error: "action-failed" }
    }
  },
  [openSettings, router, setTheme],
)

  const value = useMemo(
    () => ({ run, openSettings }),
    [run, openSettings],
  )

  return (
    <AppActionsContext.Provider value={value}>
      {children}
      <ConfigComponent
        open={configOpen}
        onOpenChange={handleConfigOpenChange}
        section={configSection}
        onSectionChange={setConfigSection}
        user={user}
      />
    </AppActionsContext.Provider>
  )
}

export function useAppActions() {
  const context = useContext(AppActionsContext)

  if (!context) {
    throw new Error("useAppActions deve ser usado dentro de AppActionsProvider")
  }

  return context
}
