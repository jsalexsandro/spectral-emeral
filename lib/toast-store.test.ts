import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  clearToasts,
  createToast,
  getToastsSnapshot,
  pauseToast,
  resumeToast,
} from "./toast-store"

describe("toast store", () => {
  beforeEach(() => {
    clearToasts()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("adiciona e remove toasts", () => {
    const handle = createToast("Olá")

    expect(getToastsSnapshot()).toHaveLength(1)

    handle.dismiss()

    expect(getToastsSnapshot()).toHaveLength(0)
  })

  it("mantém no máximo cinco toasts", () => {
    for (let index = 0; index < 7; index += 1) {
      createToast(`toast ${index}`)
    }

    const toasts = getToastsSnapshot()

    expect(toasts).toHaveLength(5)
    expect(toasts[0].title).toBe("toast 2")
    expect(toasts[4].title).toBe("toast 6")
  })

  it("chama onDismiss ao fechar", () => {
    const onDismiss = vi.fn()
    const handle = createToast("Olá", { onDismiss })

    handle.dismiss()

    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it("remove automaticamente após a duração", () => {
    vi.useFakeTimers()

    createToast("Olá", { duration: 1_000 })

    vi.advanceTimersByTime(999)
    expect(getToastsSnapshot()).toHaveLength(1)

    vi.advanceTimersByTime(1)
    expect(getToastsSnapshot()).toHaveLength(0)
  })

  it("pausa e retoma o timer no hover", () => {
    vi.useFakeTimers()

    const handle = createToast("Olá", { duration: 1_000 })

    vi.advanceTimersByTime(600)
    pauseToast(handle.id)

    vi.advanceTimersByTime(5_000)
    expect(getToastsSnapshot()).toHaveLength(1)

    resumeToast(handle.id)

    vi.advanceTimersByTime(1_500)
    expect(getToastsSnapshot()).toHaveLength(0)
  })
})
