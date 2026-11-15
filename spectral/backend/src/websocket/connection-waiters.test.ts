import { describe, expect, it } from "vitest"
import type { WebSocket } from "ws"
import { ConnectionWaiters } from "./connection-waiters.js"

function fakeSocket(): WebSocket {
  return { readyState: 1 } as unknown as WebSocket
}

describe("connection waiters", () => {
  it("entrega o socket de uma reconexão que chega dentro da janela", async () => {
    const waiters = new ConnectionWaiters()
    const socket = fakeSocket()

    const pending = waiters.wait("device-1", 1_000)

    // A reconexão chega depois que o comando já está esperando.
    setTimeout(() => waiters.notify("device-1", socket), 10)

    await expect(pending).resolves.toBe(socket)
  })

  it("devolve null quando a janela expira sem reconexão", async () => {
    const waiters = new ConnectionWaiters()

    const began = Date.now()
    await expect(waiters.wait("device-1", 40)).resolves.toBeNull()
    expect(Date.now() - began).toBeGreaterThanOrEqual(30)
  })

  it("não mistura esperas de dispositivos diferentes", async () => {
    const waiters = new ConnectionWaiters()
    const socket = fakeSocket()
    const other = fakeSocket()
    const first = waiters.wait("device-1", 1_000)
    const second = waiters.wait("device-2", 1_000)

    waiters.notify("device-2", other)
    waiters.notify("device-1", socket)

    await expect(first).resolves.toBe(socket)
    await expect(second).resolves.toBe(other)
  })

  it("avisa todos os comandos que aguardam o mesmo dispositivo", async () => {
    const waiters = new ConnectionWaiters()
    const socket = fakeSocket()
    const first = waiters.wait("device-1", 1_000)
    const second = waiters.wait("device-1", 1_000)

    waiters.notify("device-1", socket)

    await expect(first).resolves.toBe(socket)
    await expect(second).resolves.toBe(socket)
  })

  it("ignora notificações de dispositivos sem espera", () => {
    const waiters = new ConnectionWaiters()

    expect(() => waiters.notify("device-1", fakeSocket())).not.toThrow()
  })
})
