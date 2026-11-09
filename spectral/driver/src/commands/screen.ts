import { execFile } from "node:child_process"
import { randomUUID } from "node:crypto"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { promisify } from "node:util"
import {
  DEVICE_SCREENSHOT_MAX_BYTES,
  type DeviceCommandInputMap,
  type DeviceScreenshot,
  type DeviceWindowBounds,
} from "../../../shared/device-commands.js"

const execFileAsync = promisify(execFile)

const SCREENSHOT_EXEC_TIMEOUT_MS = 15_000
const SCREENSHOT_MAX_BUFFER_BYTES = 1024 * 1024
const MIN_ENCODE_WIDTH = 480
const MAX_ENCODE_ATTEMPTS = 4
const ENCODE_WIDTH_STEP = 0.8

export class DeviceScreenshotError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = "DeviceScreenshotError"
    this.code = code
  }
}

type ScreenshotInput = DeviceCommandInputMap["screenshot"]

type CaptureResult = {
  sourcePath: string
  sourceWidth: number
  sourceHeight: number
  scale: number
  monitor: number | null
  region: DeviceWindowBounds
}

export type ScreenshotCapture = {
  imageBase64: string
  screenshot: DeviceScreenshot
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function toInteger(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.trunc(value)
    : fallback
}

function toNumber(value: unknown, fallback = 1): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : fallback
}

function execErrorCode(error: unknown): string | number | undefined {
  if (!isRecord(error)) {
    return undefined
  }

  return typeof error.code === "string" || typeof error.code === "number"
    ? error.code
    : undefined
}

function execErrorText(error: unknown): string {
  if (!isRecord(error)) {
    return ""
  }

  return [error.stderr, error.message]
    .filter((value): value is string => typeof value === "string")
    .join("\n")
}

function captureError(message: string, error: unknown): DeviceScreenshotError {
  if (execErrorCode(error) === "ENOENT") {
    return new DeviceScreenshotError(
      "dependency_missing",
      `Não foi possível capturar a tela: ${message}`,
    )
  }

  return new DeviceScreenshotError(
    "screen_capture_failed",
    `Não foi possível capturar a tela: ${message}`,
  )
}

function scaledHeight(width: number, sourceWidth: number, sourceHeight: number) {
  return Math.max(1, Math.round((sourceHeight * width) / sourceWidth))
}

/* -------------------------------------------------------------------------- */
/* Windows                                                                    */
/* -------------------------------------------------------------------------- */

const WINDOWS_CAPTURE_SCRIPT = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class SpectralScreenshotDpi {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
}
'@
[void][SpectralScreenshotDpi]::SetProcessDPIAware()

$screens = [System.Windows.Forms.Screen]::AllScreens
$region = $null
$monitor = -1

if ($env:SPECTRAL_SCREENSHOT_REGION) {
  $parts = $env:SPECTRAL_SCREENSHOT_REGION.Split(',')
  $region = New-Object System.Drawing.Rectangle -ArgumentList ([int]$parts[0]), ([int]$parts[1]), ([int]$parts[2]), ([int]$parts[3])
} elseif ($env:SPECTRAL_SCREENSHOT_MONITOR) {
  $index = [int]$env:SPECTRAL_SCREENSHOT_MONITOR
  if ($index -lt 0 -or $index -ge $screens.Length) { exit 5 }
  $region = $screens[$index].Bounds
  $monitor = $index
} else {
  $region = [System.Windows.Forms.SystemInformation]::VirtualScreen
}

$bitmap = New-Object System.Drawing.Bitmap $region.Width, $region.Height
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
try {
  $graphics.CopyFromScreen($region.X, $region.Y, 0, 0, $region.Size)
} finally {
  $graphics.Dispose()
}

$scale = 1.0
try {
  $screenGraphics = [System.Drawing.Graphics]::FromHwnd([IntPtr]::Zero)
  $scale = [Math]::Round($screenGraphics.DpiX / 96.0, 2)
  $screenGraphics.Dispose()
} catch {}

$bitmap.Save($env:SPECTRAL_SCREENSHOT_PATH, [System.Drawing.Imaging.ImageFormat]::Png)
$width = $bitmap.Width
$height = $bitmap.Height
$bitmap.Dispose()

