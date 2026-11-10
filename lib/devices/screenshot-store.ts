import { createId } from "@paralleldrive/cuid2"
import {
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type {
  DeviceScreenshotFormat,
  DeviceWindowBounds,
} from "@/spectral/shared/device-commands"

export const SCREENSHOT_TTL_MS = 15 * 60 * 1000

const SCREENSHOT_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/

type ScreenshotMetadata = {
  deviceId: string
  format: DeviceScreenshotFormat
  width: number
  height: number
  region: DeviceWindowBounds
  expiresAt: number
}

export type ScreenshotMetadataInfo = {
  deviceId: string
  format: DeviceScreenshotFormat
  width: number
  height: number
  region: DeviceWindowBounds
  expiresAt: number
}

export type StoredScreenshot = {
  deviceId: string
  format: DeviceScreenshotFormat
  width: number
  height: number
  region: DeviceWindowBounds
  bytes: Buffer
  expiresAt: number
}

function screenshotDirectory(): string {
  return (
    process.env.SPECTRAL_SCREENSHOT_DIR ?? join(tmpdir(), "spectral-screenshots")
  )
}

function extensionFor(format: DeviceScreenshotFormat): string {
  return format === "png" ? "png" : "jpg"
}

function metadataPath(directory: string, id: string): string {
  return join(directory, `${id}.json`)
}

function imagePath(
  directory: string,
  id: string,
  format: DeviceScreenshotFormat,
): string {
  return join(directory, `${id}.${extensionFor(format)}`)
}

function isValidId(id: string): boolean {
  return SCREENSHOT_ID_PATTERN.test(id)
}

function isScreenshotFormat(value: unknown): value is DeviceScreenshotFormat {
  return value === "jpeg" || value === "png"
}

function isDeviceWindowBounds(value: unknown): value is DeviceWindowBounds {
  if (typeof value !== "object" || value === null) {
    return false
  }

  const bounds = value as Partial<DeviceWindowBounds>

  return (
    Number.isInteger(bounds.x) &&
    Number.isInteger(bounds.y) &&
    Number.isInteger(bounds.width) &&
    Number.isInteger(bounds.height) &&
    (bounds.width ?? 0) > 0 &&
    (bounds.height ?? 0) > 0
  )
}

async function readScreenshotMetadata(
  id: string,
  now = Date.now(),
): Promise<ScreenshotMetadata | null> {
  if (!isValidId(id)) {
    return null
  }

  const directory = screenshotDirectory()
  let metadata: ScreenshotMetadata

  try {
    const parsed: unknown = JSON.parse(
      await readFile(metadataPath(directory, id), "utf8"),
    )

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof (parsed as { deviceId?: unknown }).deviceId !== "string" ||
      !isScreenshotFormat((parsed as { format?: unknown }).format) ||
      !Number.isInteger((parsed as { width?: unknown }).width) ||
      !Number.isInteger((parsed as { height?: unknown }).height) ||
      !isDeviceWindowBounds((parsed as { region?: unknown }).region) ||
      typeof (parsed as { expiresAt?: unknown }).expiresAt !== "number"
    ) {
      return null
    }

    metadata = parsed as ScreenshotMetadata
  } catch {
    return null
  }

  if (metadata.expiresAt <= now) {
    await rm(metadataPath(directory, id), { force: true }).catch(
      () => undefined,
    )
    await rm(imagePath(directory, id, metadata.format), { force: true }).catch(
      () => undefined,
    )
    return null
  }

  return metadata
}

export async function cleanupScreenshots(now = Date.now()): Promise<void> {
  const directory = screenshotDirectory()

  let files: string[]

  try {
    files = await readdir(directory)
  } catch {
    return
  }

  await Promise.all(
    files
      .filter((file) => file.endsWith(".json"))
      .map(async (file) => {
        const metadataFile = join(directory, file)

        try {
          const parsed: unknown = JSON.parse(await readFile(metadataFile, "utf8"))

          if (
            typeof parsed === "object" &&
            parsed !== null &&
            typeof (parsed as { expiresAt?: unknown }).expiresAt === "number" &&
            (parsed as { expiresAt: number }).expiresAt > now
          ) {
            return
          }
        } catch {
          // Metadado corrompido: remove junto com a imagem.
        }

        const id = file.slice(0, -".json".length)

        await rm(metadataFile, { force: true }).catch(() => undefined)
        await rm(join(directory, `${id}.jpg`), { force: true }).catch(
          () => undefined,
        )
        await rm(join(directory, `${id}.png`), { force: true }).catch(
          () => undefined,
        )
      }),
  )
}

export async function saveScreenshot(input: {
  id?: string
  deviceId: string
  format: DeviceScreenshotFormat
  base64: string
  width: number
  height: number
  region: DeviceWindowBounds
  ttlMs?: number
}): Promise<string> {
  const id = input.id ?? createId()

  if (!isValidId(id)) {
    throw new Error("Identificador de captura inválido.")
  }

  if (!isScreenshotFormat(input.format)) {
    throw new Error("Formato de captura inválido.")
  }

  if (
    !Number.isInteger(input.width) ||
    !Number.isInteger(input.height) ||
    input.width <= 0 ||
    input.height <= 0 ||
    !isDeviceWindowBounds(input.region)
  ) {
    throw new Error("Geometria da captura inválida.")
  }

  const bytes = Buffer.from(input.base64, "base64")

  if (bytes.byteLength === 0) {
    throw new Error("A captura veio vazia.")
  }

  const directory = screenshotDirectory()
  await mkdir(directory, { recursive: true })

  const metadata: ScreenshotMetadata = {
    deviceId: input.deviceId,
    format: input.format,
    width: input.width,
    height: input.height,
    region: input.region,
    expiresAt: Date.now() + (input.ttlMs ?? SCREENSHOT_TTL_MS),
  }

  await writeFile(imagePath(directory, id, input.format), bytes)
  await writeFile(
    metadataPath(directory, id),
    JSON.stringify(metadata),
    "utf8",
  )

  void cleanupScreenshots()

  return id
}

export async function getScreenshot(
  id: string,
  now = Date.now(),
): Promise<StoredScreenshot | null> {
  const metadata = await readScreenshotMetadata(id, now)

  if (!metadata) {
    return null
  }

  try {
    const bytes = await readFile(
      imagePath(screenshotDirectory(), id, metadata.format),
    )

    return {
      deviceId: metadata.deviceId,
      format: metadata.format,
      width: metadata.width,
      height: metadata.height,
      region: metadata.region,
      bytes,
      expiresAt: metadata.expiresAt,
    }
  } catch {
    return null
  }
}

export async function getScreenshotMetadata(
  id: string,
  now = Date.now(),
): Promise<ScreenshotMetadataInfo | null> {
  const metadata = await readScreenshotMetadata(id, now)

  return metadata
    ? {
        deviceId: metadata.deviceId,
        format: metadata.format,
        width: metadata.width,
        height: metadata.height,
        region: metadata.region,
        expiresAt: metadata.expiresAt,
      }
    : null
}
