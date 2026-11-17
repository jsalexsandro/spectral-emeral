import { execFile } from "node:child_process"
import { mkdtemp, writeFile, rm, stat } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, isAbsolute } from "node:path"
import { promisify } from "node:util"
import {
  type DeviceCommandInputMap,
  type DeviceCommandResult,
  type DeviceSnippetResult,
} from "../../../shared/device-commands.js"
import { locateCommand } from "./shell.js"

const execFileAsync = promisify(execFile)
const SNIPPET_TIMEOUT_MS = 30_000
const SNIPPET_MAX_BUFFER = 4 * 1024 * 1024
const SNIPPET_TRUNCATE_CHARS = 60_000

/** Nome de linguagem aceito: alfanumérico, sem espaços, sem `..`, sem separadores de caminho. */
const LANGUAGE_RE = /^(?!.*\.\.)[a-z0-9][a-z0-9_+#.-]{0,49}$/

/** Extensão opcional informada pelo modelo para linguagens fora do mapa curado. */
const EXTENSION_RE = /^\.[a-z0-9]{1,10}$/

export class DeviceSnippetError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = "DeviceSnippetError"
    this.code = code
  }
}

type SnippetScriptInvocation = {
  /** Comando/intérprete a executar (ex.: node, python, ruby). */
  command: string
  /** Extensão do arquivo temporário (ex.: .js, .py). */
  extension: string
  /** Id do catálogo fechado de device-setup-toolchain, quando houver. */
  toolchainId?: string
  mode: "script"
  /** Argumentos fixos antes do caminho do arquivo (ex.: ["run"] para `go run`). */
  args: string[]
}

type SnippetCompileRunInvocation = {
  /** Compilador (ex.: rustc, gcc, g++). */
  command: string
  /** Extensão do arquivo-fonte (ex.: .rs, .c). */
  extension: string
  /** Extensão do binário gerado (ex.: .exe no Windows, "" no POSIX). */
  outputExtension: string
  toolchainId?: string
  mode: "compile-run"
  /** Argumentos entre o compilador e o caminho do arquivo-fonte. */
  compileArgs: string[]
  /** Argumentos antes do caminho do binário na execução. */
  runArgs: string[]
}

type SnippetInvocation = SnippetScriptInvocation | SnippetCompileRunInvocation

function isWindows() {
  return process.platform === "win32"
}

function script(
  command: string,
  extension: string,
  args: string[] = [],
  toolchainId?: string,
): SnippetScriptInvocation {
  return { command, extension, toolchainId, mode: "script", args }
}

function compileRun(
  command: string,
  extension: string,
  outputExtension: string,
  compileArgs: string[] = [],
  runArgs: string[] = [],
  toolchainId?: string,
): SnippetCompileRunInvocation {
  return {
    command,
    extension,
    outputExtension,
    toolchainId,
    mode: "compile-run",
    compileArgs,
    runArgs,
  }
}

/**
 * Mapeia nomes de linguagem para descritores de invocação.
 * O modelo pode informar qualquer linguagem; se não estiver no mapa curado,
 * o driver usa o próprio nome como comando (fallback genérico) e a extensão
 * informada ou `.txt`.
 */
const LANGUAGE_MAP: Record<string, SnippetInvocation> = {
  node: script("node", ".js", [], "node"),
  javascript: script("node", ".js", [], "node"),
  js: script("node", ".js", [], "node"),
  python: script(isWindows() ? "python" : "python3", ".py", [], "python"),
  py: script(isWindows() ? "python" : "python3", ".py", [], "python"),
  python3: script(isWindows() ? "python" : "python3", ".py", [], "python"),
  deno: script("deno", ".ts", []),
  ts: script("deno", ".ts", []),
  typescript: script("deno", ".ts", []),
  bun: script("bun", ".js", [], "bun"),
  go: script("go", ".go", ["run"], "go"),
  java: script("java", ".java", [], "java"),
  dotnet: script("dotnet", ".cs", ["run"], "dotnet"),
  csharp: script("dotnet", ".cs", ["run"], "dotnet"),
  cs: script("dotnet", ".cs", ["run"], "dotnet"),
  rust: compileRun("rustc", ".rs", ".exe", [], [], "rust"),
  c: compileRun("gcc", ".c", isWindows() ? ".exe" : "", [], []),
  cpp: compileRun("g++", ".cpp", isWindows() ? ".exe" : "", [], []),
  "c++": compileRun("g++", ".cpp", isWindows() ? ".exe" : "", [], []),
  ruby: script("ruby", ".rb"),
  php: script("php", ".php"),
  perl: script("perl", ".pl"),
  lua: script("lua", ".lua"),
  r: script("Rscript", ".R"),
  swift: script("swift", ".swift"),
  bash: script("bash", ".sh"),
  sh: script("bash", ".sh"),
  powershell: script("pwsh", ".ps1", ["-NoProfile", "-File"]),
  pwsh: script("pwsh", ".ps1", ["-NoProfile", "-File"]),
  ps1: script("pwsh", ".ps1", ["-NoProfile", "-File"]),
}

