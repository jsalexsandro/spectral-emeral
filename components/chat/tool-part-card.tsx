import { Globe, ImageIcon, Loader2, X } from "lucide-react"
import {
  getToolName,
  type DynamicToolUIPart,
  type ToolUIPart,
} from "ai"
import {
  DEVICE_SCREENSHOT_TOOL_NAME,
  readDeviceScreenshotToolOutput,
} from "@/lib/devices/screenshot-tool"

type ToolPartCardProps = {
  part: ToolUIPart | DynamicToolUIPart
}

export function ToolPartCard({ part }: ToolPartCardProps) {
  const toolName = getToolName(part)
  const state = part.state as string
  const isError = part.state === "output-error"
  const isPending =
    state === "input-streaming" ||
    state === "input-available" ||
    state === "approval-requested" ||
    state === "approval-responded"
  const screenshotOutput =
    toolName === DEVICE_SCREENSHOT_TOOL_NAME
      ? readDeviceScreenshotToolOutput(
          (part as { output?: unknown }).output,
        )
      : null

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

  return null
}
