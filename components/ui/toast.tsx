"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

export type ToastVariant = "default" | "success" | "error" | "warning" | "info"

export type Toast = {
  id: string
  title: string
  description?: string
  variant: ToastVariant
  duration?: number
  createdAt: number
  action?: {
    label: string
    onClick: () => void
  }
}

export type ToastOptions = {
  description?: string
  duration?: number
  variant?: ToastVariant
  action?: {
    label: string
    onClick: () => void
  }
}

type ToastAction = {
  id: string
  dismiss: () => void
}

const TOAST_LIMIT = 5
const TOAST_REMOVE_DELAY = 500

function generateId() {
  return Math.random().toString(36).substring(2, 10)
}

type ToastState = {
  toasts: Toast[]
}

type ToastContextType = {
  toast: (title: string, options?: ToastOptions) => ToastAction
  dismiss: (toastId: string) => void
  toasts: Toast[]
}

type ToastProviderProps = {
  children: ReactNode
}

const ToastContext = createContext<ToastContextType | null>(null)

// Referência global para permitir chamar toast() de qualquer lugar (fora de componentes)
let globalToast: ((title: string, options?: ToastOptions) => ToastAction) | null =
  null
let globalDismiss: ((toastId: string) => void) | null = null

export function setGlobalToast(
  toastFn: (title: string, options?: ToastOptions) => ToastAction,
  dismissFn: (toastId: string) => void,
) {
  globalToast = toastFn
  globalDismiss = dismissFn
}

/**
 * Chama toast de qualquer lugar (event handlers, callbacks, etc.).
 * Retorna null se ToastProvider não estiver montado.
 */
export function toastGlobal(
  title: string,
  options?: ToastOptions,
): ToastAction | null {
  if (!globalToast) {
    console.warn("ToastProvider not mounted. Toast ignored:", title)
    return { id: "", dismiss: () => {} }
  }
  return globalToast(title, options)
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [state, setState] = useState<ToastState>({ toasts: [] })

  const dismiss = useCallback((toastId: string) => {
    setState((prev) => ({
      toasts: prev.toasts.filter((t) => t.id !== toastId),
    }))
  }, [])

  const toast = useCallback(
    (title: string, options: ToastOptions = {}): ToastAction => {
      const id = generateId()

      const newToast: Toast = {
        id,
        title,
        description: options.description,
        variant: options.variant ?? "default",
        duration: options.duration ?? 4_000,
        createdAt: Date.now(),
        ...(options.action && { action: options.action }),
      }

      setState((prev) => {
        const next = [...prev.toasts, newToast].slice(-TOAST_LIMIT)
        return { toasts: next }
      })

      const dismissTimer = setTimeout(() => {
        dismiss(id)
      }, newToast.duration)

      return {
        id,
        dismiss: () => {
          clearTimeout(dismissTimer)
          dismiss(id)
        },
      }
    },
    [dismiss],
  )

  // Expõe globalmente para uso fora de componentes React
  useEffect(() => {
    setGlobalToast(toast, dismiss)
    return () => {
      globalToast = null
      globalDismiss = null
    }
  }, [toast, dismiss])

  const value = useMemo(
    () => ({ toast, dismiss, toasts: state.toasts }),
    [toast, dismiss, state.toasts],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toaster />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)

  if (!context) {
    throw new Error("useToast must be used within ToastProvider")
  }

  return context
}

const variantStyles: Record<
  ToastVariant,
  { border: string; bg: string; text: string; icon: string }
> = {
  default: {
    border: "border-border",
    bg: "bg-card",
    text: "text-foreground",
    icon: "",
  },
  success: {
    border: "border-primary",
    bg: "bg-card",
    text: "text-foreground",
    icon: "✓",
  },
  error: {
    border: "border-destructive",
    bg: "bg-card",
    text: "text-foreground",
    icon: "✕",
  },
  warning: {
    border: "border-amber-500",
    bg: "bg-card",
    text: "text-foreground",
    icon: "!",
  },
  info: {
    border: "border-primary",
    bg: "bg-card",
    text: "text-foreground",
    icon: "i",
  },
}

function ToastContent({
  toast,
  onDismiss,
}: {
  toast: Toast
  onDismiss: () => void
}) {
  const style = variantStyles[toast.variant]

  return (
    <div
      className={`flex items-start gap-3 rounded-lg border p-4 shadow-lg animate-in fade-in slide-in-from-right-2 duration-300 ${style.border} ${style.bg} ${style.text}`}
    >
      {style.icon && (
        <span className="shrink-0 mt-0.5 text-xs font-bold">
          {style.icon}
        </span>
      )}
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-semibold leading-none">{toast.title}</h4>
        {toast.description && (
          <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
            {toast.description}
          </p>
        )}
      </div>

      {(() => {
        const action = toast.action
        if (!action) return null
        return (
          <button
            onClick={() => {
              action.onClick()
              onDismiss()
            }}
            className="shrink-0 text-xs font-medium bg-primary text-primary-foreground px-2.5 py-1.5 rounded hover:bg-primary/90 transition-colors"
          >
            {action.label}
          </button>
        )
      })()}

      <button
        onClick={onDismiss}
        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1"
        aria-label="Fechar"
      >
        ✕
      </button>
    </div>
  )
}

function ToastItem({ toast }: { toast: Toast }) {
  const [visible, setVisible] = useState(true)
  const { dismiss } = useToast()

  useEffect(() => {
    if (!visible) {
      const timer = setTimeout(() => {
        dismiss(toast.id)
      }, TOAST_REMOVE_DELAY)
      return () => clearTimeout(timer)
    }
  }, [visible, toast.id, dismiss])

  if (!visible) {
    return null
  }

  return (
    <div
      className="animate-in fade-in slide-in-from-right-2 duration-300"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(true)}
    >
      <ToastContent toast={toast} onDismiss={() => setVisible(false)} />
    </div>
  )
}

export function Toaster() {
  const { toasts } = useToast()

  return (
    <div
      className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none"
      aria-label="Notificações"
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto max-w-xs">
          <ToastItem toast={toast} />
        </div>
      ))}
    </div>
  )
}