@{ width = $width; height = $height; scale = $scale; monitor = $monitor; x = $region.X; y = $region.Y } | ConvertTo-Json -Compress
`

const WINDOWS_ENCODE_SCRIPT = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$source = [System.Drawing.Image]::FromFile($env:SPECTRAL_SCREENSHOT_INPUT)
try {
  $width = [int]$env:SPECTRAL_SCREENSHOT_WIDTH
  $height = [int][Math]::Round($source.Height * ($width / $source.Width))
  $bitmap = New-Object System.Drawing.Bitmap $width, $height
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  try {
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.DrawImage($source, 0, 0, $width, $height)
  } finally {
    $graphics.Dispose()
  }
} finally {
  $source.Dispose()
}

try {
  if ($env:SPECTRAL_SCREENSHOT_FORMAT -eq 'png') {
    $bitmap.Save($env:SPECTRAL_SCREENSHOT_OUTPUT, [System.Drawing.Imaging.ImageFormat]::Png)
  } else {
    $encoder = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' } | Select-Object -First 1
    $parameters = New-Object System.Drawing.Imaging.EncoderParameters(1)
    $parameters.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]$env:SPECTRAL_SCREENSHOT_QUALITY)
    $bitmap.Save($env:SPECTRAL_SCREENSHOT_OUTPUT, $encoder, $parameters)
  }
} finally {
  $bitmap.Dispose()
}
`

async function captureWindows(
  input: ScreenshotInput,
  sourcePath: string,
): Promise<CaptureResult> {
  let stdout: string

  try {
    const result = await execFileAsync(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        WINDOWS_CAPTURE_SCRIPT,
      ],
      {
        timeout: SCREENSHOT_EXEC_TIMEOUT_MS,
        windowsHide: true,
        maxBuffer: SCREENSHOT_MAX_BUFFER_BYTES,
        env: {
          ...process.env,
          SPECTRAL_SCREENSHOT_PATH: sourcePath,
          SPECTRAL_SCREENSHOT_REGION: input.region
            ? [
                input.region.x,
                input.region.y,
                input.region.width,
                input.region.height,
              ].join(",")
            : "",
          SPECTRAL_SCREENSHOT_MONITOR:
            input.monitor !== undefined ? String(input.monitor) : "",
        },
      },
    )

    stdout = result.stdout
  } catch (error) {
    if (execErrorCode(error) === 5) {
      throw new DeviceScreenshotError(
        "monitor_not_found",
        "O monitor informado não existe no dispositivo.",
      )
    }

    throw captureError("falha ao capturar a tela no Windows.", error)
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(stdout.trim())
  } catch {
    throw new DeviceScreenshotError(
      "invalid_driver_output",
      "O driver não conseguiu interpretar os dados da captura.",
    )
  }

  if (!isRecord(parsed)) {
    throw new DeviceScreenshotError(
      "invalid_driver_output",
      "O driver não conseguiu interpretar os dados da captura.",
    )
  }

  const width = toInteger(parsed.width)
  const height = toInteger(parsed.height)

  if (width <= 0 || height <= 0) {
    throw new DeviceScreenshotError(
      "screen_capture_failed",
      "A captura retornou uma imagem vazia.",
    )
  }

  return {
    sourcePath,
    sourceWidth: width,
    sourceHeight: height,
    scale: toNumber(parsed.scale, 1),
    monitor: input.monitor ?? null,
    region: {
      x: toInteger(parsed.x),
      y: toInteger(parsed.y),
      width,
      height,
    },
  }
}

async function encodeWindows(
  input: ScreenshotInput,
  sourcePath: string,
  outputPath: string,
  width: number,
): Promise<void> {
  try {
    await execFileAsync(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        WINDOWS_ENCODE_SCRIPT,
      ],
      {
        timeout: SCREENSHOT_EXEC_TIMEOUT_MS,
        windowsHide: true,
        maxBuffer: SCREENSHOT_MAX_BUFFER_BYTES,
        env: {
          ...process.env,
          SPECTRAL_SCREENSHOT_INPUT: sourcePath,
          SPECTRAL_SCREENSHOT_OUTPUT: outputPath,
          SPECTRAL_SCREENSHOT_WIDTH: String(width),
          SPECTRAL_SCREENSHOT_QUALITY: String(input.quality),
          SPECTRAL_SCREENSHOT_FORMAT: input.format,
        },
      },
    )
  } catch (error) {
    throw new DeviceScreenshotError(
      "screen_encode_failed",
      "Não foi possível comprimir a captura de tela.",
    )
  }
}

