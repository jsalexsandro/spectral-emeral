"use client"

import { ToastProvider, Toaster, toastGlobal, useToast } from "@/components/ui/toast"
import type { Toast, ToastOptions, ToastVariant } from "@/components/ui/toast"

function buildToast(variant?: ToastVariant) {
  return (title: string, options?: ToastOptions) => {
    return toastGlobal(title, { ...options, variant })
  }
}

const baseToast = (title: string, options?: ToastOptions) => {
  return toastGlobal(title, options)
}

export const toast = Object.assign(baseToast, {
  success: buildToast("success"),
  error: buildToast("error"),
  warning: buildToast("warning"),
  info: buildToast("info"),
})

export { ToastProvider, Toaster }
export type { ToastOptions, Toast, ToastVariant }

export function SonnerToaster() {
  return <Toaster />
}

export { useToast }
