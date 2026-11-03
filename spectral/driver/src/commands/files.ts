import { realpathSync } from "node:fs"
import { lstat, readdir, readFile, realpath } from "node:fs/promises"
import { homedir } from "node:os"
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path"
import { minimatch } from "minimatch"
import type {
  DeviceCommandInputMap,
  DeviceCommandSuccess,
  DeviceFileContent,
  DeviceFileEntry,
  DeviceFileEntryType,
  DeviceGrepMatch,
} from "../../../shared/device-commands.js"

const MAX_READ_FILE_BYTES = 1024 * 1024
const MAX_RETURN_BYTES = 64 * 1024
const MAX_GREP_FILES = 2000
const MAX_GREP_BYTES = 50 * 1024 * 1024
const MAX_GREP_LINE_LENGTH = 2000
const MAX_GREP_MATCH_TEXT = 300
const MAX_WALK_DEPTH = 12

const IGNORED_DIRECTORIES = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  "coverage",
  ".cache",
  "__pycache__",
  ".venv",
  "venv",
  "target",
  "out",
])

const DEFAULT_DENY_PATTERNS = [
  "**/.ssh/**",
  "**/.gnupg/**",
  "**/.aws/**",
  "**/.azure/**",
  "**/.config/gcloud/**",
  "**/.kube/**",
  "**/.docker/**",
  "**/.npmrc",
  "**/.pypirc",
  "**/.netrc",
  "**/.git-credentials",
  "**/.env",
  "**/.env.*",
  "**/id_rsa",
  "**/id_rsa.*",
  "**/id_ed25519",
  "**/id_ed25519.*",
  "**/*.pem",
  "**/*.key",
  "**/*.pfx",
  "**/*.p12",
  "**/*.kdbx",
  "**/credentials",
  "**/Cookies",
  "**/Login Data",
  "**/Web Data",
  "**/Local State",
  "**/AppData/Local/Microsoft/Credentials/**",
  "**/AppData/Roaming/Microsoft/Credentials/**",
  "**/AppData/Local/Google/Chrome/User Data/**",
  "**/AppData/Local/Microsoft/Edge/User Data/**",
  "**/AppData/Roaming/Mozilla/Firefox/Profiles/**",
  "**/Library/Keychains/**",
  "**/.config/google-chrome/**",
  "**/.config/chromium/**",
  "**/.mozilla/**",
  "**/NTUSER.DAT",
  "**/SAM",
  "**/SYSTEM",
  "**/SECURITY",
  "**/pagefile.sys",
  "**/hiberfil.sys",
  "**/swapfile.sys",
] as const

const IS_WINDOWS = process.platform === "win32"

export class DeviceFileError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = "DeviceFileError"
    this.code = code
  }
}

export type FileSandboxOptions = {
  root?: string
  denyPatterns?: readonly string[]
}

type ResolvedPath = {
  absolute: string
  relative: string
}

type WalkOptions = {
  base: string
  maxDepth: number
  showHidden: boolean
  onFile: (absolute: string, relativePath: string) => void | Promise<void>
}

function normalizeRelative(value: string): string {
  return value.split(sep).join("/")
}

function isInsideRoot(root: string, target: string): boolean {
  const rel = relative(root, target)
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel))
}

function isBinaryBuffer(buffer: Buffer): boolean {
  const sample = buffer.subarray(0, Math.min(buffer.length, 8192))

  if (sample.includes(0)) {
    return true
  }

  let control = 0

  for (const byte of sample) {
    if (byte === 9 || byte === 10 || byte === 13) {
      continue
    }

    if (byte < 32 || byte === 127) {
      control += 1
    }
  }

  return sample.length > 0 && control / sample.length > 0.3
}

function truncateUtf8(value: string, maxBytes: number): string {
  const buffer = Buffer.from(value, "utf8")

  if (buffer.length <= maxBytes) {
    return value
  }

  return buffer.subarray(0, maxBytes).toString("utf8")
}

function safeRegex(pattern: string): boolean {
  if (pattern.length > 256) {
    return false
  }

  if (/\\[1-9]/.test(pattern)) {
    return false
  }

  if (/\([^)]*[+*][^)]*\)[+*{]/.test(pattern)) {
    return false
  }

  return true
}

