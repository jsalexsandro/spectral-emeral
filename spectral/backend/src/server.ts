import { config } from "./config.js"
import { closeDatabase } from "./db/index.js"
import { closeCodes } from "./websocket/messages.js"
import { createSocketServer } from "./websocket/server.js"

const { httpServer, wss } = createSocketServer()

httpServer.listen(config.port, config.host, () => {
  console.log(
    `[spectral-backend] WebSocket e HTTP interno ouvindo em http://${config.host}:${config.port}`,
  )
})

httpServer.on("error", (error) => {
  console.error("[spectral-backend] Erro no servidor", error)
  process.exitCode = 1
})

let shuttingDown = false

async function shutdown(signal: string) {
  if (shuttingDown) {
    return
  }

  shuttingDown = true
  console.log(`[spectral-backend] Encerrando (${signal})`)

  for (const client of wss.clients) {
    client.close(closeCodes.shuttingDown, "server_shutdown")
  }

  wss.close()
  httpServer.close()
  await closeDatabase().catch(() => undefined)
  process.exit(0)
}

process.on("SIGINT", () => {
  void shutdown("SIGINT")
})

process.on("SIGTERM", () => {
  void shutdown("SIGTERM")
})