/**
 * Resolve o descritor de invocação para uma linguagem.
 * Nunca retorna null: linguagens fora do mapa curado usam o próprio nome
 * como comando e `.txt` como extensão padrão (substituída por `extension`
 * quando informada pelo modelo).
 */
export function resolveSnippetInvocation(language: string): SnippetInvocation {
  const normalized = language.toLowerCase().trim()
  const known = LANGUAGE_MAP[normalized]

  if (known) {
    return known
  }

  return {
    command: normalized,
    extension: ".txt",
    mode: "script",
    args: [],
  }
}

function runtimeNotInstalled(
  command: string,
  language: string,
  toolchainId?: string,
): { ok: false; code: "runtime_not_installed"; error: string } {
  const hint = toolchainId
    ? ` O interpretador "${command}" não está instalado. Use device-setup-toolchain para instalar (ex.: toolchain: ${toolchainId}) ou instale manualmente e tente de novo.`
    : ` Instale o interpretador "${command}" e tente de novo.`

  return {
    ok: false,
    code: "runtime_not_installed",
    error: `Não foi possível executar o snippet em "${language}".${hint}`,
  }
}

function invalidSnippetCwd(): {
  ok: false
  code: "invalid_snippet_cwd"
  error: string
} {
  return {
    ok: false,
    code: "invalid_snippet_cwd",
    error: "O diretório de trabalho (cwd) deve ser um caminho absoluto para um diretório existente.",
  }
}

function snippetTimeout(durationMs: number): {
  ok: false
  code: "snippet_timeout"
  error: string
} {
  return {
    ok: false,
    code: "snippet_timeout",
    error: `O snippet excedeu o tempo limite de ${Math.round(durationMs / 1000)}s. Use device-write-file para salvar o código e device-job-start para executá-lo como job em segundo plano.`,
  }
}

/** Extrai o nome da classe pública de um fonte Java para nomear o arquivo temporário. */
function javaPublicClassName(code: string): string {
  const match = /public\s+(?:abstract\s+|final\s+)* (class|interface|enum|record)\s+([A-Za-z_][A-Za-z0-9_]*)/.exec(code)
  return match ? (match[2] ?? "Snippet") : "Snippet"
}

function truncateOutput(value: string): { value: string; truncated: boolean } {
  if (value.length <= SNIPPET_TRUNCATE_CHARS) {
    return { value, truncated: false }
  }
  return { value: value.slice(0, SNIPPET_TRUNCATE_CHARS), truncated: true }
}

function remainingMs(deadline: number): number {
  return Math.max(0, deadline - Date.now())
}

async function runExec(
  command: string,
  args: string[],
  opts: { cwd: string; timeoutMs: number },
): Promise<{
  stdout: string
  stderr: string
  exitCode: number | null
  timedOut: boolean
}> {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      timeout: opts.timeoutMs,
      windowsHide: true,
      maxBuffer: SNIPPET_MAX_BUFFER,
      cwd: opts.cwd,
    })
    return {
      stdout: typeof stdout === "string" ? stdout : "",
      stderr: typeof stderr === "string" ? stderr : "",
      exitCode: 0,
      timedOut: false,
    }
  } catch (error) {
    const execError = error as {
      code?: number | null
      killed?: boolean
      signal?: string
      stdout?: string | Buffer
      stderr?: string | Buffer
    }

    const timedOut = execError.killed === true || execError.code === null
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
      stdout,
      stderr,
      exitCode: typeof execError.code === "number" ? execError.code : null,
      timedOut,
    }
  }
}

/**
 * Executa um trecho de código no dispositivo com o interpretador da linguagem informada.
 *
 * - Qualquer linguagem é aceita: se houver descritor curado, usa comando/extensão/forma corretos;
 *   caso contrário, executa o próprio nome da linguagem como comando (fallback genérico).
 * - `rust`, `c` e `cpp` compilam e depois executam.
 * - `java` nomeia o arquivo temporário pela classe pública (single-file source, Java 11+).
 * - `cwd` deve ser um diretório absoluto existente.
 * - Orçamento total de 30s (compilação + execução). Timeout devolve `snippet_timeout`.
 * - Saída é truncada em ~60k chars com `truncated: true` quando corta.
 * - `exitCode` diferente de zero não é erro de tool: o snippet rodou e o código falhou.
 *   Só falhas de infraestrutura (runtime ausente, compilação, timeout, cwd inválido) devolvem `ok: false`.
 *
 * `options.timeoutMs` é usado apenas nos testes para forçar curto tempo limite.
 */