export class FileSandbox {
  readonly root: string
  private readonly denyPatterns: readonly string[]

  constructor(options: FileSandboxOptions = {}) {
    const requestedRoot = resolve(options.root ?? homedir())

    try {
      this.root = realpathSync(requestedRoot)
    } catch {
      this.root = requestedRoot
    }

    this.denyPatterns = options.denyPatterns ?? DEFAULT_DENY_PATTERNS
  }

  isDenied(relativePath: string): boolean {
    const normalized = normalizeRelative(relativePath)

    return this.denyPatterns.some((pattern) =>
      minimatch(normalized, pattern, {
        dot: true,
        nocase: IS_WINDOWS,
      }),
    )
  }

  private expandHome(input: string): string {
    if (input === "~") {
      return this.root
    }

    if (input.startsWith("~/") || input.startsWith("~\\")) {
      return join(this.root, input.slice(2))
    }

    return input
  }

  async resolvePath(
    input: string | undefined,
    mustExist = true,
  ): Promise<ResolvedPath> {
    const candidate = this.expandHome(input ?? ".")
    const absolute = isAbsolute(candidate)
      ? resolve(candidate)
      : resolve(this.root, candidate)

    if (absolute !== this.root) {
      try {
        const direct = await lstat(absolute)

        if (direct.isSymbolicLink()) {
          throw new DeviceFileError(
            "symlink_not_allowed",
            "Links simbólicos não são permitidos.",
          )
        }
      } catch (error) {
        if (error instanceof DeviceFileError) {
          throw error
        }
      }
    }

    let real: string

    try {
      real = mustExist
        ? await realpath(absolute)
        : join(
            await realpath(dirname(absolute)).catch(() => dirname(absolute)),
            basename(absolute),
          )
    } catch (error) {
      const code =
        error instanceof Error && "code" in error
          ? String((error as NodeJS.ErrnoException).code)
          : ""

      if (code === "ENOENT") {
        throw new DeviceFileError(
          "path_not_found",
          "O caminho informado não existe.",
        )
      }

      throw new DeviceFileError(
        "path_unreadable",
        "Não foi possível acessar o caminho informado.",
      )
    }

    if (!isInsideRoot(this.root, real)) {
      throw new DeviceFileError(
        "path_outside_root",
        "O caminho está fora do diretório permitido.",
      )
    }

    const relativePath = normalizeRelative(relative(this.root, real))

    if (this.isDenied(relativePath)) {
      throw new DeviceFileError(
        "path_denied",
        "O caminho é bloqueado por segurança.",
      )
    }

    return { absolute: real, relative: relativePath }
  }

  private async walkFiles(options: WalkOptions): Promise<void> {
    const stack: Array<{ directory: string; depth: number }> = [
      { directory: options.base, depth: 0 },
    ]

    while (stack.length > 0) {
      const current = stack.pop()

      if (!current) {
        continue
      }

      let entries

      try {
        entries = await readdir(current.directory, { withFileTypes: true })
      } catch {
        continue
      }

      for (const entry of entries) {
        if (!options.showHidden && entry.name.startsWith(".")) {
          continue
        }

        const absolute = join(current.directory, entry.name)
        const relativeToRoot = normalizeRelative(relative(this.root, absolute))

        if (this.isDenied(relativeToRoot)) {
          continue
        }

        if (entry.isSymbolicLink()) {
          continue
        }

        if (entry.isDirectory()) {
          if (
            IGNORED_DIRECTORIES.has(entry.name) ||
            current.depth >= options.maxDepth
          ) {
            continue
          }

          stack.push({ directory: absolute, depth: current.depth + 1 })
          continue
        }

        if (entry.isFile()) {
          await options.onFile(absolute, relativeToRoot)
        }
      }
    }
  }

