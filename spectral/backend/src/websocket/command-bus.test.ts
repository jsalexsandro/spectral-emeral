import { randomUUID } from "node:crypto"
import { existsSync } from "node:fs"
import { resolve } from "node:path"
import { beforeAll, describe, expect, it } from "vitest"
import { WebSocket } from "ws"
import type { DeviceCommandResult } from "../../../shared/device-commands.js"

/**
 * O `command-bus` importa o `config`, que exige `DATABASE_URL`. Carregamos o
 * `.env` antes do import dinâmico para não quebrar a suíte em ambientes sem
 * banco — nesse caso os testes são pulados.
 */
const envPath = resolve(process.cwd(), ".env")

if (!process.env.DATABASE_URL && existsSync(envPath)) {
  try {
    process.loadEnvFile(envPath)
  } catch {
    // Variáveis já definidas no processo continuam válidas.
  }
}

const hasDatabase = Boolean(process.env.DATABASE_URL)

type FakeSocket = WebSocket & {
  sent: string[]
}

function fakeSocket(): FakeSocket {
  const sent: string[] = []

  return {
    sent,
    readyState: WebSocket.OPEN,
    send(payload: string) {
      sent.push(payload)
    },
  } as unknown as FakeSocket
}

type CommandBus = typeof import("./command-bus.js")

function firstSent(socket: FakeSocket): { id: string } {
  const [payload] = socket.sent

  if (!payload) {
    throw new Error("nenhum comando foi enviado ao socket")
  }

  return JSON.parse(payload) as { id: string }
}

describe.skipIf(!hasDatabase)("device command bus", () => {
  let bus: CommandBus

  beforeAll(async () => {
    bus = await import("./command-bus.js")
  })

  it("envia o comando e resolve com o resultado do driver", async () => {
    const deviceId = `device-${randomUUID()}`
    const socket = fakeSocket()
    bus.registerConnection(deviceId, socket)

    const pending = bus.sendDeviceCommand(
      deviceId,
      { command: "get-os", input: {} },
      5_000,
    )

    expect(socket.sent).toHaveLength(1)
    const message = firstSent(socket)

    // O formato exato do resultado não importa para o transporte.
    const result = { ok: true } as DeviceCommandResult

    expect(bus.resolveCommandResult(deviceId, message.id, result)).toBe(true)
    await expect(pending).resolves.toBe(result)
  })

  it("espera a reconexão em vez de falhar com device_offline", async () => {
    const deviceId = `device-${randomUUID()}`
    const socket = fakeSocket()

    const pending = bus.sendDeviceCommand(
      deviceId,
      { command: "get-os", input: {} },
      5_000,
      1_000,
    )

    // O driver volta alguns instantes depois de o comando chegar.
    await new Promise((resolve) => setTimeout(resolve, 20))
    bus.registerConnection(deviceId, socket)

    // A espera resolve no microtask seguinte ao registro.
    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(socket.sent).toHaveLength(1)
    const message = firstSent(socket)
    const result = { ok: true } as DeviceCommandResult

    bus.resolveCommandResult(deviceId, message.id, result)
    await expect(pending).resolves.toBe(result)
  })

  it("declara offline só depois de esgotar a janela de reconexão", async () => {
    const deviceId = `device-${randomUUID()}`

    const began = Date.now()
    const pending = bus.sendDeviceCommand(
      deviceId,
      { command: "get-os", input: {} },
      5_000,
      60,
    )

    await expect(pending).rejects.toMatchObject({
      code: "device_offline",
      status: 409,
    })
    expect(Date.now() - began).toBeGreaterThanOrEqual(50)
  })
})
