import { and, eq, isNull } from "drizzle-orm"
import { db } from "@/db"
import { devices } from "@/db/schema"
import type { DeviceCommandSuccess } from "@/spectral/shared/device-commands"
import type { SendDeviceCommandOutput } from "./command-client"
import { checkRateLimit } from "./rate-limit"

const JOB_RATE_LIMIT_MAX = 60
const JOB_RATE_LIMIT_WINDOW_MS = 10_000

/**
 * As rotas de tarefas não guardam estado: o driver é a fonte da verdade dos
 * jobs. Aqui só há posse do dispositivo, rate limit e tradução de erro.
 */
export async function ownsDevice(
  deviceId: string,
  userId: string,
): Promise<boolean> {
  const [device] = await db
    .select({ id: devices.id })
    .from(devices)
    .where(
      and(
        eq(devices.id, deviceId),
        eq(devices.userId, userId),
        isNull(devices.revokedAt),
      ),
    )
    .limit(1)

  return Boolean(device)
}

export function checkJobRateLimit(key: string) {
  return checkRateLimit(key, JOB_RATE_LIMIT_MAX, JOB_RATE_LIMIT_WINDOW_MS)
}

export function rateLimitedResponse(retryAfterMs: number) {
  return Response.json(
    {
      error: "rate_limited",
      message: "Muitas consultas de tarefas. Aguarde um instante.",
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.max(1, Math.ceil(retryAfterMs / 1000))),
      },
    },
  )
}

function statusForJobError(code: string): number {
  switch (code) {
    case "device_not_found":
    case "job_not_found":
      return 404
    case "device_offline":
    case "device_busy":
    case "device_disconnected":
    case "command_failed":
    case "job_limit":
    case "job_failed":
      return 409
    case "command_timeout":
      return 504
    default:
      return 502
  }
}

function failureResponse(code: string, message: string) {
  return Response.json(
    { error: code, message },
    { status: statusForJobError(code) },
  )
}

/**
 * Estreita o resultado do transporte para as rotas: devolve a resposta de erro
 * pronta quando o comando falhou, ou o resultado bem-sucedido do driver.
 */
export function unwrapJobCommand(
  output: SendDeviceCommandOutput,
): Response | { ok: true; result: DeviceCommandSuccess } {
  if (!output.ok) {
    return failureResponse(output.code, output.error)
  }

  if (!output.result.ok) {
    return failureResponse(
      output.result.code ?? "command_failed",
      output.result.error ?? "O dispositivo não concluiu a tarefa.",
    )
  }

  return { ok: true, result: output.result }
}
