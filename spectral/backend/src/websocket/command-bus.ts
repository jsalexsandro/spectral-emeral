import { randomUUID } from "node:crypto"
import { WebSocket } from "ws"
import type {
  DeviceCommand,
  DeviceCommandResult,
} from "../../../shared/device-commands.js"
import { config } from "../config.js"
import type { ServerMessage } from "./messages.js"

const MIN_TIMEOUT_MS = 1_000
const MAX_TIMEOUT_MS = 60_000

type PendingCommand = {
  deviceId: string
  resolve: (result: DeviceCommandResult) => void
  reject: (error: DeviceCommandError) => void
  timer: NodeJS.Timeout
}

export class DeviceCommandError extends Error {
  readonly code: string
  readonly status: number

  constructor(code: string, message: string, status = 400) {
    super(message)
    this.name = "DeviceCommandError"
    this.code = code
    this.status = status
  }
}

const connections = new Map<string, WebSocket>()
const pendingCommands = new Map<string, PendingCommand>()
const inFlightByDevice = new Map<string, string>()

function clampTimeout(timeoutMs: number | undefined): number {
  const value = timeoutMs ?? config.commandTimeoutMs

  if (!Number.isFinite(value)) {
    return config.commandTimeoutMs
  }

  return Math.min(MAX_TIMEOUT_MS, Math.max(MIN_TIMEOUT_MS, Math.trunc(value)))
}

function removePending(id: string, entry: PendingCommand) {
  clearTimeout(entry.timer)
  pendingCommands.delete(id)

  if (inFlightByDevice.get(entry.deviceId) === id) {
    inFlightByDevice.delete(entry.deviceId)
  }
}

function failDevice(deviceId: string, code: string, message: string) {
  for (const [id, entry] of pendingCommands) {
    if (entry.deviceId !== deviceId) {
      continue
    }

    removePending(id, entry)
    entry.reject(new DeviceCommandError(code, message, 409))
  }
}

export function registerConnection(deviceId: string, socket: WebSocket) {
  const existing = connections.get(deviceId)

  if (existing && existing !== socket) {
    failDevice(
      deviceId,
      "device_replaced",
      "Uma nova conexão assumiu este dispositivo.",
    )
  }

  connections.set(deviceId, socket)
}

export function unregisterConnection(deviceId: string, socket: WebSocket) {
  if (connections.get(deviceId) !== socket) {
    return
  }

  connections.delete(deviceId)
  failDevice(
    deviceId,
    "device_disconnected",
    "O dispositivo desconectou antes de concluir o comando.",
  )
}

export function resolveCommandResult(
  deviceId: string,
  id: string,
  result: DeviceCommandResult,
): boolean {
  const entry = pendingCommands.get(id)

  if (!entry || entry.deviceId !== deviceId) {
    return false
  }

  removePending(id, entry)
  entry.resolve(result)
  return true
}

export function sendDeviceCommand(
  deviceId: string,
  command: DeviceCommand,
  timeoutMs?: number,
): Promise<DeviceCommandResult> {
  const socket = connections.get(deviceId)

  if (!socket || socket.readyState !== WebSocket.OPEN) {
    return Promise.reject(
      new DeviceCommandError(
        "device_offline",
        "O dispositivo não está online.",
        409,
      ),
    )
  }

  if (inFlightByDevice.has(deviceId)) {
    return Promise.reject(
      new DeviceCommandError(
        "device_busy",
        "O dispositivo ainda está executando outro comando.",
        409,
      ),
    )
  }

  const id = randomUUID()
  const timeout = clampTimeout(timeoutMs)

  return new Promise<DeviceCommandResult>((resolve, reject) => {
    const timer = setTimeout(() => {
      const entry = pendingCommands.get(id)

      if (!entry) {
        return
      }

      removePending(id, entry)
      entry.reject(
        new DeviceCommandError(
          "command_timeout",
          "O dispositivo não respondeu dentro do prazo.",
          504,
        ),
      )
    }, timeout)

    pendingCommands.set(id, { deviceId, resolve, reject, timer })
    inFlightByDevice.set(deviceId, id)

    const message: ServerMessage = {
      type: "device:command",
      id,
      command: command.command,
      input: command.input,
    }

    try {
      socket.send(JSON.stringify(message))
    } catch {
      const entry = pendingCommands.get(id)

      if (entry) {
        removePending(id, entry)
        entry.reject(
          new DeviceCommandError(
            "send_failed",
            "Não foi possível enviar o comando ao dispositivo.",
            502,
          ),
        )
      }
    }
  })
}
