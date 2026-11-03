import {
  DEVICE_COMMAND_TIMEOUT_DEFAULT_MS,
  type DeviceCommand,
  type DeviceCommandResult,
} from "@/spectral/shared/device-commands"

const REQUEST_GRACE_MS = 5_000

export type SendDeviceCommandInput = {
  deviceId: string
  userId: string
  command: DeviceCommand
  timeoutMs?: number
}

export type SendDeviceCommandOutput =
  | { ok: true; result: DeviceCommandResult }
  | { ok: false; code: string; error: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function getBackendUrl(): string {
  return (process.env.SPECTRAL_BACKEND_URL ?? "http://localhost:4001").replace(
    /\/+$/,
    "",
  )
}

function getInternalSecret(): string {
  return (
    process.env.SPECTRAL_INTERNAL_SECRET ?? process.env.AUTH_SECRET ?? ""
  )
}

function parseResult(value: unknown): DeviceCommandResult | null {
  if (!isRecord(value) || typeof value.ok !== "boolean") {
    return null
  }

  if (value.ok) {
    return value as DeviceCommandResult
  }

  if (typeof value.error !== "string") {
    return null
  }

  return value as DeviceCommandResult
}

export async function sendDeviceCommand(
  input: SendDeviceCommandInput,
): Promise<SendDeviceCommandOutput> {
  const secret = getInternalSecret()

  if (!secret) {
    return {
      ok: false,
      code: "not_configured",
      error:
        "SPECTRAL_INTERNAL_SECRET (ou AUTH_SECRET) não definido no app.",
    }
  }

  const timeoutMs = input.timeoutMs ?? DEVICE_COMMAND_TIMEOUT_DEFAULT_MS
  const controller = new AbortController()
  const timer = setTimeout(
    () => controller.abort(),
    timeoutMs + REQUEST_GRACE_MS,
  )

  const url = `${getBackendUrl()}/internal/devices/${encodeURIComponent(
    input.deviceId,
  )}/commands`

  console.log(
    `[command-client] sending HTTP command id=${input.command.command} deviceId=${input.deviceId} url=${url}`,
  )

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-internal-secret": secret,
      },
      body: JSON.stringify({
        userId: input.userId,
        command: input.command.command,
        input: input.command.input,
        timeoutMs,
      }),
      cache: "no-store",
      signal: controller.signal,
    })

    const payload: unknown = await response.json().catch(() => null)

    console.log(
      `[command-client] HTTP response id=${input.command.command} deviceId=${input.deviceId} status=${response.status} payload=${JSON.stringify(payload).slice(0, 200)}`,
    )

    if (!response.ok) {
      if (isRecord(payload)) {
        return {
          ok: false,
          code:
            typeof payload.code === "string"
              ? payload.code
              : "request_failed",
          error:
            typeof payload.error === "string"
              ? payload.error
              : "O backend recusou o comando.",
        }
      }

      return {
        ok: false,
        code: "request_failed",
        error: "O backend recusou o comando.",
      }
    }

    if (!isRecord(payload)) {
      return {
        ok: false,
        code: "invalid_response",
        error: "Resposta inválida do backend.",
      }
    }

    const result = parseResult(payload.result)

    if (!result) {
      return {
        ok: false,
        code: "invalid_response",
        error: "Resposta inválida do backend.",
      }
    }

    const isFailure = "ok" in result && result.ok === false
    console.log(
      `[command-client] OK id=${input.command.command} deviceId=${input.deviceId} ok=true code=${isFailure ? result.code : "-"} error=${isFailure ? result.error : "-"}`,
    )

    return { ok: true, result }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return {
        ok: false,
        code: "command_timeout",
        error: "O dispositivo não respondeu dentro do prazo.",
      }
    }

    return {
      ok: false,
      code: "backend_unreachable",
      error: "Não foi possível contatar o backend de dispositivos.",
    }
  } finally {
    clearTimeout(timer)
  }
}
