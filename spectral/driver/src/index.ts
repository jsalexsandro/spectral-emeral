import { sleep } from "./api.js"
import { loadConfig } from "./config.js"
import {
  loadOrCreateIdentity,
  saveDeviceId,
  type DeviceIdentity,
} from "./identity.js"
import { pairDevice } from "./pairing.js"
import { connectDevice, type ConnectionHandle } from "./socket.js"

const MIN_BACKOFF_MS = 1_000
const MAX_BACKOFF_MS = 30_000

function printHelp() {
  console.log("Uso: npm start [--pair]")
  console.log("")
  console.log("  --pair    Solicita um novo código de emparelhamento")
  console.log("  --help    Mostra esta ajuda")
}

function jitteredDelay(backoffMs: number): number {
  const factor = 0.8 + Math.random() * 0.4
  return Math.round(backoffMs * factor)
}

async function main() {
  const args = new Set(process.argv.slice(2))

  if (args.has("--help") || args.has("-h")) {
    printHelp()
    return
  }

  const forcePair = args.has("--pair")
  const config = loadConfig()
  const { identity, created } = loadOrCreateIdentity(config.driverHome)

  if (created) {
    console.log(`Identidade criada em ${config.driverHome}.`)
  }

  let currentIdentity: DeviceIdentity = identity

  if (forcePair || !currentIdentity.deviceId) {
    const deviceId = await pairDevice(config, currentIdentity)
    currentIdentity = saveDeviceId(
      config.driverHome,
      currentIdentity,
      deviceId,
    )
  } else {
    console.log(`Usando identidade existente (${config.driverHome}).`)
  }

  let stopping = false
  let activeConnection: ConnectionHandle | undefined

  process.once("SIGINT", () => {
    stopping = true
    console.log("Encerrando driver...")
    activeConnection?.disconnect()

    setTimeout(() => process.exit(0), 1_000).unref()
  })

  let backoff = MIN_BACKOFF_MS

  while (!stopping) {
    console.log(`Conectando em ${config.wsUrl}...`)
    const connection = connectDevice(config, currentIdentity)
    activeConnection = connection

    const outcome = await connection.outcome
    activeConnection = undefined

    if (stopping) {
      return
    }

    if (outcome.fatal) {
      if (outcome.code === "revoked_device") {
        console.error(
          "Este dispositivo foi revogado. Execute com --pair para emparelhar novamente.",
        )
      } else if (outcome.code === "unknown_device") {
        console.error(
          "O backend não reconhece este dispositivo. Execute com --pair para emparelhar novamente.",
        )
      } else if (outcome.code === "replaced") {
        console.error(
          "Outra conexão autenticou este dispositivo. Encerrando esta instância.",
        )
      } else {
        console.error("Falha de autenticação. Encerrando driver.")
      }

      process.exitCode = 1
      return
    }

    if (outcome.authenticated) {
      backoff = MIN_BACKOFF_MS
    }

    const delay = jitteredDelay(backoff)
    console.log(
      `Conexão encerrada (${outcome.code}). Reconectando em ${(
        delay / 1_000
      ).toFixed(1)}s.`,
    )

    await sleep(delay)
    backoff = Math.min(backoff * 2, MAX_BACKOFF_MS)
  }
}

main().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : "Erro inesperado no driver."

  console.error(message)
  process.exitCode = 1
})
