"use client"

import { ToastProvider, Toaster, useToast } from "@/components/ui/toast"
import type { Toast, ToastVariant } from "@/components/ui/toast"

type ToastOptions = {
  description?: string
  duration?: number
  variant?: ToastVariant
}

function buildToast(variant?: ToastVariant) {
  return (title: string, options?: ToastOptions) => {
    const { toast } = useToast()
    return toast(title, { ...options, variant })
  }
}

const baseToast = (title: string, options?: ToastOptions) => {
  const { toast } = useToast()
  return toast(title, options)
}

export const toast = Object.assign(baseToast, {
  success: buildToast("success"),
  error: buildToast("error"),
  warning: buildToast("warning"),
  info: buildToast("info"),
})

export { ToastProvider, Toaster }
export type { ToastOptions }

export function SonnerToaster() {
  return <Toaster />
}
