import { timingSafeEqual } from "node:crypto"
import type { IncomingMessage, ServerResponse } from "node:http"
import { z } from "zod"
import {
  DeviceCommandValidationError,
  parseDeviceCommand,
} from "../../../shared/device-commands.js"
import { config } from "../config.js"
import { findDeviceById } from "../devices/repository.js"
import {
  DeviceCommandError,
  sendDeviceCommand,
} from "../websocket/command-bus.js"

const MAX_BODY_BYTES = 32 * 1024
const COMMAND_PATH = /^\/internal\/devices\/([^/]+)\/commands$/

const commandRequestSchema = z.object({
  userId: z.string().min(1).max(128),
  command: z.string().min(1).max(64),
  input: z.unknown(),
  timeoutMs: z.number().int().min(1_000).max(60_000).optional(),
})

class HttpError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = "HttpError"
    this.status = status
    this.code = code
  }
}

function sendJson(response: ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body)

  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
  })
  response.end(payload)
}

function isAuthorized(request: IncomingMessage): boolean {
  const expected = config.internalSecret

  if (!expected) {
    return false
  }

  const header = request.headers["x-internal-secret"]
  const provided = Array.isArray(header) ? header[0] : header

  if (!provided) {
    return false
  }

  const providedBuffer = Buffer.from(provided)
  const expectedBuffer = Buffer.from(expected)

  if (providedBuffer.length !== expectedBuffer.length) {
    return false
  }

  return timingSafeEqual(providedBuffer, expectedBuffer)
}

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0

    request.on("data", (chunk: Buffer) => {
      size += chunk.length

      if (size > MAX_BODY_BYTES) {
        reject(
          new HttpError(
            413,
            "payload_too_large",
            "O corpo da requisição excede o limite.",
          ),
        )
        request.destroy()
        return
      }

      chunks.push(chunk)
    })

    request.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"))
    })

    request.on("error", (error) => {
      reject(error)
    })
  })
}

async function handleCommand(
  request: IncomingMessage,
  response: ServerResponse,
  rawDeviceId: string,
) {
  const deviceId = decodeURIComponent(rawDeviceId)
  const raw = await readBody(request)

  let payload: unknown

  try {
    payload = JSON.parse(raw)
  } catch {
    throw new HttpError(400, "invalid_json", "JSON inválido.")
  }

  const parsed = commandRequestSchema.safeParse(payload)

  if (!parsed.success) {
    throw new HttpError(400, "invalid_request", "Requisição inválida.")
  }

  const body = parsed.data
  const device = await findDeviceById(deviceId)

  if (!device || device.revokedAt || device.userId !== body.userId) {
    throw new HttpError(
      404,
      "device_not_found",
      "Dispositivo não encontrado.",
    )
  }

  const command = parseDeviceCommand(body.command, body.input)
  const result = await sendDeviceCommand(deviceId, command, body.timeoutMs)

  sendJson(response, 200, { ok: true, result })
}

export async function handleInternalRequest(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const path = (request.url ?? "").split("?")[0] ?? ""
  const match = COMMAND_PATH.exec(path)

  if (!match) {
    sendJson(response, 404, { ok: false, code: "not_found" })
    return
  }

  if (request.method !== "POST") {
    response.setHeader("allow", "POST")
    sendJson(response, 405, { ok: false, code: "method_not_allowed" })
    return
  }

  if (!isAuthorized(request)) {
    sendJson(response, 401, { ok: false, code: "unauthorized" })
    return
  }

  try {
    await handleCommand(request, response, match[1] ?? "")
  } catch (error) {
    if (response.headersSent) {
      response.destroy()
      return
    }

    if (error instanceof HttpError) {
      sendJson(response, error.status, {
        ok: false,
        code: error.code,
        error: error.message,
      })
      return
    }

    if (error instanceof DeviceCommandValidationError) {
      sendJson(response, 400, {
        ok: false,
        code: error.code,
        error: error.message,
      })
      return
    }

    if (error instanceof DeviceCommandError) {
      sendJson(response, error.status, {
        ok: false,
        code: error.code,
        error: error.message,
      })
      return
    }

    console.error("[spectral-backend] Falha ao processar comando", error)
    sendJson(response, 500, {
      ok: false,
      code: "internal_error",
      error: "Falha interna ao processar o comando.",
    })
  }
}
