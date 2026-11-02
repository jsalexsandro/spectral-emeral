import { createPublicKey, randomBytes, verify } from "node:crypto"
import type { IncomingMessage } from "node:http"
import { WebSocket, WebSocketServer, type RawData } from "ws"
import { config } from "../config.js"
import { findDeviceById, touchDevice } from "../devices/repository.js"
import {
  clientMessageSchema,
  closeCodes,
  type ServerMessage,
} from "./messages.js"
import { consume } from "./rate-limit.js"

type ConnectionState = {
  authenticated: boolean
  deviceId?: string
  pendingDeviceId?: string
  challenge?: string
  challengeExpiresAt?: number
  authTimer: NodeJS.Timeout
  heartbeatTimer?: NodeJS.Timeout
}

const activeConnections = new Map<string, WebSocket>()

function send(ws: WebSocket, payload: ServerMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload))
  }
}

function reject(
  ws: WebSocket,
  code: string,
  closeCode: number,
  message = "Não foi possível validar o dispositivo",
) {
  send(ws, { type: "device:error", code, message })
  ws.close(closeCode, code.slice(0, 120))
}

function getClientIp(request: IncomingMessage): string {
  const forwarded = request.headers["x-forwarded-for"]
  const header = Array.isArray(forwarded) ? forwarded[0] : forwarded

  if (header) {
    const [first] = header.split(",")
    const value = first?.trim()

    if (value) {
      return value
    }
  }

  return request.socket.remoteAddress ?? "unknown"
}

function verifyProof(
  publicKey: string,
  challenge: string,
  signature: string,
): boolean {
  try {
    const key = createPublicKey(publicKey)

    if (key.asymmetricKeyType !== "ed25519") {
      return false
    }

    return verify(
      null,
      Buffer.from(challenge, "base64url"),
      key,
      Buffer.from(signature, "base64url"),
    )
  } catch {
    return false
  }
}

function clearHeartbeat(state: ConnectionState) {
  if (state.heartbeatTimer) {
    clearTimeout(state.heartbeatTimer)
    state.heartbeatTimer = undefined
  }
}

function cleanupSocket(ws: WebSocket, state: ConnectionState | undefined) {
  if (!state) {
    return
  }

  clearTimeout(state.authTimer)
  clearHeartbeat(state)

  if (state.deviceId && activeConnections.get(state.deviceId) === ws) {
    activeConnections.delete(state.deviceId)
  }
}

function startHeartbeatTimeout(ws: WebSocket, state: ConnectionState) {
  clearHeartbeat(state)

  state.heartbeatTimer = setTimeout(() => {
    if (!state.authenticated) {
      return
    }

    reject(
      ws,
      "heartbeat_timeout",
      closeCodes.heartbeatTimeout,
      "Heartbeat não recebido dentro do prazo",
    )
  }, config.heartbeatTimeoutMs)
}

async function handleAuthenticate(
  ws: WebSocket,
  state: ConnectionState,
  message: { deviceId: string; fingerprint: string },
  ip: string,
) {
  if (!consume(`auth:${ip}`, 20, 60_000)) {
    reject(ws, "rate_limited", closeCodes.rateLimited)
    return
  }

  const device = await findDeviceById(message.deviceId)

  if (!device) {
    reject(ws, "unknown_device", closeCodes.unknownDevice)
    return
  }

  if (device.revokedAt) {
    reject(ws, "revoked_device", closeCodes.revokedDevice)
    return
  }

  if (device.fingerprint !== message.fingerprint) {
    reject(ws, "auth_failed", closeCodes.authFailed)
    return
  }

  const challenge = randomBytes(32).toString("base64url")
  const expiresAt = Date.now() + config.challengeTtlMs

  state.challenge = challenge
  state.challengeExpiresAt = expiresAt

  send(ws, {
    type: "device:challenge",
    challenge,
    expiresAt: new Date(expiresAt).toISOString(),
  })
}

