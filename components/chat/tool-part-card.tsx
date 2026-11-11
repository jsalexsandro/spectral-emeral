import { Check, Globe, ImageIcon, Loader2, ShieldAlert, ShieldCheck, ShieldX, X } from "lucide-react"
import {
  getToolName,
  type DynamicToolUIPart,
  type ToolUIPart,
} from "ai"
import {
  DEVICE_SCREENSHOT_TOOL_NAME,
  readDeviceScreenshotToolOutput,
} from "@/lib/devices/screenshot-tool"
import { summarizeToolInput } from "@/lib/ai/tools/tool-summary"
import { Button } from "@/components/ui/button"

type ToolPartCardProps = {
  part: ToolUIPart | DynamicToolUIPart
  onApprovalResponse?: (approvalId: string, approved: boolean) => void
}

type ApprovalInfo = {
  id: string
  approved?: boolean
  requestReason?: string
  reason?: string
}

function formatInputJson(input: unknown): string | null {
  if (input === undefined || input === null) {
    return null
  }

  try {
    const json = JSON.stringify(input, null, 2)

    return json && json !== "{}" ? json : null
  } catch {
    return null
  }
}

export function ToolPartCard({ part, onApprovalResponse }: ToolPartCardProps) {
  const toolName = getToolName(part)
  const state = part.state as string
  const isError = part.state === "output-error"
  const isPending =
    state === "input-streaming" || state === "input-available"
  const input = (part as { input?: unknown }).input
  const summary = summarizeToolInput(toolName, input)
  const inputJson = formatInputJson(input)
  const approval = (part as { approval?: ApprovalInfo }).approval
  const screenshotOutput =
    toolName === DEVICE_SCREENSHOT_TOOL_NAME
      ? readDeviceScreenshotToolOutput(
          (part as { output?: unknown }).output,
        )
      : null

  if (state === "approval-requested" && approval?.id) {
    return (
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 px-2.5 py-2 text-xs">
        <div className="flex items-start gap-2">
          <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">Aprovação necessária: {toolName}</p>
            {summary && (
              <p className="mt-0.5 break-words font-mono text-[11px] text-muted-foreground">
                {summary}
              </p>
            )}
            {inputJson && (
              <pre className="mt-1 max-h-40 overflow-auto rounded bg-muted/40 p-2 text-[11px] break-words whitespace-pre-wrap text-muted-foreground">
                {inputJson}
              </pre>
            )}
            {approval.requestReason && (
              <p className="mt-1.5 text-muted-foreground">
                {approval.requestReason}
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                className="h-7 px-2.5 text-xs"
                onClick={() => onApprovalResponse?.(approval.id, true)}
              >
                Permitir
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 px-2.5 text-xs"
                onClick={() => onApprovalResponse?.(approval.id, false)}
              >
                Negar
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (state === "approval-responded" && approval?.id) {
    const approved = approval.approved === true

    return (
      <div className="flex items-start gap-2 rounded-lg border border-border/70 bg-background/50 px-2.5 py-2 text-xs">
        {approved ? (
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
        ) : (
          <ShieldX className="mt-0.5 size-3.5 shrink-0 text-destructive" />
        )}
        <div className="min-w-0">
          <p className="font-medium">
            {approved ? "Aprovado" : "Negado"}: {toolName}
          </p>
          {summary && (
            <p className="mt-0.5 break-words font-mono text-[11px] text-muted-foreground">
              {summary}
            </p>
          )}
        </div>
      </div>
    )
  }

  if (isPending || isError) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-border/70 bg-background/50 px-2.5 py-2 text-xs">
        {isPending ? (
          <Loader2 className="mt-0.5 size-3.5 shrink-0 animate-spin text-muted-foreground" />
        ) : isError ? (
          <X className="mt-0.5 size-3.5 shrink-0 text-destructive" />
        ) : (
          <Globe className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
        )}
        <div className="min-w-0">
          <p className="font-medium">
            {isPending
              ? "Executando"
              : isError
                ? "Falha ao executar"
                : "Executou"}
            {" "}
            {toolName}
          </p>
          {summary && (
            <p className="mt-0.5 break-words font-mono text-[11px] text-muted-foreground">
              {summary}
            </p>
          )}
          {isError && part.errorText && (
            <p className="mt-0.5 break-words text-muted-foreground">
              {part.errorText}
            </p>
          )}
        </div>
      </div>
    )
  }

  if (screenshotOutput && !screenshotOutput.ok) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-2.5 py-2 text-xs">
        <X className="mt-0.5 size-3.5 shrink-0 text-destructive" />
        <div className="min-w-0">
          <p className="font-medium">Falha ao capturar a tela</p>
          <p className="mt-0.5 break-words text-muted-foreground">
            {screenshotOutput.error ?? screenshotOutput.code ?? "Erro desconhecido."}
          </p>
        </div>
      </div>
    )
  }

  if (screenshotOutput?.ok) {
    const { screenshot, deviceId } = screenshotOutput
    const src = `/api/devices/${encodeURIComponent(deviceId)}/screenshots/${encodeURIComponent(screenshot.id)}`
    const target =
      screenshot.monitor !== null
        ? `Monitor ${screenshot.monitor}`
        : "Tela inteira"

    return (
      <div className="overflow-hidden rounded-lg border border-border/70 bg-background/50">
        <div className="flex items-center gap-2 px-2.5 py-2 text-xs">
          <ImageIcon className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="font-medium">Captura de tela</span>
          <span className="ml-auto tabular-nums text-muted-foreground">
            {screenshot.width}×{screenshot.height} ·{" "}
            {screenshot.format.toUpperCase()}
          </span>
        </div>
        <a
          href={src}
          target="_blank"
          rel="noreferrer"
          className="block bg-muted/30"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={`Captura de tela de ${deviceId} (${target})`}
            width={screenshot.width}
            height={screenshot.height}
            loading="lazy"
            className="max-h-80 w-full object-contain"
          />
        </a>
        <p className="px-2.5 py-2 text-[11px] text-muted-foreground">
          {target} · região {screenshot.region.width}×{screenshot.region.height}{" "}
          em {screenshot.region.x},{screenshot.region.y} ·{" "}
          {Math.max(1, Math.round(screenshot.byteLength / 1024))} KB
        </p>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-2 rounded-lg border border-border/70 bg-background/50 px-2.5 py-2 text-xs">
      <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{toolName}</p>
        {summary && (
          <p className="mt-0.5 break-words font-mono text-[11px] text-muted-foreground">
            {summary}
          </p>
        )}
        {inputJson && (
          <details className="mt-1">
            <summary className="cursor-pointer text-[11px] text-muted-foreground select-none">
              argumentos
            </summary>
            <pre className="mt-1 max-h-48 overflow-auto rounded bg-muted/40 p-2 text-[11px] break-words whitespace-pre-wrap text-muted-foreground">
              {inputJson}
            </pre>
          </details>
        )}
      </div>
    </div>
  )
}
