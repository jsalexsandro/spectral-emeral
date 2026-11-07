"use client"

import {
  createToast,
  type ToastOptions,
  type ToastVariant,
} from "@/lib/toast-store"
import { Toaster, ToastProvider } from "@/components/ui/toast"

function buildToast(variant: ToastVariant) {
  return (title: string, options?: ToastOptions) => {
    return createToast(title, { ...options, variant })
  }
}

const baseToast = (title: string, options?: ToastOptions) => {
  return createToast(title, options)
}

export const toast = Object.assign(baseToast, {
  success: buildToast("success"),
  error: buildToast("error"),
  warning: buildToast("warning"),
  info: buildToast("info"),
})

export { ToastProvider, Toaster }
export type {
  Toast,
  ToastAction,
  ToastHandle,
  ToastOptions,
  ToastVariant,
} from "@/lib/toast-store"

export function SonnerToaster() {
  return <Toaster />
}

export { useToast } from "@/components/ui/toast"