async function handleProof(
  ws: WebSocket,
  state: ConnectionState,
  signature: string,
) {
  if (!state.challenge || !state.challengeExpiresAt) {
    reject(ws, "challenge_required", closeCodes.authFailed)
    return
  }

  if (state.challengeExpiresAt <= Date.now()) {
    state.challenge = undefined
    state.challengeExpiresAt = undefined
    reject(ws, "challenge_expired", closeCodes.authFailed)
    return
  }

  const device = await findDeviceById(state.pendingDeviceId ?? "")

  if (!device) {
    reject(ws, "unknown_device", closeCodes.unknownDevice)
    return
  }

  if (device.revokedAt) {
    reject(ws, "revoked_device", closeCodes.revokedDevice)
    return
  }

  if (!verifyProof(device.publicKey, state.challenge, signature)) {
    reject(ws, "auth_failed", closeCodes.authFailed)
    return
  }

  state.authenticated = true
  state.challenge = undefined
  state.challengeExpiresAt = undefined
  clearTimeout(state.authTimer)

  const existing = activeConnections.get(device.id)

  if (existing && existing !== ws) {
    send(existing, {
      type: "device:error",
      code: "replaced",
      message: "Uma nova conexão autenticou este dispositivo",
    })
    existing.close(closeCodes.replaced, "replaced")
    activeConnections.delete(device.id)
  }

  const seen = await touchDevice(device.id)

  if (!seen) {
    reject(ws, "revoked_device", closeCodes.revokedDevice)
    return
  }

  state.deviceId = device.id
  activeConnections.set(device.id, ws)

  send(ws, {
    type: "device:authenticated",
    deviceId: device.id,
    serverTime: new Date().toISOString(),
    heartbeatIntervalMs: config.heartbeatIntervalMs,
    heartbeatTimeoutMs: config.heartbeatTimeoutMs,
  })

  startHeartbeatTimeout(ws, state)
}

async function handleHeartbeat(ws: WebSocket, state: ConnectionState) {
  if (!state.deviceId) {
    reject(ws, "not_authenticated", closeCodes.authFailed)
    return
  }

  const seen = await touchDevice(state.deviceId)

  if (!seen) {
    reject(ws, "revoked_device", closeCodes.revokedDevice)
    return
  }

  startHeartbeatTimeout(ws, state)
  send(ws, {
    type: "device:heartbeat:ack",
    serverTime: new Date().toISOString(),
  })
}

async function handleMessage(
  ws: WebSocket,
  state: ConnectionState,
  raw: RawData,
  ip: string,
) {
  let payload: unknown

  try {
    payload = JSON.parse(raw.toString())
  } catch {
    reject(ws, "invalid_message", closeCodes.invalidMessage)
    return
  }

  const parsed = clientMessageSchema.safeParse(payload)

  if (!parsed.success) {
    reject(ws, "invalid_message", closeCodes.invalidMessage)
    return
  }

  const message = parsed.data

  if (!state.authenticated) {
    if (message.type === "device:authenticate") {
      state.pendingDeviceId = message.deviceId
      await handleAuthenticate(ws, state, message, ip)
      return
    }

    if (message.type === "device:authenticate:proof") {
      await handleProof(ws, state, message.signature)
      return
    }

    reject(ws, "not_authenticated", closeCodes.authFailed)
    return
  }

  if (message.type === "device:heartbeat") {
    await handleHeartbeat(ws, state)
    return
  }

  if (message.type === "device:disconnect") {
    cleanupSocket(ws, state)
    ws.close(1000, "disconnect")
    return
  }

  reject(ws, "invalid_message", closeCodes.invalidMessage)
}

function handleConnection(ws: WebSocket, request: IncomingMessage) {
  const ip = getClientIp(request)

  if (!consume(`connect:${ip}`, 30, 60_000)) {
    reject(ws, "rate_limited", closeCodes.rateLimited)
    return
  }

  const state: ConnectionState = {
    authenticated: false,
    authTimer: setTimeout(() => {
      if (!state.authenticated) {
        reject(ws, "auth_timeout", closeCodes.authTimeout)
      }
    }, config.authTimeoutMs),
  }

  ws.on("message", (raw) => {
    void handleMessage(ws, state, raw, ip).catch(() => {
      reject(ws, "internal_error", closeCodes.internalError)
    })
  })

  ws.on("close", () => {
    cleanupSocket(ws, state)
  })

  ws.on("error", () => {
    cleanupSocket(ws, state)
  })
}

export function createSocketServer(): WebSocketServer {
  const wss = new WebSocketServer({
    host: config.host,
    port: config.port,
    maxPayload: config.maxPayloadBytes,
  })

  wss.on("connection", handleConnection)

  return wss
}
