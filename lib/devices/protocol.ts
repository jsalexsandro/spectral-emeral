import {
  createHash,
  createHmac,
  createPublicKey,
  randomInt,
} from "node:crypto"
import {
  DEVICE_NAME_MAX_LENGTH,
  PAIRING_CODE_ALPHABET,
  PAIRING_CODE_LENGTH,
  PAIRING_CODE_PATTERN,
} from "./constants"

export * from "./constants"

export function normalizePairingCode(value: string): string {
  return value.trim().toUpperCase().replace(/[\s-]/g, "")
}

export function isValidPairingCode(value: string): boolean {
  return PAIRING_CODE_PATTERN.test(value)
}

export function generatePairingCode(): string {
  let code = ""

  for (let index = 0; index < PAIRING_CODE_LENGTH; index += 1) {
    code += PAIRING_CODE_ALPHABET[randomInt(0, PAIRING_CODE_ALPHABET.length)]
  }

  return code
}

export function getPairingSecret(): string {
  const secret =
    process.env.DEVICE_PAIRING_SECRET ?? process.env.AUTH_SECRET

  if (!secret) {
    throw new Error(
      "DEVICE_PAIRING_SECRET (ou AUTH_SECRET) não definida",
    )
  }

  return secret
}

export function hashPairingCode(
  code: string,
  secret: string = getPairingSecret(),
): string {
  return createHmac("sha256", secret)
    .update(normalizePairingCode(code))
    .digest("base64url")
}

export function getPublicKeyFingerprint(publicKey: string): string {
  const key = createPublicKey(publicKey)

  if (key.asymmetricKeyType !== "ed25519") {
    throw new Error("Chave pública inválida: esperado Ed25519")
  }

  const der = key.export({ type: "spki", format: "der" })

  return createHash("sha256").update(der).digest("base64url")
}

export function isValidDevicePublicKey(publicKey: string): boolean {
  try {
    getPublicKeyFingerprint(publicKey)
    return true
  } catch {
    return false
  }
}

export function sanitizeDeviceName(value: string | null | undefined): string {
  const normalized = value?.replace(/\s+/g, " ").trim()

  if (!normalized) {
    return "Novo dispositivo"
  }

  if (normalized.length <= DEVICE_NAME_MAX_LENGTH) {
    return normalized
  }

  return `${normalized.slice(0, DEVICE_NAME_MAX_LENGTH).trimEnd()}…`
}