  async listFiles(
    input: DeviceCommandInputMap["list-files"],
  ): Promise<DeviceCommandSuccess> {
    const target = await this.resolvePath(input.path)
    const stats = await lstat(target.absolute)

    if (!stats.isDirectory()) {
      throw new DeviceFileError(
        "not_a_directory",
        "O caminho informado não é um diretório.",
      )
    }

    const entries: DeviceFileEntry[] = []
    const stack: Array<{ directory: string; depth: number }> = [
      { directory: target.absolute, depth: 0 },
    ]
    let truncated = false

    while (stack.length > 0 && !truncated) {
      const current = stack.pop()

      if (!current) {
        continue
      }

      let directoryEntries

      try {
        directoryEntries = await readdir(current.directory, {
          withFileTypes: true,
        })
      } catch {
        continue
      }

      const sorted = [...directoryEntries].sort((left, right) => {
        if (left.isDirectory() !== right.isDirectory()) {
          return left.isDirectory() ? -1 : 1
        }

        return left.name.localeCompare(right.name)
      })

      for (const entry of sorted) {
        if (!input.showHidden && entry.name.startsWith(".")) {
          continue
        }

        if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) {
          continue
        }

        const absolute = join(current.directory, entry.name)
        const relativeToRoot = normalizeRelative(relative(this.root, absolute))

        if (this.isDenied(relativeToRoot)) {
          continue
        }

        if (entries.length >= input.maxEntries) {
          truncated = true
          break
        }

        let type: DeviceFileEntryType = "other"
        let size: number | null = null
        let modifiedAt: string | null = null

        try {
          const stats = await lstat(absolute)
          modifiedAt = stats.mtime.toISOString()

          if (entry.isSymbolicLink()) {
            type = "symlink"
          } else if (entry.isDirectory()) {
            type = "directory"
          } else if (entry.isFile()) {
            type = "file"
            size = stats.size
          }
        } catch {
          type = "other"
        }

        entries.push({
          name: entry.name,
          path: absolute,
          type,
          size,
          modifiedAt,
        })

        if (
          type === "directory" &&
          !IGNORED_DIRECTORIES.has(entry.name) &&
          current.depth < input.depth
        ) {
          stack.push({ directory: absolute, depth: current.depth + 1 })
        }
      }
    }

