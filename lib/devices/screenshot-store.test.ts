import { mkdtemp, readdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  SCREENSHOT_TTL_MS,
  cleanupScreenshots,
  getScreenshot,
  getScreenshotMetadata,
  saveScreenshot,
} from "./screenshot-store"

const geometry = {
  width: 1280,
  height: 720,
  region: { x: 0, y: 0, width: 2560, height: 1440 },
}

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
      ...geometry,
    })

    const stored = await getScreenshot(id)

    expect(id).toBe("shot_123456")
    expect(stored?.deviceId).toBe("device-1")
    expect(stored?.format).toBe("jpeg")
    expect(stored?.width).toBe(1280)
    expect(stored?.height).toBe(720)
    expect(stored?.region).toEqual(geometry.region)
    expect(stored?.bytes.toString()).toBe("conteúdo da captura")
    expect(stored?.expiresAt).toBeGreaterThan(Date.now())
    expect(stored?.expiresAt).toBeLessThanOrEqual(
      Date.now() + SCREENSHOT_TTL_MS + 1_000,
    )
  })

  it("expõe a geometria sem carregar a imagem", async () => {
    await saveScreenshot({
      id: "shot_metadata",
      deviceId: "device-1",
      format: "png",
      base64: Buffer.from("png").toString("base64"),
      width: 640,
      height: 360,
      region: { x: 100, y: 50, width: 1280, height: 720 },
    })

    await expect(getScreenshotMetadata("shot_metadata")).resolves.toEqual({
      deviceId: "device-1",
      format: "png",
      width: 640,
      height: 360,
      region: { x: 100, y: 50, width: 1280, height: 720 },
      expiresAt: expect.any(Number),
    })
  })

  it("não devolve captura expirada e remove os arquivos", async () => {
    await saveScreenshot({
      id: "shot_expired",
      deviceId: "device-1",
      format: "png",
      base64: Buffer.from("png").toString("base64"),
      ...geometry,
      ttlMs: -1_000,
    })

    await expect(getScreenshot("shot_expired")).resolves.toBeNull()
    await expect(getScreenshotMetadata("shot_expired")).resolves.toBeNull()
    await expect(readdir(directory)).resolves.toEqual([])
  })

  it("remove expiradas no cleanup e preserva as válidas", async () => {
    await saveScreenshot({
      id: "shot_expired",
      deviceId: "device-1",
      format: "jpeg",
      base64: Buffer.from("old").toString("base64"),
      ...geometry,
      ttlMs: -1_000,
    })
    await saveScreenshot({
      id: "shot_valid",
      deviceId: "device-1",
      format: "jpeg",
      base64: Buffer.from("new").toString("base64"),
      ...geometry,
    })

    await cleanupScreenshots()

    await expect(getScreenshot("shot_expired")).resolves.toBeNull()
    await expect(getScreenshot("shot_valid")).resolves.not.toBeNull()
  })

  it("rejeita ids fora do padrão e base64 vazio", async () => {
    await expect(getScreenshot("../etc/passwd")).resolves.toBeNull()
    await expect(getScreenshotMetadata("../etc/passwd")).resolves.toBeNull()

    await expect(
      saveScreenshot({
        id: "a/b",
        deviceId: "device-1",
        format: "jpeg",
        base64: "aGVsbG8=",
        ...geometry,
      }),
    ).rejects.toThrow("Identificador de captura inválido.")

    await expect(
      saveScreenshot({
        id: "shot_empty",
        deviceId: "device-1",
        format: "jpeg",
        base64: "",
        ...geometry,
      }),
    ).rejects.toThrow("A captura veio vazia.")
  })

  it("rejeita geometria inválida", async () => {
    await expect(
      saveScreenshot({
        id: "shot_bad_geometry",
        deviceId: "device-1",
        format: "jpeg",
        base64: "aGVsbG8=",
        width: 0,
        height: 720,
        region: geometry.region,
      }),
    ).rejects.toThrow("Geometria da captura inválida.")
  })

  it("ignora metadados antigos sem geometria", async () => {
    const { writeFile } = await import("node:fs/promises")

    await writeFile(
      join(directory, "shot_legacy.json"),
      JSON.stringify({
        deviceId: "device-1",
        format: "jpeg",
        expiresAt: Date.now() + 60_000,
      }),
      "utf8",
    )

    await expect(getScreenshotMetadata("shot_legacy")).resolves.toBeNull()
    await expect(getScreenshot("shot_legacy")).resolves.toBeNull()
  })
})
