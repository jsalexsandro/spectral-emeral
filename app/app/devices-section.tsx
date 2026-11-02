"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  Laptop,
  Loader2,
  MonitorSmartphone,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import type { DeviceSummary } from "@/lib/devices/types"
import { cn } from "@/lib/utils"

const POLL_INTERVAL_MS = 10_000

const platformLabels: Record<string, string> = {
  win32: "Windows",
  darwin: "macOS",
  linux: "Linux",
}

const pairingErrorMessages: Record<string, string> = {
  invalid_code: "Código inválido. Confira os caracteres e tente novamente.",
  expired_code: "Este código expirou. Gere um novo código no driver.",
  used_code: "Este código já foi utilizado.",
  already_paired:
    "Este dispositivo já está emparelhado. Revogue o dispositivo antigo antes de emparelhar novamente.",
  rate_limited: "Muitas tentativas. Aguarde um minuto e tente novamente.",
  unauthorized: "Sua sessão expirou. Entre novamente.",
}

function formatLastSeen(value: string | null): string {
  if (!value) {
    return "Nunca conectado"
  }

  const timestamp = Date.parse(value)

  if (Number.isNaN(timestamp)) {
    return "Nunca conectado"
  }

  const diffSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000))

  if (diffSeconds < 60) {
    return "Agora mesmo"
  }

  if (diffSeconds < 3_600) {
    return `Há ${Math.floor(diffSeconds / 60)} min`
  }

  if (diffSeconds < 86_400) {
    return `Há ${Math.floor(diffSeconds / 3_600)} h`
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(timestamp)
}

function getPlatformLabel(platform: string): string {
  return platformLabels[platform] ?? platform
}

