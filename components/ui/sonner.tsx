"use client"

import { Toaster as SonnerToaster } from "sonner"

import { useTheme } from "@/components/theme-provider"

export function Toaster() {
  const { theme } = useTheme()

  return (
    <SonnerToaster
      theme={theme}
      richColors
      closeButton
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast: "group toast group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-soft",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          error: "group-[.toaster]:border-destructive/40",
          success: "group-[.toaster]:border-primary/40",
          warning: "group-[.toaster]:border-amber-500/40",
          info: "group-[.toaster]:border-border",
        },
      }}
    />
  )
}
