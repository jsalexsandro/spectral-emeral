export type ToastVariant = "default" | "success" | "error" | "warning" | "info"

export type ToastAction = {
  label: string
  onClick: () => void
}

export type ToastOptions = {
  description?: string
  duration?: number
  variant?: ToastVariant
  action?: ToastAction
  /** Chamado quando o toast é fechado, expira ou tem a ação acionada. */
  onDismiss?: () => void
}

export type Toast = {
  id: string
  title: string
  description?: string
  variant: ToastVariant
  duration: number
  createdAt: number
  action?: ToastAction
  onDismiss?: () => void
}

export type ToastHandle = {
  id: string
  dismiss: () => void
}

const TOAST_LIMIT = 5
const DEFAULT_DURATION = 4_000
const MIN_RESUME_DELAY = 1_500

type TimerState = {
  timer: ReturnType<typeof setTimeout> | null
  remaining: number
  startedAt: number
}

let toasts: Toast[] = []
let snapshot: Toast[] = toasts
const listeners = new Set<() => void>()
const timers = new Map<string, TimerState>()

function emit() {
  for (const listener of listeners) {
    listener()
  }
}

function setToasts(next: Toast[]) {
  toasts = next
  snapshot = next
  emit()
}

function generateId() {
  return Math.random().toString(36).slice(2, 10)
}

function clearTimer(id: string) {
  const state = timers.get(id)

  if (!state) {
    return
  }

  if (state.timer) {
    clearTimeout(state.timer)
  }

  timers.delete(id)
}

function scheduleRemoval(id: string, delay: number) {
  const state = timers.get(id)

  if (!state) {
    return
  }

  state.remaining = delay
  state.startedAt = Date.now()
  state.timer = setTimeout(() => dismissToast(id), delay)
}

/**
 * Store fora do React para que `toast()` funcione de qualquer lugar
 * (inclusive antes do provider montar) sem depender de referência global.
 */
export function subscribeToToasts(listener: () => void) {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}

export function getToastsSnapshot(): Toast[] {
  return snapshot
}

export function createToast(
  title: string,
  options: ToastOptions = {},
): ToastHandle {
  const id = generateId()
  const duration = options.duration ?? DEFAULT_DURATION
  const toast: Toast = {
    id,
    title,
    description: options.description,
    variant: options.variant ?? "default",
    duration,
    createdAt: Date.now(),
    action: options.action,
    onDismiss: options.onDismiss,
  }

  timers.set(id, { timer: null, remaining: duration, startedAt: 0 })

  const next = [...toasts, toast]

  while (next.length > TOAST_LIMIT) {
    const removed = next.shift()

    if (removed) {
      clearTimer(removed.id)
    }
  }

  setToasts(next)

  if (duration > 0) {
    scheduleRemoval(id, duration)
  }

  return {
    id,
    dismiss: () => dismissToast(id),
  }
}

export function dismissToast(id: string) {
  const target = toasts.find((toast) => toast.id === id)

  if (!target) {
    return
  }

  clearTimer(id)
  setToasts(toasts.filter((toast) => toast.id !== id))
  target.onDismiss?.()
}

export function pauseToast(id: string) {
  const state = timers.get(id)

  if (!state || !state.timer) {
    return
  }

  clearTimeout(state.timer)
  state.timer = null
  state.remaining = Math.max(0, state.remaining - (Date.now() - state.startedAt))
}

export function resumeToast(id: string) {
  const state = timers.get(id)

  if (!state || state.timer || state.remaining <= 0) {
    return
  }

  scheduleRemoval(id, Math.max(state.remaining, MIN_RESUME_DELAY))
}

export function clearToasts() {
  for (const id of [...timers.keys()]) {
    clearTimer(id)
  }

  setToasts([])
}
