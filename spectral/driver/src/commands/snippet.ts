import { execFile } from "node:child_process"
import { mkdtemp, writeFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { promisify } from "node:util"
import {
  type DeviceCommandInputMap,
  type DeviceCommandResult,
} from "../../../shared/device-commands.js"

const execFileAsync = promisify(execFile)
const SNIPPET_TIMEOUT_MS = 30_000
const SNIPPET_MAX_BUFFER = 4 * 1024 * 1024

type SnippetLanguage = {
  command: string
  args: string[]
  extension: string
}

const LANGUAGE_MAP: Record<string, SnippetLanguage> = {
  node: { command: "node", args: [], extension: ".js" },
  javascript: { command: "node", args: [], extension: ".js" },
  python: { command: "python", args: [], extension: ".py" },
  py: { command: "python", args: [], extension: ".py" },
}

export class DeviceSnippetError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = "DeviceSnippetError"
    this.code = code
  }
}

export async function runSnippet(
  input: DeviceCommandInputMap["run-snippet"],
  defaultFolder?: string,
): Promise<DeviceCommandResult> {
  const language = input.language.toLowerCase()
  const runtime = LANGUAGE_MAP[language]

  if (!runtime) {
    const supported = Object.keys(LANGUAGE_MAP).join(", ")

    return {
      ok: false,
      code: "unsupported_language",
      error: `Idioma "${input.language}" não suportado para snippet. Idiomas disponíveis: ${supported}.`,
    }
  }

  const cwd = input.cwd ?? defaultFolder ?? tmpdir()

  // Escreve o código em um arquivo temporário
  const dir = await mkdtemp(join(tmpdir(), "spectral-snippet-"))
  const fileName = `snippet${runtime.extension}`
  const filePath = join(dir, fileName)

  try {
    await writeFile(filePath, input.code, { encoding: "utf8" })

    const start = Date.now()

    try {
      const { stdout, stderr } = await execFileAsync(
        runtime.command,
        [...runtime.args, filePath],
        {
          timeout: SNIPPET_TIMEOUT_MS,
          windowsHide: true,
          maxBuffer: SNIPPET_MAX_BUFFER,
          cwd,
        },
      )

      const durationMs = Date.now() - start

      return {
        ok: true,
        snippet: {
          language: input.language,
          exitCode: 0,
          stdout: stdout || "",
          stderr: stderr || "",
          durationMs,
          truncated: false,
        },
      }
    } catch (error) {
      const durationMs = Date.now() - start
      const execError = error as {
        code?: number | null
        stdout?: string | Buffer
        stderr?: string | Buffer
      }

      const exitCode = execError.code ?? null
      const stdout =
        typeof execError.stdout === "string"
          ? execError.stdout
          : execError.stdout
            ? execError.stdout.toString("utf8")
          : ""
      const stderr =
        typeof execError.stderr === "string"
          ? execError.stderr
          : execError.stderr
            ? execError.stderr.toString("utf8")
          : ""

      return {
        ok: true,
        snippet: {
          language: input.language,
          exitCode,
          stdout,
          stderr,
          durationMs,
          truncated: false,
        },
      }
    }
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined)
  }
}
