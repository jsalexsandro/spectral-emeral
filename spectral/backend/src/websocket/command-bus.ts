import { randomUUID } from "node:crypto"
import { WebSocket } from "ws"
import type {
  DeviceCommand,
  DeviceCommandResult,
} from "../../../shared/device-commands.js"
import { config } from "../config.js"
import { commandTransportTimeoutMs } from "./command-timeout.js"
import { ConnectionWaiters } from "./connection-waiters.js"
import type { ServerMessage } from "./messages.js"

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

/**
 * Quanto o backend espera por uma reconexão antes de declarar o dispositivo
 * offline. O driver reconecta em poucos segundos depois de uma queda; sem essa
 * janela, um comando disparado durante o reconnect falhava com `device_offline`
 * mesmo com a máquina ligada e saudável.
 */
export const RECONNECT_GRACE_MS = 4_000

const connections = new Map<string, WebSocket>()
const pendingCommands = new Map<string, PendingCommand>()
const inFlightByDevice = new Map<string, string>()
const connectionWaiters = new ConnectionWaiters()

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
  connectionWaiters.notify(deviceId, socket)
}

function openSocket(deviceId: string): WebSocket | null {
  const socket = connections.get(deviceId)

  return socket && socket.readyState === WebSocket.OPEN ? socket : null
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
  const isFailure = "ok" in result && result.ok === false
  console.log(
    `[backend] received device result id=${id} deviceId=${deviceId} ok=${result.ok} code=${isFailure ? result.code : "-"} error=${isFailure ? result.error : "-"}`,
  )
  entry.resolve(result)
  return true
}

export async function sendDeviceCommand(
  deviceId: string,
  command: DeviceCommand,
  timeoutMs?: number,
  reconnectGraceMs = RECONNECT_GRACE_MS,
): Promise<DeviceCommandResult> {
  let socket = openSocket(deviceId)

  if (!socket && reconnectGraceMs > 0) {
    const began = Date.now()
    socket = await connectionWaiters.wait(deviceId, reconnectGraceMs)
    const waitedMs = Date.now() - began

    if (socket) {
      // Revalida contra o mapa: a conexão entregue pode ter sido substituída
      // ou fechada entre a notificação e este ponto.
      socket = openSocket(deviceId)
    }

    console.log(
      socket
        ? `[backend] dispositivo reconectou durante a espera deviceId=${deviceId} waitedMs=${waitedMs}`
        : `[backend] dispositivo nao reconectou deviceId=${deviceId} waitedMs=${waitedMs}`,
    )
  }

  if (!socket) {
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
  const timeout = commandTransportTimeoutMs(
    timeoutMs,
    config.commandTimeoutMs,
  )

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

    console.log(
      `[backend] sending device command id=${id} deviceId=${deviceId} command=${command.command} input=${JSON.stringify(command.input)}`,
    )

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