    return {
      ok: true,
      entries,
      total: entries.length,
      truncated,
    }
  }

  async readFile(
    input: DeviceCommandInputMap["read-file"],
  ): Promise<DeviceCommandSuccess> {
    const target = await this.resolvePath(input.path)
    const stats = await lstat(target.absolute)

    if (stats.isSymbolicLink()) {
      throw new DeviceFileError(
        "symlink_not_allowed",
        "Links simbólicos não são permitidos.",
      )
    }

    if (!stats.isFile()) {
      throw new DeviceFileError(
        "not_a_file",
        "O caminho informado não é um arquivo.",
      )
    }

    if (stats.size > MAX_READ_FILE_BYTES) {
      throw new DeviceFileError(
        "file_too_large",
        `O arquivo tem ${stats.size} bytes e excede o limite de ${MAX_READ_FILE_BYTES} bytes.`,
      )
    }

    const buffer = await readFile(target.absolute)

    if (isBinaryBuffer(buffer)) {
      throw new DeviceFileError(
        "binary_file",
        "O arquivo parece ser binário e não pode ser lido como texto.",
      )
    }

    const text = buffer.toString("utf8")
    const lines = text.split(/\r?\n/)
    const totalLines = lines.length
    const startIndex = Math.min(input.offset - 1, totalLines)
    const endIndex = Math.min(totalLines, startIndex + input.limit)
    const selectedLines = lines.slice(startIndex, endIndex)
    let content = selectedLines.join("\n")
    let truncated = endIndex < totalLines

    if (Buffer.byteLength(content, "utf8") > MAX_RETURN_BYTES) {
      content = truncateUtf8(content, MAX_RETURN_BYTES)
      truncated = true
    }

    const returnedLines = content.length === 0 ? 0 : content.split("\n").length
    const file: DeviceFileContent = {
      path: target.absolute,
      content,
      startLine: input.offset,
      endLine:
        returnedLines === 0 ? input.offset - 1 : input.offset + returnedLines - 1,
      totalLines,
      truncated,
      size: stats.size,
    }

    return { ok: true, file }
  }

  async glob(
    input: DeviceCommandInputMap["glob"],
  ): Promise<DeviceCommandSuccess> {
    const target = await this.resolvePath(input.path)
    const stats = await lstat(target.absolute)

    if (!stats.isDirectory()) {
      throw new DeviceFileError(
        "not_a_directory",
        "O caminho informado não é um diretório.",
      )
    }

    const paths: string[] = []
    let truncated = false

    await this.walkFiles({
      base: target.absolute,
      maxDepth: MAX_WALK_DEPTH,
      showHidden: input.showHidden,
      onFile: (absolute) => {
        if (paths.length >= input.maxResults) {
          truncated = true
          return
        }

        const relativeToBase = normalizeRelative(
          relative(target.absolute, absolute),
        )

        if (
          minimatch(relativeToBase, input.pattern, {
            dot: input.showHidden,
            nocase: IS_WINDOWS,
          })
        ) {
          paths.push(absolute)
        }
      },
    })

    paths.sort((left, right) => left.localeCompare(right))

    return {
      ok: true,
      paths,
      total: paths.length,
      truncated,
    }
  }

  async grep(
    input: DeviceCommandInputMap["grep"],
  ): Promise<DeviceCommandSuccess> {
    const target = await this.resolvePath(input.path)
    const stats = await lstat(target.absolute)

    if (!stats.isDirectory()) {
      throw new DeviceFileError(
        "not_a_directory",
        "O caminho informado não é um diretório.",
      )
    }

    if (!safeRegex(input.pattern)) {
      throw new DeviceFileError(
        "invalid_pattern",
        "O padrão de busca não é seguro ou é muito complexo.",
      )
    }

    let regex: RegExp

    try {
      regex = new RegExp(input.pattern, input.caseSensitive ? "" : "i")
    } catch {
      throw new DeviceFileError(
        "invalid_pattern",
        "O padrão de busca não é uma expressão regular válida.",
      )
    }

    const matches: DeviceGrepMatch[] = []
    const filePattern = input.glob ?? "**/*"
    let filesScanned = 0
    let bytesScanned = 0
    let truncated = false

    await this.walkFiles({
      base: target.absolute,
      maxDepth: MAX_WALK_DEPTH,
      showHidden: true,
      onFile: async (absolute) => {
        if (matches.length >= input.maxResults) {
          truncated = true
          return
        }

        if (filesScanned >= MAX_GREP_FILES || bytesScanned >= MAX_GREP_BYTES) {
          truncated = true
          return
        }

        const relativeToBase = normalizeRelative(
          relative(target.absolute, absolute),
        )

        if (
          !minimatch(relativeToBase, filePattern, {
            dot: true,
            nocase: IS_WINDOWS,
          })
        ) {
          return
        }

        let fileStats

        try {
          fileStats = await lstat(absolute)
        } catch {
          return
        }

        if (
          !fileStats.isFile() ||
          fileStats.isSymbolicLink() ||
          fileStats.size > MAX_READ_FILE_BYTES
        ) {
          return
        }

        filesScanned += 1
        bytesScanned += fileStats.size

        let buffer: Buffer

        try {
          buffer = await readFile(absolute)
        } catch {
          return
        }

        if (isBinaryBuffer(buffer)) {
          return
        }

        const lines = buffer.toString("utf8").split(/\r?\n/)

        for (let index = 0; index < lines.length; index += 1) {
          if (matches.length >= input.maxResults) {
            truncated = true
            return
          }

          const line = (lines[index] ?? "").slice(0, MAX_GREP_LINE_LENGTH)
          const match = regex.exec(line)

          if (!match) {
            continue
          }

          matches.push({
            path: absolute,
            line: index + 1,
            column: match.index + 1,
            text: line.slice(0, MAX_GREP_MATCH_TEXT),
          })
        }
      },
    })

    return {
      ok: true,
      matches,
      total: matches.length,
      filesScanned,
      truncated,
    }
  }
}

let defaultSandbox: FileSandbox | undefined

export function getDefaultFileSandbox(): FileSandbox {
  if (!defaultSandbox) {
    defaultSandbox = new FileSandbox()
  }

  return defaultSandbox
}
