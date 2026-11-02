import { generateKeyPairSync } from "node:crypto"
import { describe, expect, it } from "vitest"
import {
  DEVICE_NAME_MAX_LENGTH,
  PAIRING_CODE_ALPHABET,
  PAIRING_CODE_LENGTH,
  generatePairingCode,
  getPublicKeyFingerprint,
  hashPairingCode,
  isValidDevicePublicKey,
  isValidPairingCode,
  normalizePairingCode,
  sanitizeDeviceName,
} from "./protocol"
import { isDeviceOnline } from "./types"

function generateEd25519PublicKey(): string {
  const { publicKey } = generateKeyPairSync("ed25519")
  return publicKey.export({ type: "spki", format: "pem" }).toString()
}

describe("device protocol", () => {
  it("normalizes pairing codes", () => {
    expect(normalizePairingCode(" ab c-2 3 ")).toBe("ABC23")
    expect(normalizePairingCode("abcdef")).toBe("ABCDEF")
  })

  it("generates valid codes without ambiguous characters", () => {
    for (let index = 0; index < 100; index += 1) {
      const code = generatePairingCode()

      expect(code).toHaveLength(PAIRING_CODE_LENGTH)
      expect(isValidPairingCode(code)).toBe(true)

      for (const character of code) {
        expect(PAIRING_CODE_ALPHABET).toContain(character)
      }
    }
  })

  it("rejects codes with ambiguous or invalid characters", () => {
    expect(isValidPairingCode("ABCDE0")).toBe(false)
    expect(isValidPairingCode("ABCDEI")).toBe(false)
    expect(isValidPairingCode("ABC")).toBe(false)
    expect(isValidPairingCode("ABC1234")).toBe(false)
  })

  it("hashes codes deterministically per secret", () => {
    const first = hashPairingCode("ABC123", "secret-a")
    const second = hashPairingCode("abc-123", "secret-a")
    const other = hashPairingCode("ABC123", "secret-b")

    expect(first).toBe(second)
    expect(first).not.toBe(other)
  })

  it("validates Ed25519 public keys and fingerprints", () => {
    const publicKey = generateEd25519PublicKey()
    const fingerprint = getPublicKeyFingerprint(publicKey)

    expect(fingerprint).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(isValidDevicePublicKey(publicKey)).toBe(true)

    const { publicKey: rsaPublicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
    })
    const rsaPem = rsaPublicKey.export({ type: "spki", format: "pem" })

    expect(isValidDevicePublicKey(rsaPem.toString())).toBe(false)
    expect(isValidDevicePublicKey("not-a-key")).toBe(false)
  })

  it("sanitizes device names", () => {
    expect(sanitizeDeviceName(null)).toBe("Novo dispositivo")
    expect(sanitizeDeviceName("   ")).toBe("Novo dispositivo")
    expect(sanitizeDeviceName("  Meu   PC  ")).toBe("Meu PC")

    const longName = "a".repeat(DEVICE_NAME_MAX_LENGTH + 10)
    const result = sanitizeDeviceName(longName)

    expect(result.length).toBeLessThanOrEqual(DEVICE_NAME_MAX_LENGTH + 1)
    expect(result.endsWith("…")).toBe(true)
  })

  it("derives online status from last seen", () => {
    const now = Date.now()

    expect(isDeviceOnline(null, now)).toBe(false)
    expect(isDeviceOnline(new Date(now - 10_000), now)).toBe(true)
    expect(isDeviceOnline(new Date(now - 44_000), now)).toBe(true)
    expect(isDeviceOnline(new Date(now - 46_000), now)).toBe(false)
    expect(isDeviceOnline("invalid", now)).toBe(false)
  })
})
