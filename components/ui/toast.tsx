"use client"

import { useSyncExternalStore, type ReactNode } from "react"
import {
  createToast,
  dismissToast,
  getToastsSnapshot,
  pauseToast,
  resumeToast,
  subscribeToToasts,
  type Toast,
  type ToastVariant,
} from "@/lib/toast-store"

export type {
  Toast,
  ToastAction,
  ToastHandle,
  ToastOptions,
  ToastVariant,
} from "@/lib/toast-store"

const variantStyles: Record<
  ToastVariant,
  { border: string; icon: string }
> = {
  default: { border: "border-border", icon: "" },
  success: { border: "border-primary", icon: "✓" },
  error: { border: "border-destructive", icon: "✕" },
  warning: { border: "border-amber-500", icon: "!" },
  info: { border: "border-primary", icon: "i" },
}

function useToasts() {
  return useSyncExternalStore(
    subscribeToToasts,
    getToastsSnapshot,
    getToastsSnapshot,
  )
}

function ToastContent({ toast }: { toast: Toast }) {
  const style = variantStyles[toast.variant]
  const action = toast.action

  return (
    <div
      className={`flex items-start gap-3 rounded-lg border bg-card p-4 text-foreground shadow-lg ${style.border}`}
    >
      {style.icon && (
        <span className="mt-0.5 shrink-0 text-xs font-bold">{style.icon}</span>
      )}

      <div className="min-w-0 flex-1">
        <h4 className="text-sm font-semibold leading-none">{toast.title}</h4>
        {toast.description && (
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {toast.description}
          </p>
        )}
      </div>

      {action && (
        <button
          type="button"
          onClick={() => {
            action.onClick()
            dismissToast(toast.id)
          }}
          className="shrink-0 rounded bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {action.label}
        </button>
      )}

      <button
        type="button"
        onClick={() => dismissToast(toast.id)}
        className="shrink-0 rounded p-1 text-muted-foreground opacity-60 transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        aria-label="Fechar notificação"
      >
        ✕
      </button>
    </div>
  )
}

function ToastItem({ toast }: { toast: Toast }) {
  return (
    <div
      className="pointer-events-auto animate-in fade-in slide-in-from-right-2 duration-300"
      onMouseEnter={() => pauseToast(toast.id)}
      onMouseLeave={() => resumeToast(toast.id)}
      onFocusCapture={() => pauseToast(toast.id)}
      onBlurCapture={() => resumeToast(toast.id)}
    >
      <ToastContent toast={toast} />
    </div>
  )
}

export function Toaster() {
  const toasts = useToasts()

  return (
    <div
      aria-live="polite"
      aria-label="Notificações"
      className="pointer-events-none fixed top-4 right-4 z-50 flex w-[min(20rem,calc(100vw-2rem))] flex-col gap-2"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <Toaster />
    </>
  )
}

export function useToast() {
  const toasts = useToasts()

  return {
    toast: createToast,
    dismiss: dismissToast,
    toasts,
  }
}
