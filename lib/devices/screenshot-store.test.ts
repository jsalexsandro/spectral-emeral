import { mkdtemp, readdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  SCREENSHOT_TTL_MS,
  cleanupScreenshots,
  getScreenshot,
  saveScreenshot,
} from "./screenshot-store"

let directory: string

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "spectral-screenshot-test-"))
  vi.stubEnv("SPECTRAL_SCREENSHOT_DIR", directory)
})

afterEach(async () => {
  vi.unstubAllEnvs()
  await rm(directory, { recursive: true, force: true })
})

describe("screenshot store", () => {
  it("salva e lê a captura com metadados", async () => {
    const base64 = Buffer.from("conteúdo da captura").toString("base64")

    const id = await saveScreenshot({
      id: "shot_123456",
      deviceId: "device-1",
      format: "jpeg",
      base64,
    })

    const stored = await getScreenshot(id)

    expect(id).toBe("shot_123456")
    expect(stored?.deviceId).toBe("device-1")
    expect(stored?.format).toBe("jpeg")
    expect(stored?.bytes.toString()).toBe("conteúdo da captura")
    expect(stored?.expiresAt).toBeGreaterThan(Date.now())
    expect(stored?.expiresAt).toBeLessThanOrEqual(
      Date.now() + SCREENSHOT_TTL_MS + 1_000,
    )
  })

  it("não devolve captura expirada e remove os arquivos", async () => {
    await saveScreenshot({
      id: "shot_expired",
      deviceId: "device-1",
      format: "png",
      base64: Buffer.from("png").toString("base64"),
      ttlMs: -1_000,
    })

    await expect(getScreenshot("shot_expired")).resolves.toBeNull()
    await expect(readdir(directory)).resolves.toEqual([])
  })

  it("remove expiradas no cleanup e preserva as válidas", async () => {
    await saveScreenshot({
      id: "shot_expired",
      deviceId: "device-1",
      format: "jpeg",
      base64: Buffer.from("old").toString("base64"),
      ttlMs: -1_000,
    })
    await saveScreenshot({
      id: "shot_valid",
      deviceId: "device-1",
      format: "jpeg",
      base64: Buffer.from("new").toString("base64"),
    })

    await cleanupScreenshots()

    await expect(getScreenshot("shot_expired")).resolves.toBeNull()
    await expect(getScreenshot("shot_valid")).resolves.not.toBeNull()
  })

  it("rejeita ids fora do padrão e base64 vazio", async () => {
    await expect(getScreenshot("../etc/passwd")).resolves.toBeNull()

    await expect(
      saveScreenshot({
        id: "a/b",
        deviceId: "device-1",
        format: "jpeg",
        base64: "aGVsbG8=",
      }),
    ).rejects.toThrow("Identificador de captura inválido.")

    await expect(
      saveScreenshot({
        id: "shot_empty",
        deviceId: "device-1",
        format: "jpeg",
        base64: "",
      }),
    ).rejects.toThrow("A captura veio vazia.")
  })
})
