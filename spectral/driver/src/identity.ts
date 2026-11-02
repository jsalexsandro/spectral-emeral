import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
} from "node:crypto"
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs"
import { join } from "node:path"

const IDENTITY_FILENAME = "identity.json"

export type DeviceIdentity = {
  version: 1
  deviceId?: string
  publicKey: string
  privateKey: string
  fingerprint: string
  createdAt: string
}

function getIdentityPath(driverHome: string): string {
  return join(driverHome, IDENTITY_FILENAME)
}

export function getPublicKeyFingerprint(publicKey: string): string {
  const key = createPublicKey(publicKey)

  if (key.asymmetricKeyType !== "ed25519") {
    throw new Error("Chave pública inválida: esperado Ed25519")
  }

  const der = key.export({ type: "spki", format: "der" })

  return createHash("sha256").update(der).digest("base64url")
}

function writeIdentity(path: string, identity: DeviceIdentity) {
  writeFileSync(path, `${JSON.stringify(identity, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  })

  try {
    chmodSync(path, 0o600)
  } catch {
    // No Windows as permissões POSIX são emuladas de forma limitada.
  }
}

function createIdentity(driverHome: string): DeviceIdentity {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519")

  const publicKeyPem = publicKey
    .export({ type: "spki", format: "pem" })
    .toString()
  const privateKeyPem = privateKey
    .export({ type: "pkcs8", format: "pem" })
    .toString()

  const identity: DeviceIdentity = {
    version: 1,
    publicKey: publicKeyPem,
    privateKey: privateKeyPem,
    fingerprint: getPublicKeyFingerprint(publicKeyPem),
    createdAt: new Date().toISOString(),
  }

  writeIdentity(getIdentityPath(driverHome), identity)

  return identity
}

export function loadOrCreateIdentity(driverHome: string): {
  identity: DeviceIdentity
  created: boolean
} {
  mkdirSync(driverHome, { recursive: true, mode: 0o700 })

  const path = getIdentityPath(driverHome)

  if (!existsSync(path)) {
    return { identity: createIdentity(driverHome), created: true }
  }

  const raw = readFileSync(path, "utf8")
  const parsed = JSON.parse(raw) as Partial<DeviceIdentity>

  if (
    parsed.version !== 1 ||
    typeof parsed.publicKey !== "string" ||
    typeof parsed.privateKey !== "string"
  ) {
    throw new Error(
      `Identidade inválida em ${path}. Remova o arquivo e emparelhe novamente.`,
    )
  }

  createPrivateKey(parsed.privateKey)
  createPublicKey(parsed.publicKey)

  const fingerprint = getPublicKeyFingerprint(parsed.publicKey)

  return {
    identity: {
      version: 1,
      deviceId: parsed.deviceId,
      publicKey: parsed.publicKey,
      privateKey: parsed.privateKey,
      fingerprint,
      createdAt: parsed.createdAt ?? new Date().toISOString(),
    },
    created: false,
  }
}

export function saveDeviceId(
  driverHome: string,
  identity: DeviceIdentity,
  deviceId: string,
): DeviceIdentity {
  const updated: DeviceIdentity = { ...identity, deviceId }
  writeIdentity(getIdentityPath(driverHome), updated)
  return updated
}
