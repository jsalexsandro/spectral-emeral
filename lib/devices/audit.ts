import { db } from "@/db"
import { deviceAuditEvents } from "@/db/schema"
import type {
  ChatExecutionMode,
  DeviceExecutionLevel,
  DeviceToolRisk,
} from "./execution-policy"

const MAX_COMMAND_LENGTH = 500

const SECRET_PATTERNS: Array<[RegExp, string]> = [
  [/(--password[=\s]+)[^\s'"]+/gi, "$1[redacted]"],
  [/(--token[=\s]+)[^\s'"]+/gi, "$1[redacted]"],
  [/(\b(?:password|passwd|pwd)\s*[=:]\s*)[^\s'"]+/gi, "$1[redacted]"],
  [
    /(\b(?:api[_-]?key|apikey|secret|token|access[_-]?token)\s*[=:]\s*)[^\s'"]+/gi,
    "$1[redacted]",
  ],
  [/(\bBearer\s+)[^\s'"]+/gi, "$1[redacted]"],
]

/**
 * Comandos podem conter segredos digitados pelo usuário. A auditoria guarda
 * apenas um resumo redigido e truncado.
 */
export function sanitizeAuditCommand(command: string | undefined): string | null {
  if (!command) {
    return null
  }

  let sanitized = command

  for (const [pattern, replacement] of SECRET_PATTERNS) {
    sanitized = sanitized.replace(pattern, replacement)
  }

  sanitized = sanitized.replace(/\s+/g, " ").trim()

  if (sanitized.length <= MAX_COMMAND_LENGTH) {
    return sanitized
  }

  return `${sanitized.slice(0, MAX_COMMAND_LENGTH)}…`
}

export type DeviceAuditDecision =
  | "approval-requested"
  | "approved"
  | "denied"
  | "executed"
  | "failed"

export type RecordDeviceAuditInput = {
  deviceId: string
  userId: string
  chatId?: string | null
  toolName: string
  command?: string
  risk: DeviceToolRisk
  decision: DeviceAuditDecision
  policy: DeviceExecutionLevel
  mode: ChatExecutionMode
  durationMs?: number | null
  exitCode?: number | null
  errorCode?: string | null
}

const MAX_ERROR_CODE_LENGTH = 64

/**
 * Falha de auditoria nunca deve derrubar a execução: registramos no log do
 * servidor e seguimos. A ausência de um evento é visível no log.
 */
export async function recordDeviceAudit(
  input: RecordDeviceAuditInput,
): Promise<void> {
  try {
    await db.insert(deviceAuditEvents).values({
      deviceId: input.deviceId,
      userId: input.userId,
      chatId: input.chatId ?? null,
      toolName: input.toolName,
      command: sanitizeAuditCommand(input.command),
      risk: input.risk,
      decision: input.decision,
      policy: input.policy,
      mode: input.mode,
      durationMs:
        input.durationMs === undefined || input.durationMs === null
          ? null
          : Math.max(0, Math.round(input.durationMs)),
      exitCode:
        input.exitCode === undefined || input.exitCode === null
          ? null
          : Math.trunc(input.exitCode),
      errorCode: input.errorCode
        ? input.errorCode.slice(0, MAX_ERROR_CODE_LENGTH)
        : null,
    })
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "device_audit_failed",
        deviceId: input.deviceId,
        toolName: input.toolName,
        decision: input.decision,
        message: error instanceof Error ? error.message : String(error),
      }),
    )
  }
}
