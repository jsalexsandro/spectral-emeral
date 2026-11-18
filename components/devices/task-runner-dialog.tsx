"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  Loader2,
  Play,
  RefreshCw,
  Square,
  Terminal,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/components/ui/sonner"
import type { DeviceSummary } from "@/lib/devices/types"
import { cn } from "@/lib/utils"
import {
  DEVICE_SHELL_KINDS,
  type DeviceJob,
  type DeviceJobOutput,
  type DeviceJobStatus,
  type DeviceShellKind,
} from "@/spectral/shared/device-commands"

const POLL_INTERVAL_MS = 3_000
const OUTPUT_POLL_INTERVAL_MS = 2_000

const STATUS_LABELS: Record<DeviceJobStatus, string> = {
  running: "Em execução",
  exited: "Concluído",
  killed: "Cancelado",
  failed: "Falhou",
}

const STATUS_VARIANTS: Record<
  DeviceJobStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  running: "default",
  exited: "outline",
  killed: "secondary",
  failed: "destructive",
}

type TaskRunnerDialogProps = {
  device: DeviceSummary | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

async function errorMessage(response: Response, fallback: string) {
  const data = (await response.json().catch(() => null)) as
    | { error?: string; message?: string }
    | null

  return data?.message ?? data?.error ?? fallback
}

function reportJobsError(error: unknown) {
  toast.error(
    error instanceof Error ? error.message : "Falha ao listar tarefas.",
  )
}

export function TaskRunnerDialog({
  device,
  open,
  onOpenChange,
}: TaskRunnerDialogProps) {
  const [jobs, setJobs] = useState<DeviceJob[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [isCancelling, setIsCancelling] = useState<string | null>(null)
  const [script, setScript] = useState("")
  const [shell, setShell] = useState<DeviceShellKind>("auto")
  const [cwd, setCwd] = useState("")
  const [label, setLabel] = useState("")
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [output, setOutput] = useState<DeviceJobOutput | null>(null)
  const cursorRef = useRef(0)

  const deviceId = device?.id
  const isOnline = device?.status === "online"

  const fetchJobs = useCallback(async (): Promise<DeviceJob[]> => {
    if (!deviceId) {
      return []
    }

    const response = await fetch(
      `/api/devices/${encodeURIComponent(deviceId)}/jobs`,
      { cache: "no-store" },
    )

    if (!response.ok) {
      throw new Error(await errorMessage(response, "Falha ao listar tarefas"))
    }

    const data = (await response.json()) as { jobs?: DeviceJob[] }

    return data.jobs ?? []
  }, [deviceId])

  const loadJobs = useCallback(async () => {
    try {
      setJobs(await fetchJobs())
    } catch (error) {
      reportJobsError(error)
    } finally {
      setIsLoading(false)
    }
  }, [fetchJobs])

  const refreshJobs = useCallback(async () => {
    setIsLoading(true)
    await loadJobs()
  }, [loadJobs])

  const readOutput = useCallback(
    async (jobId: string, cursor: number) => {
      if (!deviceId) {
        return null
      }

      const params = new URLSearchParams({
        view: "output",
        cursor: String(cursor),
      })
      const response = await fetch(
        `/api/devices/${encodeURIComponent(deviceId)}/jobs/${encodeURIComponent(jobId)}?${params}`,
        { cache: "no-store" },
      )

      if (!response.ok) {
        throw new Error(await errorMessage(response, "Falha ao ler a saída"))
      }

      const data = (await response.json()) as {
        jobOutput?: DeviceJobOutput
      }

      return data.jobOutput ?? null
    },
    [deviceId],
  )

  useEffect(() => {
    if (!open || !deviceId) {
      return
    }

    const apply = () => {
      void fetchJobs().then(setJobs).catch(reportJobsError)
    }

    apply()
    const timer = setInterval(apply, POLL_INTERVAL_MS)

    return () => clearInterval(timer)
  }, [open, deviceId, fetchJobs])

  useEffect(() => {
    if (!open || !selectedJobId) {
      return
    }

    let active = true

    const poll = async () => {
      try {
        const next = await readOutput(selectedJobId, cursorRef.current)

        if (!active || !next) {
          return
        }

        cursorRef.current = next.nextCursor
        setOutput((current) =>
          current && current.jobId === next.jobId
            ? { ...next, chunks: [...current.chunks, ...next.chunks] }
            : next,
        )
      } catch (error) {
        if (active) {
          toast.error(
            error instanceof Error ? error.message : "Falha ao ler a saída.",
          )
        }
      }
    }

    void poll()
    const timer = setInterval(() => void poll(), OUTPUT_POLL_INTERVAL_MS)

    return () => {
      active = false
      clearInterval(timer)
    }
  }, [open, selectedJobId, readOutput])

  function selectJob(jobId: string) {
    setSelectedJobId((current) => (current === jobId ? null : jobId))
    cursorRef.current = 0
    setOutput(null)
  }

  async function handleStart(event: React.FormEvent) {
    event.preventDefault()

    if (!deviceId || !isOnline || isStarting) {
      return
    }

    setIsStarting(true)

    try {
      const response = await fetch(
        `/api/devices/${encodeURIComponent(deviceId)}/jobs`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            script,
            shell,
            ...(cwd.trim() ? { cwd: cwd.trim() } : {}),
            ...(label.trim() ? { label: label.trim() } : {}),
          }),
        },
      )

      if (!response.ok) {
        throw new Error(await errorMessage(response, "Falha ao iniciar a tarefa"))
      }

      const data = (await response.json()) as { job?: DeviceJob }

      if (!data.job) {
        throw new Error("O dispositivo não retornou o job criado.")
      }

      toast.success("Tarefa iniciada.")
      setScript("")
      setLabel("")
      setSelectedJobId(data.job.id)
      cursorRef.current = 0
      setOutput(null)
      await loadJobs()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha ao iniciar a tarefa.",
      )
    } finally {
      setIsStarting(false)
    }
  }

  async function handleCancel(jobId: string) {
    if (!deviceId || isCancelling) {
      return
    }

    setIsCancelling(jobId)

    try {
      const response = await fetch(
        `/api/devices/${encodeURIComponent(deviceId)}/jobs/${encodeURIComponent(jobId)}`,
        { method: "DELETE" },
      )

      if (!response.ok) {
        throw new Error(await errorMessage(response, "Falha ao cancelar a tarefa"))
      }

      toast.success("Tarefa cancelada.")
      await loadJobs()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha ao cancelar a tarefa.",
      )
    } finally {
      setIsCancelling(null)
    }
  }

  const selectedJob = jobs.find((job) => job.id === selectedJobId)
  const outputText = output?.chunks.map((chunk) => chunk.text).join("") ?? ""

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Tarefas de {device?.name ?? "dispositivo"}</DialogTitle>
          <DialogDescription>
            Processos em segundo plano mantidos pelo driver. A lista, a saída e
            o cancelamento vêm do próprio dispositivo.
          </DialogDescription>
        </DialogHeader>

        {!isOnline ? (
          <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            O dispositivo está offline. Conecte-o para acompanhar tarefas.
          </p>
        ) : (
          <form onSubmit={handleStart} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="task-script">Script</Label>
              <textarea
                id="task-script"
                value={script}
                onChange={(event) => setScript(event.target.value)}
                placeholder="Ex.: npm run build"
                rows={4}
                maxLength={64 * 1024}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs outline-none focus:border-primary"
              />
              <p className="text-xs text-muted-foreground">
                O script é gravado em arquivo temporário; nada é interpolado na
                linha de comando.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="task-shell">Shell</Label>
                <select
                  id="task-shell"
                  value={shell}
                  onChange={(event) =>
                    setShell(event.target.value as DeviceShellKind)
                  }
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                >
                  {DEVICE_SHELL_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {kind}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="task-cwd">Diretório</Label>
                <Input
                  id="task-cwd"
                  value={cwd}
                  onChange={(event) => setCwd(event.target.value)}
                  placeholder="Pasta padrão do dispositivo"
                  maxLength={1024}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="task-label">Rótulo</Label>
                <Input
                  id="task-label"
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                  placeholder="Opcional"
                  maxLength={80}
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={isStarting || !script.trim()}>
                {isStarting ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Play />
                )}
                Iniciar tarefa
              </Button>
            </div>
          </form>
        )}

        <div className="space-y-2 border-t border-border pt-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Em andamento e recentes</h4>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Atualizar tarefas"
              disabled={isLoading}
              onClick={() => void refreshJobs()}
            >
              <RefreshCw className={cn(isLoading && "animate-spin")} />
            </Button>
          </div>

          {jobs.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              Nenhuma tarefa registrada neste dispositivo.
            </p>
          ) : (
            <div className="space-y-2">
              {jobs.map((job) => (
                <div
                  key={job.id}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3"
                >
                  <div className="min-w-0 flex-1 basis-52">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-medium">
                        {job.label ?? job.id}
                      </span>
                      <Badge variant={STATUS_VARIANTS[job.status]}>
                        {STATUS_LABELS[job.status]}
                      </Badge>
                    </div>
                    <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                      {job.id} · {job.shell} · {job.cwd}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {Math.round(job.durationMs / 1000)}s
                      {job.exitCode !== null
                        ? ` · exit ${job.exitCode}`
                        : ""}
                      {job.truncated ? " · saída truncada" : ""}
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => selectJob(job.id)}
                  >
                    <Terminal />
                    {selectedJobId === job.id ? "Ocultar saída" : "Ver saída"}
                  </Button>
                  {job.status === "running" && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={isCancelling === job.id}
                      onClick={() => void handleCancel(job.id)}
                    >
                      {isCancelling === job.id ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <Square />
                      )}
                      Cancelar
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedJob && (
          <div className="space-y-2 border-t border-border pt-4">
            <h4 className="text-sm font-medium">
              Saída de {selectedJob.label ?? selectedJob.id}
            </h4>
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-3 font-mono text-xs">
              {outputText || "Aguardando saída…"}
            </pre>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
