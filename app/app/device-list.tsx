"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Laptop, Loader2 } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { DeviceSummary } from "@/lib/devices/types"
import { cn } from "@/lib/utils"
import { useAppActions } from "./app-actions-provider"

const POLL_INTERVAL_MS = 10_000
const MAX_VISIBLE_DEVICES = 3

type DeviceListProps = {
  collapsed?: boolean
}

export function DeviceList({ collapsed = false }: DeviceListProps) {
  const [devices, setDevices] = useState<DeviceSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const requestId = useRef(0)
  const isMounted = useRef(true)
  const { openSettings } = useAppActions()

  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
    }
  }, [])

  const loadDevices = useCallback(async () => {
    const currentRequest = requestId.current + 1
    requestId.current = currentRequest

    try {
      const response = await fetch("/api/devices", { cache: "no-store" })

      if (!response.ok) {
        throw new Error("Falha ao carregar")
      }

      const data = (await response.json()) as { devices: DeviceSummary[] }

      if (isMounted.current && requestId.current === currentRequest) {
        setDevices(data.devices)
        setHasError(false)
      }
    } catch {
      if (isMounted.current && requestId.current === currentRequest) {
        setHasError(true)
      }
    } finally {
      if (isMounted.current && requestId.current === currentRequest) {
        setIsLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    const initial = setTimeout(() => {
      void loadDevices()
    }, 0)

    const interval = setInterval(() => {
      void loadDevices()
    }, POLL_INTERVAL_MS)

    return () => {
      clearTimeout(initial)
      clearInterval(interval)
    }
  }, [loadDevices])

  const visibleDevices = devices.slice(0, MAX_VISIBLE_DEVICES)

  if (collapsed) {
    if (visibleDevices.length === 0) {
      return null
    }

    return (
      <div className="mt-3 flex shrink-0 flex-col items-center gap-1 border-t border-border pt-3">
        {visibleDevices.map((device) => {
          const online = device.status === "online"

          return (
            <Tooltip key={device.id}>
              <TooltipTrigger
                type="button"
                onClick={() => openSettings("devices")}
                aria-label={`${device.name} — ${online ? "online" : "offline"}`}
                className="relative flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-ring"
              >
                <Laptop className="size-4" />
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-1 right-1 size-1.5 rounded-full ring-2 ring-card",
                    online ? "bg-emerald-500" : "bg-muted-foreground/50",
                  )}
                />
              </TooltipTrigger>
              <TooltipContent side="right">
                {device.name} · {online ? "Online" : "Offline"}
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>
    )
  }

  return (
    <div className="mt-4 shrink-0">
      <div className="flex items-center justify-between px-2 pb-1">
        <p className="text-xs font-medium text-muted-foreground">
          Dispositivos
        </p>
        {isLoading && devices.length === 0 && (
          <Loader2 className="size-3 animate-spin text-muted-foreground" />
        )}
      </div>

      {isLoading && devices.length === 0 ? (
        <p className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground">
          <Loader2 className="size-3 animate-spin" />
          Carregando...
        </p>
      ) : hasError && devices.length === 0 ? (
        <p className="px-2 py-1.5 text-xs text-muted-foreground">
          Não foi possível carregar os dispositivos.
        </p>
      ) : devices.length === 0 ? (
        <p className="px-2 py-1.5 text-xs text-muted-foreground">
          Nenhum dispositivo.
        </p>
      ) : (
        <ul className="space-y-0.5">
          {visibleDevices.map((device) => {
            const online = device.status === "online"

            return (
              <li key={device.id}>
                <button
                  type="button"
                  onClick={() => openSettings("devices")}
                  title={`${device.name} — ${online ? "Online" : "Offline"}`}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <Laptop className="size-3.5 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">
                    {device.name}
                  </span>
                  <span
                    className={cn(
                      "size-1.5 shrink-0 rounded-full",
                      online ? "bg-emerald-500" : "bg-muted-foreground/50",
                    )}
                    aria-label={online ? "Online" : "Offline"}
                  />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