/* -------------------------------------------------------------------------- */
/* macOS                                                                      */
/* -------------------------------------------------------------------------- */

async function commandOutput(
  file: string,
  args: string[],
): Promise<string> {
  const result = await execFileAsync(file, args, {
    timeout: SCREENSHOT_EXEC_TIMEOUT_MS,
    maxBuffer: SCREENSHOT_MAX_BUFFER_BYTES,
  })

  return result.stdout
}

async function captureMacos(
  input: ScreenshotInput,
  sourcePath: string,
): Promise<CaptureResult> {
  const args = ["-x", "-t", "png"]

  if (input.region) {
    args.push(
      "-R",
      [
        input.region.x,
        input.region.y,
        input.region.width,
        input.region.height,
      ].join(","),
    )
  } else if (input.monitor !== undefined) {
    args.push("-D", String(input.monitor + 1))
  }

  args.push(sourcePath)

  try {
    await execFileAsync("screencapture", args, {
      timeout: SCREENSHOT_EXEC_TIMEOUT_MS,
      maxBuffer: SCREENSHOT_MAX_BUFFER_BYTES,
    })
  } catch (error) {
    const text = execErrorText(error)

    if (/permission|not authorized|could not create image/i.test(text)) {
      throw new DeviceScreenshotError(
        "screen_permission_denied",
        "O macOS exige permissão de Gravação de Tela. Autorize o driver em Ajustes do Sistema → Privacidade e Segurança → Gravação de Tela.",
      )
    }

    if (execErrorCode(error) === 1 && input.monitor !== undefined) {
      throw new DeviceScreenshotError(
        "monitor_not_found",
        "O monitor informado não existe no dispositivo.",
      )
    }

    throw captureError("falha ao capturar a tela no macOS.", error)
  }

  let width = 0
  let height = 0

  try {
    const output = await commandOutput("sips", [
      "-g",
      "pixelWidth",
      "-g",
      "pixelHeight",
      sourcePath,
    ])

    width = Number.parseInt(output.match(/pixelWidth:\s*(\d+)/)?.[1] ?? "0", 10)
    height = Number.parseInt(
      output.match(/pixelHeight:\s*(\d+)/)?.[1] ?? "0",
      10,
    )
  } catch {
    width = 0
    height = 0
  }

  if (width <= 0 || height <= 0) {
    throw new DeviceScreenshotError(
      "screen_capture_failed",
      "A captura do macOS retornou uma imagem vazia. Verifique a permissão de Gravação de Tela.",
    )
  }

  let dpi = 0

  try {
    const output = await commandOutput("sips", [
      "-g",
      "dpiWidth",
      sourcePath,
    ])
    dpi = Number.parseFloat(output.match(/dpiWidth:\s*([\d.]+)/)?.[1] ?? "0")
  } catch {
    dpi = 0
  }

  const scaleFromDpi = dpi > 0 ? Math.round((dpi / 72) * 100) / 100 : 0
  const scaleFromRegion = input.region
    ? Math.max(1, Math.round((width / input.region.width) * 100) / 100)
    : 1

  return {
    sourcePath,
    sourceWidth: width,
    sourceHeight: height,
    scale: scaleFromDpi > 0 ? Math.max(1, scaleFromDpi) : scaleFromRegion,
    monitor: input.monitor ?? null,
    region: {
      x: input.region?.x ?? 0,
      y: input.region?.y ?? 0,
      width: input.region?.width ?? width,
      height: input.region?.height ?? height,
    },
  }
}

