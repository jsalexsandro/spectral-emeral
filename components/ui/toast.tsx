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
}

type ToastOptions = {
  description?: string
  duration?: number
  variant?: ToastVariant
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
