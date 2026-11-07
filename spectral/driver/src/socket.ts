import { createPrivateKey, sign } from "node:crypto"
import { homedir } from "node:os"
import { WebSocket, type RawData } from "ws"
import {
  DeviceCommandValidationError,
  parseDeviceCommand,
  type DeviceCommandResult,
} from "../../shared/device-commands.js"
import { executeDeviceCommand } from "./commands/executor.js"
import type { DriverConfig } from "./config.js"
import type { DeviceIdentity } from "./identity.js"

const DEFAULT_HEARTBEAT_INTERVAL_MS = 15_000
const DEFAULT_HEARTBEAT_TIMEOUT_MS = 45_000
const MAX_PAYLOAD_BYTES = 256 * 1024
const HANDSHAKE_TIMEOUT_MS = 10_000

const FATAL_ERROR_CODES = new Set([
  "replaced",
  "revoked_device",
  "unknown_device",
  "auth_failed",
  "challenge_required",
  "challenge_expired",
  "invalid_message",
])

type ServerMessage =
  | { type: "device:challenge"; challenge: string; expiresAt?: string }
  | {
      type: "device:authenticated"
      heartbeatIntervalMs?: number
      heartbeatTimeoutMs?: number
      defaultFolder?: string | null
    }
  | { type: "device:heartbeat:ack"; serverTime?: string }
  | {
      type: "device:command"
      id?: string
      command?: string
      input?: unknown
    }
  | { type: "device:error"; code: string; message?: string }

export type ConnectionOutcome = {
  fatal: boolean
  authenticated: boolean
  code: string | number
  reason: string
}

export type ConnectionHandle = {
  outcome: Promise<ConnectionOutcome>
  disconnect: () => void
}

function parseServerMessage(raw: RawData): ServerMessage | null {
  let value: unknown

  try {
    value = JSON.parse(raw.toString())
  } catch {
    return null
  }

  if (typeof value !== "object" || value === null) {
    return null
  }

  const message = value as Record<string, unknown>

  if (typeof message.type !== "string") {
    return null
  }

  return message as ServerMessage
}

export function connectDevice(
  config: DriverConfig,
  identity: DeviceIdentity,
): ConnectionHandle {
  const socket = new WebSocket(config.wsUrl, {
    handshakeTimeout: HANDSHAKE_TIMEOUT_MS,
    maxPayload: MAX_PAYLOAD_BYTES,
  })

  const privateKey = createPrivateKey(identity.privateKey)

  let authenticated = false
  let fatal = false
  let fatalCode: string | undefined
  let heartbeatTimer: NodeJS.Timeout | undefined
  let lastAckAt = 0
  let heartbeatIntervalMs = DEFAULT_HEARTBEAT_INTERVAL_MS
  let heartbeatTimeoutMs = DEFAULT_HEARTBEAT_TIMEOUT_MS
  let settled = false
  let defaultFolder: string | null = null

  let resolveOutcome: (outcome: ConnectionOutcome) => void = () => undefined

  const outcome = new Promise<ConnectionOutcome>((resolve) => {
    resolveOutcome = resolve
  })

  function stopHeartbeat() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer)
      heartbeatTimer = undefined
    }
  }

  function send(message: unknown) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message))
    }
  }

  function finish(code: number | string, reason: string) {
    if (settled) {
      return
    }

    settled = true
    stopHeartbeat()
    resolveOutcome({ fatal, authenticated, code, reason })
  }

  function startHeartbeat() {
    stopHeartbeat()
    lastAckAt = Date.now()

    heartbeatTimer = setInterval(() => {
      if (socket.readyState !== WebSocket.OPEN) {
        return
      }

      if (Date.now() - lastAckAt > heartbeatTimeoutMs) {
        console.error("Backend não respondeu ao heartbeat; reconectando.")
        socket.terminate()
        return
      }

      send({ type: "device:heartbeat" })
    }, heartbeatIntervalMs)
  }

  let commandChain: Promise<void> = Promise.resolve()

  function enqueueCommand(message: {
    id?: string
    command?: string
    input?: unknown
  }) {
    if (!message.id || message.id.length > 128) {
      return
    }

    if (typeof message.command !== "string") {
      return
    }

    const id = message.id
    const rawCommand = message.command
    const input = message.input

    console.log(
      `[driver] received device command id=${id} command=${rawCommand} input=${JSON.stringify(input)}`,
    )

    commandChain = commandChain
      .then(async () => {
        let result: DeviceCommandResult

        try {
          const command = parseDeviceCommand(rawCommand, input)
          result = await executeDeviceCommand(command, {
            defaultFolder: defaultFolder ?? undefined,
          })
        } catch (error) {
          result =
            error instanceof DeviceCommandValidationError
              ? {
                  ok: false,
                  code: error.code,
                  error: error.message.slice(0, 900),
                }
              : {
                  ok: false,
                  code: "command_failed",
                  error:
                    error instanceof Error
                      ? error.message.slice(0, 900)
                      : "Falha ao executar o comando.",
                }
        }

        const code = "ok" in result && result.ok === false ? result.code : "-"
        const errorMsg = "ok" in result && result.ok === false ? result.error : "-"
        console.log(
          `[driver] sending device result id=${id} ok=${result.ok} code=${code} error=${errorMsg}`,
        )

        send({ type: "device:command:result", id, result })
      })
      .catch(() => undefined)
  }

  socket.on("open", () => {
    if (!identity.deviceId) {
      fatal = true
      fatalCode = "unknown_device"
      socket.close(4005, "unknown_device")
      return
    }

    send({
      type: "device:authenticate",
      deviceId: identity.deviceId,
      fingerprint: identity.fingerprint,
      defaultFolder: homedir(),
    })
  })

  socket.on("message", (raw) => {
    const message = parseServerMessage(raw)

    if (!message) {
      return
    }

    if (message.type === "device:challenge") {
      const signature = sign(
        null,
        Buffer.from(message.challenge, "base64url"),
        privateKey,
      ).toString("base64url")

      send({ type: "device:authenticate:proof", signature })
      return
    }

    if (message.type === "device:authenticated") {
      authenticated = true
      heartbeatIntervalMs =
        message.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS
      heartbeatTimeoutMs =
        message.heartbeatTimeoutMs ?? DEFAULT_HEARTBEAT_TIMEOUT_MS
      defaultFolder = message.defaultFolder ?? null
      startHeartbeat()
      console.log("Dispositivo autenticado. Presença ativa.")
      return
    }

    if (message.type === "device:heartbeat:ack") {
      lastAckAt = Date.now()
      return
    }

    if (message.type === "device:command") {
      if (authenticated) {
        enqueueCommand(message)
      }
      return
    }

    if (message.type === "device:error") {
      if (FATAL_ERROR_CODES.has(message.code)) {
        fatal = true
        fatalCode = message.code
      }

      const detail = message.message ?? "Erro reportado pelo backend"
      console.error(`[${message.code}] ${detail}`)
    }
  })

  socket.on("error", (error) => {
    if (socket.readyState !== WebSocket.OPEN) {
      console.error(`Falha ao conectar no backend: ${error.message}`)
    }
  })

  socket.on("close", (code, reason) => {
    finish(fatalCode ?? code, reason.toString())
  })

  return {
    outcome,
    disconnect: () => {
      stopHeartbeat()

      if (socket.readyState === WebSocket.OPEN) {
        send({ type: "device:disconnect" })
        socket.close(1000, "driver_shutdown")
        return
      }

      socket.terminate()
    },
  }
}
