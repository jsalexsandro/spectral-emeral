import type { WebSocket } from "ws"

export type ConnectionWaiter = (socket: WebSocket) => void

/**
 * Fila de espera por uma reconexão de dispositivo. Depois de uma queda o
 * driver volta em poucos segundos; sem essa janela um comando disparado no
 * meio do reconnect falhava com `device_offline` mesmo com a máquina ligada.
 */
export class ConnectionWaiters {
  private readonly waiters = new Map<string, Set<ConnectionWaiter>>()

  wait(deviceId: string, timeoutMs: number): Promise<WebSocket | null> {
    return new Promise((resolve) => {
      const waiters =
        this.waiters.get(deviceId) ?? new Set<ConnectionWaiter>()
      let timer: NodeJS.Timeout

      const waiter: ConnectionWaiter = (socket) => {
        clearTimeout(timer)
        resolve(socket)
      }

      timer = setTimeout(() => {
        waiters.delete(waiter)

        if (waiters.size === 0) {
          this.waiters.delete(deviceId)
        }

        resolve(null)
      }, timeoutMs)

      waiters.add(waiter)
      this.waiters.set(deviceId, waiters)
    })
  }

  notify(deviceId: string, socket: WebSocket): void {
    const waiters = this.waiters.get(deviceId)

    if (!waiters) {
      return
    }

    this.waiters.delete(deviceId)

    for (const waiter of waiters) {
      waiter(socket)
    }
  }
}