async function encodeMacos(
  input: ScreenshotInput,
  sourcePath: string,
  outputPath: string,
  width: number,
): Promise<void> {
  const args = ["--resampleWidth", String(width)]

  if (input.format === "jpeg") {
    args.push("-s", "format", "jpeg", "-s", "formatOptions", String(input.quality))
  } else {
    args.push("-s", "format", "png")
  }

  args.push(sourcePath, "--out", outputPath)

  try {
    await execFileAsync("sips", args, {
      timeout: SCREENSHOT_EXEC_TIMEOUT_MS,
      maxBuffer: SCREENSHOT_MAX_BUFFER_BYTES,
    })
  } catch {
    throw new DeviceScreenshotError(
      "screen_encode_failed",
      "Não foi possível comprimir a captura de tela.",
    )
  }
}

/* -------------------------------------------------------------------------- */
/* Linux                                                                      */
/* -------------------------------------------------------------------------- */

function isWayland(): boolean {
  return (
    process.env.XDG_SESSION_TYPE === "wayland" ||
    Boolean(process.env.WAYLAND_DISPLAY)
  )
}

type LinuxGeometry = { x: number; y: number; width: number; height: number }

async function readLinuxMonitorGeometry(
  monitor: number,
): Promise<LinuxGeometry> {
  let stdout: string

  try {
    stdout = await commandOutput("xrandr", ["--listmonitors"])
  } catch (error) {
    if (execErrorCode(error) === "ENOENT") {
      throw new DeviceScreenshotError(
        "dependency_missing",
        "O comando xrandr não está instalado. Instale `x11-xserver-utils` para capturar monitores específicos no Linux.",
      )
    }

    throw new DeviceScreenshotError(
      "screen_capture_failed",
      "Não foi possível consultar os monitores do Linux.",
    )
  }

  const matches = [
    ...stdout.matchAll(/(\d+)\/\d+x(\d+)\/\d+\+(-?\d+)\+(-?\d+)/g),
  ]

  const match = matches[monitor]

  if (!match) {
    throw new DeviceScreenshotError(
      "monitor_not_found",
      "O monitor informado não existe no dispositivo.",
    )
  }

  const width = Number.parseInt(match[1] ?? "0", 10)
  const height = Number.parseInt(match[2] ?? "0", 10)
  const x = Number.parseInt(match[3] ?? "0", 10)
  const y = Number.parseInt(match[4] ?? "0", 10)

  if (width <= 0 || height <= 0) {
    throw new DeviceScreenshotError(
      "screen_capture_failed",
      "Não foi possível determinar o tamanho do monitor no Linux.",
    )
  }

  return { x, y, width, height }
}

async function captureLinux(
  input: ScreenshotInput,
  sourcePath: string,
): Promise<CaptureResult> {
  if (isWayland()) {
    throw new DeviceScreenshotError(
      "unsupported_environment",
      "A captura de tela no Linux exige uma sessão X11. No Wayland o sistema não permite capturar a tela globalmente sem um portal.",
    )
  }

  const args = ["-window", "root"]
  let region: LinuxGeometry | null = input.region ?? null

  if (!region && input.monitor !== undefined) {
    region = await readLinuxMonitorGeometry(input.monitor)
  }

  if (region) {
    args.push(
      "-crop",
      `${region.width}x${region.height}+${region.x}+${region.y}`,
    )
  }

  args.push(sourcePath)

  try {
    await execFileAsync("import", args, {
      timeout: SCREENSHOT_EXEC_TIMEOUT_MS,
      maxBuffer: SCREENSHOT_MAX_BUFFER_BYTES,
    })
  } catch (error) {
    if (execErrorCode(error) === "ENOENT") {
      throw new DeviceScreenshotError(
        "dependency_missing",
        "O comando import (ImageMagick) não está instalado. Instale `imagemagick` para capturar a tela no Linux.",
      )
    }

    throw captureError("falha ao capturar a tela no Linux.", error)
  }

  let width = 0
  let height = 0

  try {
    const output = await commandOutput("identify", [
      "-format",
      "%w %h",
      sourcePath,
    ])
    const [rawWidth, rawHeight] = output.trim().split(/\s+/)
    width = Number.parseInt(rawWidth ?? "0", 10)
    height = Number.parseInt(rawHeight ?? "0", 10)
  } catch {
    width = 0
    height = 0
  }

  if (width <= 0 || height <= 0) {
    throw new DeviceScreenshotError(
      "screen_capture_failed",
      "A captura do Linux retornou uma imagem vazia.",
    )
  }

  return {
    sourcePath,
    sourceWidth: width,
    sourceHeight: height,
    scale: 1,
    monitor: input.monitor ?? null,
    region: region ?? { x: 0, y: 0, width, height },
  }
}

