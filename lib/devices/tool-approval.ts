import type { ToolApprovalStatus } from "ai"
import { and, eq, isNull } from "drizzle-orm"
import { db } from "@/db"
import { devices } from "@/db/schema"
import { recordDeviceAudit, type DeviceAuditPolicy } from "./audit"
import {
  classifyDeviceToolRisk,
  evaluateDeviceToolCall,
  parseDeviceExecutionPolicy,
  type ChatExecutionMode,
  type DeviceExecutionPolicy,
  type DeviceToolRisk,
} from "./execution-policy"

export function readDeviceIdFromInput(input: unknown): string | null {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return null
  }

  const value = (input as Record<string, unknown>).deviceId

  return typeof value === "string" && value.length > 0 ? value : null
}

export function readDeviceToolCommand(
  toolName: string,
  input: unknown,
): string | undefined {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return undefined
  }

  const record = input as Record<string, unknown>

  if (toolName === "device-shell" && typeof record.script === "string") {
    return record.script
  }

  if (toolName === "device-run-command" && typeof record.command === "string") {
    const args = Array.isArray(record.args)
      ? record.args.filter((item): item is string => typeof item === "string")
      : []

    return [record.command, ...args].join(" ")
  }

  if (toolName === "device-delete" && typeof record.path === "string") {
    return record.path
  }

  if (
    (toolName === "device-copy" || toolName === "device-move") &&
    typeof record.from === "string" &&
    typeof record.to === "string"
  ) {
    return `${record.from} -> ${record.to}`
  }

  if (
    (toolName === "device-mkdir" ||
      toolName === "device-stat" ||
      toolName === "device-apply-patch") &&
    typeof record.path === "string"
  ) {
    return record.path
  }

  return undefined
}

/** Valor persistido na auditoria para a configuração do dispositivo. */
export function describeAuditPolicy(
  policy: DeviceExecutionPolicy,
): DeviceAuditPolicy {
  return policy.confirmDestructive ? "confirm" : "full"
}

export async function loadDevicePolicy(
  userId: string,
  deviceId: string,
): Promise<DeviceExecutionPolicy | null> {
  const [device] = await db
    .select({ executionPolicy: devices.executionPolicy })
    .from(devices)
    .where(
      and(
        eq(devices.id, deviceId),
        eq(devices.userId, userId),
        isNull(devices.revokedAt),
      ),
    )
    .limit(1)

  if (!device) {
    return null
  }

  return parseDeviceExecutionPolicy(device.executionPolicy)
}

type ResolveDeviceToolApprovalInput = {
  userId: string
  chatId?: string | null
  executionMode: ChatExecutionMode
  toolName: string
  input: unknown
}

/**
 * Chamado pelo `toolApproval` do agente antes de qualquer tool de dispositivo.
 * Tools que não são de dispositivo retornam `undefined` e seguem o fluxo
 * normal do SDK.
 */
export async function resolveDeviceToolApproval({
  userId,
  chatId,
  executionMode,
  toolName,
  input,
}: ResolveDeviceToolApprovalInput): Promise<ToolApprovalStatus> {
  const risk = classifyDeviceToolRisk(toolName, input)

  if (risk === null) {
    return undefined
  }

  if (risk === "read") {
    return "approved"
  }

  const deviceId = readDeviceIdFromInput(input)

  if (!deviceId) {
    return {
      type: "denied",
      reason: "A chamada não informou um dispositivo válido.",
    }
  }

  let policy: DeviceExecutionPolicy | null

  try {
    policy = await loadDevicePolicy(userId, deviceId)
  } catch {
    return {
      type: "denied",
      reason:
        "Não foi possível verificar a política do dispositivo. Tente novamente.",
    }
  }

  if (!policy) {
    return {
      type: "denied",
      reason:
        "Dispositivo não encontrado, revogado ou pertencente a outra conta.",
    }
  }

  const decision = evaluateDeviceToolCall({
    policy,
    mode: executionMode,
    risk,
  })
  const command = readDeviceToolCommand(toolName, input)

  if (decision.action === "allow") {
    await recordDeviceAudit({
      deviceId,
      userId,
      chatId,
      toolName,
      command,
      risk,
      decision: "approved",
      policy: describeAuditPolicy(policy),
      mode: executionMode,
    })

    return "approved"
  }

  if (decision.action === "deny") {
    await recordDeviceAudit({
      deviceId,
      userId,
      chatId,
      toolName,
      command,
      risk,
      decision: "denied",
      policy: describeAuditPolicy(policy),
      mode: executionMode,
      errorCode: "policy_denied",
    })

    return { type: "denied", reason: decision.reason }
  }

  await recordDeviceAudit({
    deviceId,
    userId,
    chatId,
    toolName,
    command,
    risk,
    decision: "approval-requested",
    policy: describeAuditPolicy(policy),
    mode: executionMode,
  })

  return { type: "user-approval", reason: decision.reason }
}

/**
 * Defesa em profundidade: mesmo que a aprovação seja perdida no caminho, o
 * app não envia comandos de escrita/execução em Modo Leitura.
 */
export async function assertDeviceCommandAllowed({
  userId,
  deviceId,
  executionMode,
  toolName,
  input,
}: {
  userId: string
  deviceId: string
  executionMode: ChatExecutionMode
  toolName: string
  input: unknown
}): Promise<{ ok: true; risk: DeviceToolRisk; policy: DeviceExecutionPolicy } | {
  ok: false
  risk: DeviceToolRisk
  policy: DeviceExecutionPolicy
  code: string
  error: string
}> {
  const risk = classifyDeviceToolRisk(toolName, input) ?? "write"
  const policy =
    (await loadDevicePolicy(userId, deviceId)) ??
    ({ confirmDestructive: true } satisfies DeviceExecutionPolicy)
  const decision = evaluateDeviceToolCall({
    policy,
    mode: executionMode,
    risk,
  })

  if (decision.action === "deny") {
    return {
      ok: false,
      risk,
      policy,
      code: "policy_denied",
      error: decision.reason,
    }
  }

  return { ok: true, risk, policy }
}