export function DevicesSection() {
  const [devices, setDevices] = useState<DeviceSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const [pairingOpen, setPairingOpen] = useState(false)
  const [code, setCode] = useState("")
  const [isConfirming, setIsConfirming] = useState(false)
  const [pairingError, setPairingError] = useState<string | null>(null)

  const [renaming, setRenaming] = useState<DeviceSummary | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [isRenaming, setIsRenaming] = useState(false)

  const [revoking, setRevoking] = useState<DeviceSummary | null>(null)
  const [isRevoking, setIsRevoking] = useState(false)

  const requestId = useRef(0)
  const isMounted = useRef(true)

  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
    }
  }, [])

  const loadDevices = useCallback(async (showSpinner = false) => {
    const currentRequest = requestId.current + 1
    requestId.current = currentRequest

    if (showSpinner) {
      setIsRefreshing(true)
    }

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
        setIsRefreshing(false)
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

  async function handleConfirmPairing(event: React.FormEvent) {
    event.preventDefault()

    if (code.length !== 6 || isConfirming) {
      return
    }

    setIsConfirming(true)
    setPairingError(null)

    try {
      const response = await fetch("/api/devices/pairing/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      })

      const data = (await response.json().catch(() => null)) as
        | { error?: string; device?: DeviceSummary }
        | null

      if (!response.ok || !data?.device) {
        const errorCode = data?.error ?? "internal_error"
        setPairingError(
          pairingErrorMessages[errorCode] ??
            "Não foi possível emparelhar o dispositivo. Tente novamente.",
        )
        return
      }

      toast.success(`"${data.device.name}" emparelhado com sucesso.`)
      setCode("")
      setPairingOpen(false)
      await loadDevices()
    } catch {
      setPairingError("Não foi possível emparelhar o dispositivo.")
    } finally {
      setIsConfirming(false)
    }
  }

  function openRename(device: DeviceSummary) {
    setRenaming(device)
    setRenameValue(device.name)
  }

  async function handleRename(event: React.FormEvent) {
    event.preventDefault()

    if (!renaming || isRenaming) {
      return
    }

    const name = renameValue.trim()

    if (!name) {
      return
    }

    setIsRenaming(true)

    try {
      const response = await fetch(
        `/api/devices/${encodeURIComponent(renaming.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        },
      )

      const data = (await response.json().catch(() => null)) as
        | { device?: DeviceSummary }
        | null

      if (!response.ok || !data?.device) {
        throw new Error("Falha ao renomear")
      }

      setDevices((current) =>
        current.map((device) =>
          device.id === data.device?.id ? data.device : device,
        ),
      )
      toast.success("Nome atualizado.")
      setRenaming(null)
    } catch {
      toast.error("Não foi possível renomear o dispositivo.")
    } finally {
      setIsRenaming(false)
    }
  }

  async function handleRevoke() {
    if (!revoking || isRevoking) {
      return
    }

    setIsRevoking(true)

    try {
      const response = await fetch(
        `/api/devices/${encodeURIComponent(revoking.id)}`,
        { method: "DELETE" },
      )

      if (!response.ok) {
        throw new Error("Falha ao revogar")
      }

      setDevices((current) =>
        current.filter((device) => device.id !== revoking.id),
      )
      toast.success("Dispositivo revogado.")
      setRevoking(null)
    } catch {
      toast.error("Não foi possível revogar o dispositivo.")
    } finally {
      setIsRevoking(false)
    }
  }

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h3 className="font-heading text-base font-semibold">Dispositivos</h3>
        <p className="text-sm text-muted-foreground">
          Computadores conectados à sua conta.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={() => setPairingOpen(true)}>
          <Plus />
          Emparelhar dispositivo
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Atualizar dispositivos"
          disabled={isRefreshing}
          onClick={() => void loadDevices(true)}
        >
          <RefreshCw className={cn(isRefreshing && "animate-spin")} />
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1].map((item) => (
            <Skeleton key={item} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : hasError ? (
        <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
          <p>Não foi possível carregar os dispositivos.</p>
          <button
            type="button"
            onClick={() => void loadDevices()}
            className="mt-1 font-medium text-primary underline-offset-4 hover:underline"
          >
            Tentar novamente
          </button>
        </div>
      ) : devices.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center">
          <MonitorSmartphone className="mx-auto size-6 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">
            Nenhum dispositivo emparelhado
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Execute o driver em um computador e informe o código exibido.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {devices.map((device) => (
            <div
              key={device.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3"
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Laptop className="size-4" />
              </div>

              <div className="min-w-0 flex-1 basis-40">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-medium">{device.name}</p>
                  <Badge
                    variant="outline"
                    className="gap-1.5"
                    aria-label={`Status: ${device.status === "online" ? "online" : "offline"}`}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "size-1.5 rounded-full",
                        device.status === "online"
                          ? "bg-emerald-500"
                          : "bg-muted-foreground/50",
                      )}
                    />
                    {device.status === "online" ? "Online" : "Offline"}
                  </Badge>
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {[
                    device.hostname,
                    getPlatformLabel(device.platform),
                    device.architecture,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {formatLastSeen(device.lastSeenAt)} ·{" "}
                  <span className="font-mono">
                    {device.fingerprint.slice(0, 12)}…
                  </span>
                </p>
              </div>

              <div className="ml-auto flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Renomear ${device.name}`}
                  onClick={() => openRename(device)}
                >
                  <Pencil />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Revogar ${device.name}`}
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setRevoking(device)}
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={pairingOpen}
        onOpenChange={(open) => {
          setPairingOpen(open)

          if (!open) {
            setCode("")
            setPairingError(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Emparelhar dispositivo</DialogTitle>
            <DialogDescription>
              No computador que deseja conectar, execute o driver e informe o
              código exibido.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleConfirmPairing} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pairing-code">Código de emparelhamento</Label>
              <Input
                id="pairing-code"
                value={code}
                onChange={(event) => {
                  setCode(
                    event.target.value
                      .replace(/[^a-zA-Z0-9]/g, "")
                      .toUpperCase()
                      .slice(0, 6),
                  )
                  setPairingError(null)
                }}
                placeholder="ABC123"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={6}
                autoFocus
                className="h-11 text-center font-mono text-lg tracking-[0.4em] uppercase"
              />
              {pairingError ? (
                <p role="alert" className="text-xs text-destructive">
                  {pairingError}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  O código expira em 5 minutos e só pode ser usado uma vez.
                </p>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setPairingOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={code.length !== 6 || isConfirming}
              >
                {isConfirming && <Loader2 className="animate-spin" />}
                Emparelhar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={renaming !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRenaming(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renomear dispositivo</DialogTitle>
            <DialogDescription>
              Escolha um nome para identificar este computador.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleRename} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="device-name">Nome</Label>
              <Input
                id="device-name"
                value={renameValue}
                onChange={(event) => setRenameValue(event.target.value)}
                maxLength={80}
                autoFocus
                className="h-10"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRenaming(null)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={!renameValue.trim() || isRenaming}
              >
                {isRenaming && <Loader2 className="animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={revoking !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRevoking(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revogar dispositivo?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{revoking?.name}&quot; perderá o acesso e a conexão ativa será
              encerrada. Para voltar a usar, será necessário emparelhar
              novamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRevoking}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isRevoking}
              onClick={() => void handleRevoke()}
            >
              {isRevoking && <Loader2 className="animate-spin" />}
              Revogar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
