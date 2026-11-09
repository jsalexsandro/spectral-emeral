import { execFile, spawn } from "node:child_process"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { promisify } from "node:util"
import {
  DEVICE_CLIPBOARD_TEXT_MAX_LENGTH,
  type DeviceClipboardContent,
} from "../../../shared/device-commands.js"

const execFileAsync = promisify(execFile)

const CLIPBOARD_TIMEOUT_MS = 10_000
const CLIPBOARD_MAX_BUFFER_BYTES = 4 * 1024 * 1024

export class DeviceClipboardError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = "DeviceClipboardError"
    this.code = code
  }
}

function isWayland(): boolean {
  return (
    process.env.XDG_SESSION_TYPE === "wayland" ||
    Boolean(process.env.WAYLAND_DISPLAY)
  )
}

function errorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code)
    : undefined
}

function errorText(error: unknown): string {
  if (typeof error !== "object" || error === null) {
    return ""
  }

  const stderr = (error as { stderr?: unknown }).stderr

  if (typeof stderr === "string" && stderr.trim()) {
    return stderr.trim().slice(0, 500)
  }

  const message = (error as { message?: unknown }).message

  return typeof message === "string" ? message.trim().slice(0, 500) : ""
}

function toContent(raw: string): DeviceClipboardContent {
  const length = raw.length
  const truncated = length > DEVICE_CLIPBOARD_TEXT_MAX_LENGTH

  return {
    text: truncated ? raw.slice(0, DEVICE_CLIPBOARD_TEXT_MAX_LENGTH) : raw,
    length,
    truncated,
  }
}

async function readFrom(file: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync(file, args, {
    timeout: CLIPBOARD_TIMEOUT_MS,
    maxBuffer: CLIPBOARD_MAX_BUFFER_BYTES,
    windowsHide: true,
  })

  return stdout
}

function writeToStdin(
  file: string,
  args: string[],
  input: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, {
      stdio: ["pipe", "ignore", "pipe"],
      windowsHide: true,
    })
    let stderr = ""

    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8")
    })

    child.on("error", reject)
    child.on("close", (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(
        new Error(
          stderr.trim() || `${file} encerrou com o código ${code ?? "?"}.`,
        ),
      )
    })

    child.stdin?.end(input, "utf8")
  })
}

/* -------------------------------------------------------------------------- */
/* Windows                                                                    */
/* -------------------------------------------------------------------------- */

async function readWindows(): Promise<string> {
  const script = [
    "$ErrorActionPreference = 'Stop'",
    "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8",
    "[Console]::Out.Write((Get-Clipboard -Raw))",
  ].join("; ")

  return readFrom("powershell", [
    "-NoProfile",
    "-NonInteractive",
    "-Command",
    script,
  ])
}

async function writeWindows(text: string): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "spectral-clipboard-"))
  const file = join(directory, "clipboard.txt")

  try {
    await writeFile(file, text, "utf8")

    const script = [
      "$ErrorActionPreference = 'Stop'",
      "$text = [IO.File]::ReadAllText($env:SPECTRAL_CLIPBOARD_FILE, [Text.Encoding]::UTF8)",
      "Set-Clipboard -Value $text",
    ].join("; ")

    await execFileAsync(
      "powershell",
      ["-NoProfile", "-NonInteractive", "-Command", script],
      {
        timeout: CLIPBOARD_TIMEOUT_MS,
        maxBuffer: CLIPBOARD_MAX_BUFFER_BYTES,
        windowsHide: true,
        env: { ...process.env, SPECTRAL_CLIPBOARD_FILE: file },
      },
    )
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

/* -------------------------------------------------------------------------- */
/* macOS                                                                      */
/* -------------------------------------------------------------------------- */

function readMacos(): Promise<string> {
  return readFrom("pbpaste", [])
}

function writeMacos(text: string): Promise<void> {
  return writeToStdin("pbcopy", [], text)
}

/* -------------------------------------------------------------------------- */
/* Linux                                                                      */
/* -------------------------------------------------------------------------- */

async function readLinux(): Promise<string> {
  if (isWayland()) {
    try {
      return await readFrom("wl-paste", ["--no-newline"])
    } catch (error) {
      if (errorCode(error) === "ENOENT") {
        throw new DeviceClipboardError(
          "unsupported_environment",
          "No Wayland, o clipboard exige o pacote wl-clipboard (wl-paste/wl-copy). Instale wl-clipboard para habilitar.",
        )
      }

      throw error
    }
  }

  try {
    return await readFrom("xclip", ["-selection", "clipboard", "-o"])
  } catch (error) {
    if (errorCode(error) !== "ENOENT") {
      throw error
    }
  }

  try {
    return await readFrom("xsel", ["--clipboard", "--output"])
  } catch (error) {
    if (errorCode(error) === "ENOENT") {
      throw new DeviceClipboardError(
        "dependency_missing",
        "O clipboard no Linux exige xclip ou xsel. Instale um dos dois para habilitar.",
      )
    }

    throw error
  }
}

async function writeLinux(text: string): Promise<void> {
  if (isWayland()) {
    try {
      await writeToStdin("wl-copy", [], text)
      return
    } catch (error) {
      if (errorCode(error) === "ENOENT") {
        throw new DeviceClipboardError(
          "unsupported_environment",
          "No Wayland, o clipboard exige o pacote wl-clipboard (wl-paste/wl-copy). Instale wl-clipboard para habilitar.",
        )
      }

      throw error
    }
  }

  try {
    await writeToStdin("xclip", ["-selection", "clipboard", "-i"], text)
    return
  } catch (error) {
    if (errorCode(error) !== "ENOENT") {
      throw error
    }
  }

  try {
    await writeToStdin("xsel", ["--clipboard", "--input"], text)
  } catch (error) {
    if (errorCode(error) === "ENOENT") {
      throw new DeviceClipboardError(
        "dependency_missing",
        "O clipboard no Linux exige xclip ou xsel. Instale um dos dois para habilitar.",
      )
    }

    throw error
  }
}

/* -------------------------------------------------------------------------- */
/* API pública                                                                */
/* -------------------------------------------------------------------------- */

export async function readClipboard(): Promise<DeviceClipboardContent> {
  try {
    if (process.platform === "win32") {
      return toContent(await readWindows())
    }

    if (process.platform === "darwin") {
      return toContent(await readMacos())
    }

    if (process.platform === "linux") {
      return toContent(await readLinux())
    }

    throw new DeviceClipboardError(
      "unsupported_environment",
      "O clipboard não é suportado nesta plataforma.",
    )
  } catch (error) {
    if (error instanceof DeviceClipboardError) {
      throw error
    }

    throw new DeviceClipboardError(
      "clipboard_unavailable",
      `Não foi possível ler o clipboard: ${errorText(error) || "erro desconhecido"}.`,
    )
  }
}

export async function writeClipboard(text: string): Promise<void> {
  try {
    if (process.platform === "win32") {
      await writeWindows(text)
      return
    }

    if (process.platform === "darwin") {
      await writeMacos(text)
      return
    }

    if (process.platform === "linux") {
      await writeLinux(text)
      return
    }

    throw new DeviceClipboardError(
      "unsupported_environment",
      "O clipboard não é suportado nesta plataforma.",
    )
  } catch (error) {
    if (error instanceof DeviceClipboardError) {
      throw error
    }

    throw new DeviceClipboardError(
      "clipboard_write_failed",
      `Não foi possível escrever no clipboard: ${errorText(error) || "erro desconhecido"}.`,
    )
  }
}
