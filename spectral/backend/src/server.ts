import { config } from "./config.js"
import { closeDatabase } from "./db/index.js"
import { closeCodes } from "./websocket/messages.js"
import { createSocketServer } from "./websocket/server.js"

const server = createSocketServer()

server.on("listening", () => {
  console.log(
    `[spectral-backend] WebSocket ouvindo em ws://${config.host}:${config.port}`,
  )
})

server.on("error", (error) => {
  console.error("[spectral-backend] Erro no servidor WebSocket", error)
  process.exitCode = 1
})

let shuttingDown = false

async function shutdown(signal: string) {
  if (shuttingDown) {
    return
  }

  shuttingDown = true
  console.log(`[spectral-backend] Encerrando (${signal})`)

  for (const client of server.clients) {
    client.close(closeCodes.shuttingDown, "server_shutdown")
  }

  server.close()
  await closeDatabase().catch(() => undefined)
  process.exit(0)
}

process.on("SIGINT", () => {
  void shutdown("SIGINT")
})

process.on("SIGTERM", () => {
  void shutdown("SIGTERM")
})