export async function runSnippet(
  input: DeviceCommandInputMap["run-snippet"],
  defaultFolder?: string,
  options: { timeoutMs?: number } = {},
): Promise<DeviceCommandResult> {
  const timeoutMs = options.timeoutMs ?? SNIPPET_TIMEOUT_MS
  const language = input.language.trim().toLowerCase()

  if (!LANGUAGE_RE.test(language)) {
    return {
      ok: false,
      code: "invalid_snippet_language",
      error: `Idioma "${input.language}" inválido. Use apenas letras, dígitos e os símbolos _ + # . -.`,
    }
  }

  if (!input.code || input.code.length === 0) {
    return {
      ok: false,
      code: "invalid_snippet_code",
      error: "O campo code é obrigatório e não pode estar vazio.",
    }
  }

  if (input.code.length > 64 * 1024) {
    return {
      ok: false,
      code: "invalid_snippet_code",
      error: "O código excede o limite de 64 KB.",
    }
  }

  let extension: string | undefined
  if (input.extension !== undefined) {
    if (!EXTENSION_RE.test(input.extension)) {
      return {
        ok: false,
        code: "invalid_snippet_extension",
        error: `Extensão "${input.extension}" inválida. Use um ponto seguido de até 10 letras ou dígitos minúsculos (ex.: .exs).`,
      }
    }
    extension = input.extension
  }

  const invocation = resolveSnippetInvocation(language)
  const ext = extension ?? invocation.extension

  const cwd = input.cwd ?? defaultFolder ?? tmpdir()

  if (!isAbsolute(cwd)) {
    return invalidSnippetCwd()
  }

  let cwdStat
  try {
    cwdStat = await stat(cwd)
  } catch {
    return invalidSnippetCwd()
  }

  if (!cwdStat.isDirectory()) {
    return invalidSnippetCwd()
  }

  const commandPath = await locateCommand(invocation.command)

  if (!commandPath) {
    return runtimeNotInstalled(invocation.command, language, invocation.toolchainId)
  }

  const dir = await mkdtemp(join(tmpdir(), "spectral-snippet-"))

  try {
    let fileName: string
    if (invocation.mode === "script" && invocation.command === "java") {
      fileName = `${javaPublicClassName(input.code)}.java`
    } else {
      fileName = `snippet${ext}`
    }

    const filePath = join(dir, fileName)
    await writeFile(filePath, input.code, { encoding: "utf8" })

    const start = Date.now()
    const deadline = start + timeoutMs

    let stdout = ""
    let stderr = ""
    let exitCode: number | null = null

    if (invocation.mode === "script") {
      const result = await runExec(commandPath, [...invocation.args, filePath], {
        cwd,
        timeoutMs: remainingMs(deadline),
      })
      stdout = result.stdout
      stderr = result.stderr
      exitCode = result.exitCode

      if (result.timedOut) {
        return snippetTimeout(Date.now() - start)
      }
    } else {
      // compile-then-run
      const outputPath = join(dir, `snippet${invocation.outputExtension}`)
      const compileResult = await runExec(
        commandPath,
        [...invocation.compileArgs, filePath, "-o", outputPath],
        { cwd, timeoutMs: remainingMs(deadline) },
      )

      if (compileResult.timedOut) {
        return snippetTimeout(Date.now() - start)
      }

      if (compileResult.exitCode !== 0) {
        const { value: stderrTruncated } = truncateOutput(compileResult.stderr)
        return {
          ok: false,
          code: "snippet_compile_failed",
          error: `Falha ao compilar o snippet em "${language}". ${stderrTruncated}`,
        }
      }

      const runTimeout = remainingMs(deadline)
      if (runTimeout <= 0) {
        return snippetTimeout(Date.now() - start)
      }

      const runResult = await runExec(outputPath, [...invocation.runArgs], {
        cwd,
        timeoutMs: runTimeout,
      })
      stdout = runResult.stdout
      stderr = runResult.stderr
      exitCode = runResult.exitCode

      if (runResult.timedOut) {
        return snippetTimeout(Date.now() - start)
      }

      // remove o binário gerado junto com o diretório temporário no finally
    }

    const durationMs = Date.now() - start
    const { value: stdoutTruncated, truncated: stdoutTrunc } = truncateOutput(stdout)
    const { value: stderrTruncated, truncated: stderrTrunc } = truncateOutput(stderr)

    const snippet: DeviceSnippetResult = {
      language: input.language,
      command: commandPath,
      exitCode,
      stdout: stdoutTruncated,
      stderr: stderrTruncated,
      durationMs,
      truncated: stdoutTrunc || stderrTrunc,
    }

    return { ok: true, snippet }
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined)
  }
}