async function encodeLinux(
  input: ScreenshotInput,
  sourcePath: string,
  outputPath: string,
  width: number,
): Promise<void> {
  const args = [sourcePath, "-resize", `${width}x`]

  if (input.format === "jpeg") {
    args.push("-quality", String(input.quality))
  }

  args.push(outputPath)

  try {
    await execFileAsync("convert", args, {
      timeout: SCREENSHOT_EXEC_TIMEOUT_MS,
      maxBuffer: SCREENSHOT_MAX_BUFFER_BYTES,
    })
  } catch (error) {
    if (execErrorCode(error) === "ENOENT") {
      throw new DeviceScreenshotError(
        "dependency_missing",
        "O comando convert (ImageMagick) não está instalado. Instale `imagemagick` para comprimir a captura no Linux.",
      )
    }

    throw new DeviceScreenshotError(
      "screen_encode_failed",
      "Não foi possível comprimir a captura de tela.",
    )
  }
}

/* -------------------------------------------------------------------------- */
/* Platform dispatch                                                          */
/* -------------------------------------------------------------------------- */

async function capturePlatform(
  input: ScreenshotInput,
  sourcePath: string,
): Promise<CaptureResult> {
  switch (process.platform) {
    case "win32":
      return captureWindows(input, sourcePath)
    case "darwin":
      return captureMacos(input, sourcePath)
    case "linux":
      return captureLinux(input, sourcePath)
    default:
      throw new DeviceScreenshotError(
        "unsupported_platform",
        "Captura de tela não é suportada nesta plataforma.",
      )
  }
}

async function encodePlatform(
  input: ScreenshotInput,
  sourcePath: string,
  outputPath: string,
  width: number,
): Promise<void> {
  switch (process.platform) {
    case "win32":
      return encodeWindows(input, sourcePath, outputPath, width)
    case "darwin":
      return encodeMacos(input, sourcePath, outputPath, width)
    case "linux":
      return encodeLinux(input, sourcePath, outputPath, width)
    default:
      throw new DeviceScreenshotError(
        "unsupported_platform",
        "Captura de tela não é suportada nesta plataforma.",
      )
  }
}

function extensionFor(format: ScreenshotInput["format"]): string {
  return format === "png" ? "png" : "jpg"
}

export async function takeScreenshot(
  input: ScreenshotInput,
): Promise<ScreenshotCapture> {
  const directory = await mkdtemp(join(tmpdir(), "spectral-screenshot-"))
  const sourcePath = join(directory, "source.png")
  const outputPath = join(directory, `shot.${extensionFor(input.format)}`)

  try {
    const capture = await capturePlatform(input, sourcePath)
    let width = Math.max(
      1,
      Math.min(input.maxWidth, capture.sourceWidth),
    )

    for (let attempt = 0; attempt < MAX_ENCODE_ATTEMPTS; attempt += 1) {
      await encodePlatform(input, sourcePath, outputPath, width)

      const bytes = await readFile(outputPath)

      if (bytes.byteLength <= DEVICE_SCREENSHOT_MAX_BYTES) {
        const height = scaledHeight(
          width,
          capture.sourceWidth,
          capture.sourceHeight,
        )

        return {
          imageBase64: bytes.toString("base64"),
          screenshot: {
            id: randomUUID(),
            width,
            height,
            scale: capture.scale,
            monitor: capture.monitor,
            region: capture.region,
            format: input.format,
            byteLength: bytes.byteLength,
            capturedAt: new Date().toISOString(),
          },
        }
      }

      if (width <= MIN_ENCODE_WIDTH) {
        break
      }

      width = Math.max(
        MIN_ENCODE_WIDTH,
        Math.floor(width * ENCODE_WIDTH_STEP),
      )
    }

    throw new DeviceScreenshotError(
      "screen_too_large",
      "A captura excedeu o limite de tamanho mesmo após compressão. Tente uma região menor ou reduza `maxWidth`.",
    )
  } finally {
    await rm(directory, { recursive: true, force: true }).catch(() => undefined)
  }
}
