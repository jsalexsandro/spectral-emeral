import { getPairingStatus, requestPairing, sleep } from "./api.js"
import type { DriverConfig } from "./config.js"
import type { DeviceIdentity } from "./identity.js"

const MIN_POLL_INTERVAL_MS = 1_000

export async function pairDevice(
  config: DriverConfig,
  identity: DeviceIdentity,
): Promise<string> {
  const pairing = await requestPairing(config, identity)

  console.log("")
  console.log("Emparelhamento solicitado.")
  console.log(`Código: ${pairing.code}`)
  console.log(
    "Abra Configurações → Dispositivos no Spectral e informe este código.",
  )
  console.log(
    `O código expira em ${new Date(pairing.expiresAt).toLocaleTimeString()}.`,
  )
  console.log("")

  const interval = Math.max(
    MIN_POLL_INTERVAL_MS,
    pairing.pollIntervalMs,
  )

  for (;;) {
    await sleep(interval)

    const status = await getPairingStatus(config, pairing.sessionId)

    if (status.status === "paired" && status.deviceId) {
      console.log("Dispositivo emparelhado com sucesso.")
      return status.deviceId
    }

    if (status.status === "expired") {
      throw new Error(
        "O código expirou. Execute novamente com --pair para gerar outro.",
      )
    }
  }
}
