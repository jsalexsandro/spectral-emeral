import { execFile } from "node:child_process"
import { lstat, readdir, readFile } from "node:fs/promises"
import { basename, dirname, join } from "node:path"
import { promisify } from "node:util"
import {
  DEVICE_GIT_FILES_MAX,
  DEVICE_PROJECT_ENTRIES_MAX,
  DEVICE_PROJECT_WALK_UP_MAX,
  type DeviceCommandInputMap,
  type DeviceCommandSuccess,
  type DeviceFileEntry,
  type DeviceGitDiff,
  type DeviceGitFileStatus,
  type DeviceGitStatus,
  type DeviceProjectInfo,
  type DeviceProjectManifest,
  type DeviceProjectPin,
  type DeviceProjectScript,
  type DeviceProjectCommit,
  type DeviceToolchainId,
} from "../../../shared/device-commands.js"
import type { FileSandbox } from "./files.js"
import { locateCommand, readVersion } from "./shell.js"
import { getInstalledRuntimes } from "./system.js"

const execFileAsync = promisify(execFile)
const GIT_TIMEOUT_MS = 10_000
const GIT_MAX_BUFFER = 4 * 1024 * 1024

// Marcadores que indicam a raiz de um projeto. A busca sobe no máximo
// DEVICE_PROJECT_WALK_UP_MAX níveis a partir da pasta informada.
const PROJECT_MARKERS = new Set([
  "package.json",
  "pyproject.toml",
  "requirements.txt",
  "Pipfile",
  "Cargo.toml",
  "go.mod",
  "global.json",
  "pom.xml",
  "build.gradle",
  "build.gradle.kts",
  "Gemfile",
  "composer.json",
  ".git",
])

const PROJECT_MARKER_SUFFIXES = [".sln", ".csproj"] as const

const INSTALLED_DIRECTORIES: Record<string, string[]> = {
  javascript: ["node_modules"],
  typescript: ["node_modules"],
  python: [".venv", "venv", ".tox"],
  rust: ["target"],
  php: ["vendor"],
}

type PackageJson = {
  name?: unknown
  packageManager?: unknown
  scripts?: unknown
  engines?: unknown
  dependencies?: unknown
  devDependencies?: unknown
  workspaces?: unknown
}

type GitBinary = string | null

async function gitBinary(): Promise<GitBinary> {
  return locateCommand("git")
}

async function runGit(
  git: string,
  root: string,
  args: string[],
): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(
      git,
      [
        "-C",
        root,
        "--no-optional-locks",
        "-c",
        "core.fsmonitor=false",
        "-c",
        "core.quotepath=false",
        "-c",
        "color.ui=false",
        ...args,
      ],
      {
        timeout: GIT_TIMEOUT_MS,
        maxBuffer: GIT_MAX_BUFFER,
        windowsHide: true,
        encoding: "utf8",
        env: {
          ...process.env,
          GIT_OPTIONAL_LOCKS: "0",
          GIT_TERMINAL_PROMPT: "0",
          GIT_PAGER: "cat",
        },
      },
    )

    return stdout
  } catch {
    return null
  }
}

async function resolveGitRoot(
  git: string,
  start: string,
): Promise<string | null> {
  const output = await runGit(git, start, ["rev-parse", "--show-toplevel"])
  const root = output?.split(/\r?\n/).map((line) => line.trim()).find(Boolean)

  return root ?? null
}

/** Converte a saída de `git status --porcelain=v2 --branch -z`. */
export function parseGitStatusOutput(output: string): {
  branch: string
  upstream: string | null
  ahead: number
  behind: number
  counts: DeviceGitStatus["counts"]
  files: DeviceGitFileStatus[]
} {
  let branch = "(desconhecida)"
  let upstream: string | null = null
  let ahead = 0
  let behind = 0
  let staged = 0
  let unstaged = 0
  let untracked = 0
  let conflicted = 0
  const files: DeviceGitFileStatus[] = []
  const records = output.split("\0")
  const pushTracked = (xy: string, path: string) => {
    const indexStatus = xy.charAt(0)
    const worktreeStatus = xy.charAt(1)

    if (indexStatus !== ".") {
      staged += 1
    }

    if (worktreeStatus !== ".") {
      unstaged += 1
    }

    files.push({ path, status: xy, staged: indexStatus !== "." })
  }

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index]

    if (!record) {
      continue
    }

    if (record.startsWith("# branch.head ")) {
      branch = record.slice("# branch.head ".length).trim() || branch
      continue
    }

    if (record.startsWith("# branch.upstream ")) {
      upstream = record.slice("# branch.upstream ".length).trim() || null
      continue
    }

    if (record.startsWith("# branch.ab ")) {
      const match = record.match(/\+(\d+)\s+-(\d+)/)

      if (match) {
        ahead = Number(match[1])
        behind = Number(match[2])
      }

      continue
    }

    if (record.startsWith("1 ")) {
      const parts = record.split(" ")

      pushTracked(parts[1] ?? "??", parts.slice(8).join(" "))
      continue
    }

    if (record.startsWith("2 ")) {
      const parts = record.split(" ")

      // Rename: o próximo registro é o caminho original e deve ser consumido.
      index += 1
      pushTracked(parts[1] ?? "??", parts.slice(9).join(" "))
      continue
    }

    if (record.startsWith("u ")) {
      const parts = record.split(" ")

      conflicted += 1
      files.push({ path: parts.slice(10).join(" "), status: "UU", staged: false })
      continue
    }

    if (record.startsWith("? ")) {
      untracked += 1
      files.push({ path: record.slice(2), status: "??", staged: false })
    }
  }

  return {
    branch,
    upstream,
    ahead,
    behind,
    counts: { staged, unstaged, untracked, conflicted },
    files,
  }
}

async function readGitStatus(
  root: string,
  includeUntracked = true,
): Promise<DeviceGitStatus | null> {
  const git = await gitBinary()

  if (!git) {
    return null
  }

  const repoRoot = await resolveGitRoot(git, root)

  if (!repoRoot) {
    return null
  }

  const output = await runGit(git, repoRoot, [
    "status",
    "--porcelain=v2",
    "--branch",
    "-z",
    includeUntracked ? "--untracked-files=normal" : "--untracked-files=no",
  ])

  if (output === null) {
    return null
  }

  const parsed = parseGitStatusOutput(output)

  return {
    root: repoRoot,
    branch: parsed.branch,
    upstream: parsed.upstream,
    ahead: parsed.ahead,
    behind: parsed.behind,
    clean: parsed.files.length === 0,
    counts: parsed.counts,
    files: parsed.files.slice(0, DEVICE_GIT_FILES_MAX),
    truncated: parsed.files.length > DEVICE_GIT_FILES_MAX,
  }
}

function toPosix(value: string): string {
  return value.replace(/\\/g, "/")
}

async function readLastCommit(
  git: string,
  root: string,
): Promise<DeviceProjectCommit | null> {
  const output = await runGit(git, root, [
    "log",
    "-1",
    "--format=%H%x00%s%x00%cI",
  ])

  if (!output) {
    return null
  }

  const [hash, subject, date] = output.trim().split("\0")

  if (!hash) {
    return null
  }

  return {
    hash,
    subject: subject ?? "",
    date: date ?? "",
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await lstat(path)
    return true
  } catch {
    return false
  }
}

async function readText(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8")
  } catch {
    return null
  }
}

function parseFirstVersion(value: string): string {
  const line = value.split(/\r?\n/).map((item) => item.trim()).find(Boolean)

  return line ?? value.trim()
}

function versionMajor(value: string | null | undefined): number | null {
  if (!value) {
    return null
  }

  const match = value.match(/(\d+)/)

  return match ? Number(match[1]) : null
}

function pickFramework(dependencies: Record<string, string>): string | null {
  const order = [
    "next",
    "nuxt",
    "astro",
    "remix",
    "@remix-run/react",
    "@angular/core",
    "svelte",
    "solid-js",
    "electron",
    "react-native",
    "vue",
    "react",
    "@nestjs/core",
    "nest",
    "fastify",
    "express",
    "hono",
    "koa",
  ]

  return order.find((name) => name in dependencies) ?? null
}

function normalizeDependencies(value: unknown): Record<string, string> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  )
}

function normalizeScripts(value: unknown): DeviceProjectScript[] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return []
  }

  return Object.entries(value)
    .filter((entry): entry is [string, string] => typeof entry[1] === "string")
    .map(([name, command]) => ({ name, command }))
}

function normalizeEngines(value: unknown): Record<string, string> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null
  }

  const entries = Object.entries(value).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string",
  )

  return entries.length > 0 ? Object.fromEntries(entries) : null
}

async function detectPackageManager(root: string): Promise<string | null> {
  const lockfiles: Array<[string, string]> = [
    ["pnpm-lock.yaml", "pnpm"],
    ["yarn.lock", "yarn"],
    ["bun.lockb", "bun"],
    ["bun.lock", "bun"],
    ["package-lock.json", "npm"],
    ["npm-shrinkwrap.json", "npm"],
  ]

  for (const [file, manager] of lockfiles) {
    if (await fileExists(join(root, file))) {
      return manager
    }
  }

  return null
}

async function detectPythonManager(root: string): Promise<string> {
  if (await fileExists(join(root, "uv.lock"))) {
    return "uv"
  }

  if (await fileExists(join(root, "poetry.lock"))) {
    return "poetry"
  }

  if (await fileExists(join(root, "Pipfile"))) {
    return "pipenv"
  }

  const pyproject = await readText(join(root, "pyproject.toml"))

  if (pyproject?.includes("[tool.poetry]")) {
    return "poetry"
  }

  if (pyproject?.includes("[tool.uv]")) {
    return "uv"
  }

  return "pip"
}

async function detectManifests(root: string): Promise<{
  manifests: DeviceProjectManifest[]
  names: Set<string>
}> {
  const names = new Set<string>()

  try {
    for (const entry of await readdir(root, { withFileTypes: true })) {
      names.add(entry.name)
    }
  } catch {
    return { manifests: [], names }
  }

  const manifests: DeviceProjectManifest[] = []
  const add = (name: string, kind: string) =>
    manifests.push({ path: join(root, name), kind })
  const simple: Array<[string, string]> = [
    ["package.json", "node"],
    ["tsconfig.json", "typescript"],
    ["pnpm-lock.yaml", "pnpm-lock"],
    ["yarn.lock", "yarn-lock"],
    ["bun.lockb", "bun-lock"],
    ["bun.lock", "bun-lock"],
    ["package-lock.json", "npm-lock"],
    ["pyproject.toml", "python-project"],
    ["requirements.txt", "python-requirements"],
    ["Pipfile", "pipenv"],
    ["poetry.lock", "poetry-lock"],
    ["uv.lock", "uv-lock"],
    ["Cargo.toml", "cargo"],
    ["go.mod", "go-mod"],
    ["global.json", "dotnet-sdk"],
    ["pom.xml", "maven"],
    ["build.gradle", "gradle"],
    ["build.gradle.kts", "gradle"],
    ["Gemfile", "bundler"],
    ["composer.json", "composer"],
    ["Makefile", "make"],
    ["Dockerfile", "docker"],
  ]

  for (const [name, kind] of simple) {
    if (names.has(name)) {
      add(name, kind)
    }
  }

  for (const name of names) {
    if (name.endsWith(".sln")) {
      add(name, "dotnet-solution")
    } else if (name.endsWith(".csproj")) {
      add(name, "dotnet-project")
    }
  }

  return { manifests, names }
}

async function readPinnedVersions(
  root: string,
  names: Set<string>,
  engines: Record<string, string> | null,
): Promise<DeviceProjectPin[]> {
  const pinned: DeviceProjectPin[] = []
  const add = (tool: string, version: string | null, source: string) => {
    const trimmed = version?.trim()

    if (trimmed) {
      pinned.push({ tool, version: trimmed, source })
    }
  }

  if (names.has(".nvmrc")) {
    add("node", await readText(join(root, ".nvmrc")), ".nvmrc")
  }

  if (names.has(".node-version")) {
    add("node", await readText(join(root, ".node-version")), ".node-version")
  }

  if (names.has(".python-version")) {
    add("python", await readText(join(root, ".python-version")), ".python-version")
  }

  if (names.has(".tool-versions")) {
    const content = await readText(join(root, ".tool-versions"))

    for (const line of content?.split(/\r?\n/) ?? []) {
      const [tool, version] = line.trim().split(/\s+/)

      if (tool && version && !tool.startsWith("#")) {
        add(tool, version, ".tool-versions")
      }
    }
  }

  if (names.has("rust-toolchain.toml")) {
    const content = await readText(join(root, "rust-toolchain.toml"))
    const match = content?.match(/channel\s*=\s*"([^"]+)"/)

    add("rust", match?.[1] ?? null, "rust-toolchain.toml")
  }

  if (engines) {
    for (const [tool, version] of Object.entries(engines)) {
      add(tool, version, "package.json#engines")
    }
  }

  if (names.has("go.mod")) {
    const content = await readText(join(root, "go.mod"))
    const match = content?.match(/^go\s+(\S+)/m)

    add("go", match?.[1] ?? null, "go.mod")
  }

  if (names.has("global.json")) {
    const content = await readText(join(root, "global.json"))

    try {
      const data = JSON.parse(content ?? "") as { sdk?: { version?: unknown } }

      add(
        "dotnet",
        typeof data.sdk?.version === "string" ? data.sdk.version : null,
        "global.json",
      )
    } catch {
      // Arquivo inválido não invalida o raio-x.
    }
  }

  return pinned
}

async function detectDependenciesInstalled(
  root: string,
  language: string | null,
): Promise<{ installed: boolean | null; manager: string | null }> {
  if (!language) {
    return { installed: null, manager: null }
  }

  const candidates = INSTALLED_DIRECTORIES[language]

  if (!candidates) {
    return { installed: null, manager: null }
  }

  for (const name of candidates) {
    if (await fileExists(join(root, name))) {
      return { installed: true, manager: name }
    }
  }

  return { installed: false, manager: null }
}

async function listEntries(root: string): Promise<DeviceFileEntry[]> {
  let directoryEntries

  try {
    directoryEntries = await readdir(root, { withFileTypes: true })
  } catch {
    return []
  }

  const sorted = [...directoryEntries]
    .filter((entry) => entry.name !== ".git")
    .sort((left, right) => {
      if (left.isDirectory() !== right.isDirectory()) {
        return left.isDirectory() ? -1 : 1
      }

      return left.name.localeCompare(right.name)
    })
    .slice(0, DEVICE_PROJECT_ENTRIES_MAX)

  const entries: DeviceFileEntry[] = []

  for (const entry of sorted) {
    const absolute = join(root, entry.name)
    let size: number | null = null
    let modifiedAt: string | null = null

    try {
      const stats = await lstat(absolute)
      modifiedAt = stats.mtime.toISOString()

      if (stats.isFile()) {
        size = stats.size
      }
    } catch {
      // Entrada que desapareceu no meio do caminho.
    }

    entries.push({
      name: entry.name,
      path: absolute,
      type: entry.isSymbolicLink()
        ? "symlink"
        : entry.isDirectory()
          ? "directory"
          : entry.isFile()
            ? "file"
            : "other",
      size,
      modifiedAt,
    })
  }

  return entries
}

async function resolveStart(
  path: string | undefined,
  sandbox: FileSandbox,
): Promise<string> {
  const target = await sandbox.resolvePath(path)
  const stats = await lstat(target.absolute)

  return stats.isDirectory() ? target.absolute : dirname(target.absolute)
}

async function findProjectRoot(start: string): Promise<string> {
  let current = start

  for (let depth = 0; depth <= DEVICE_PROJECT_WALK_UP_MAX; depth += 1) {
    try {
      const names = new Set(
        (await readdir(current, { withFileTypes: true })).map(
          (entry) => entry.name,
        ),
      )

      if (
        [...PROJECT_MARKERS].some((marker) => names.has(marker)) ||
        [...names].some((name) =>
          PROJECT_MARKER_SUFFIXES.some((suffix) => name.endsWith(suffix)),
        )
      ) {
        return current
      }
    } catch {
      // Sem permissão de leitura: continua subindo.
    }

    const parent = dirname(current)

    if (parent === current) {
      break
    }

    current = parent
  }

  return start
}

async function detectGitState(
  root: string,
): Promise<DeviceProjectInfo["git"]> {
  const status = await readGitStatus(root)

  if (!status) {
    return null
  }

  const git = await gitBinary()

  return {
    branch: status.branch,
    upstream: status.upstream,
    ahead: status.ahead,
    behind: status.behind,
    dirty: !status.clean,
    changedFiles: status.files.length,
    lastCommit: git ? await readLastCommit(git, status.root) : null,
  }
}

type RuntimeRequirement = {
  id: string
  toolchain: DeviceToolchainId | null
  label: string
}

function projectRuntimeRequirements(
  language: string | null,
  packageManager: string | null,
): RuntimeRequirement[] {
  const reqs: RuntimeRequirement[] = []

  if (language === "javascript" || language === "typescript") {
    reqs.push({ id: "node", toolchain: "node", label: "Node.js" })
    if (packageManager === "pnpm") {
      reqs.push({ id: "pnpm", toolchain: "pnpm", label: "pnpm" })
    } else if (packageManager === "yarn") {
      reqs.push({ id: "yarn", toolchain: "yarn", label: "Yarn" })
    } else if (packageManager === "bun") {
      reqs.push({ id: "bun", toolchain: "bun", label: "Bun" })
    }
  } else if (language === "python") {
    reqs.push({ id: "python", toolchain: "python", label: "Python" })
    if (packageManager === "uv") {
      reqs.push({ id: "uv", toolchain: "uv", label: "uv" })
    }
  } else if (language === "rust") {
    reqs.push({ id: "cargo", toolchain: "rust", label: "Rust (cargo)" })
  } else if (language === "go") {
    reqs.push({ id: "go", toolchain: "go", label: "Go" })
  } else if (language === "csharp") {
    reqs.push({ id: "dotnet", toolchain: "dotnet", label: ".NET SDK" })
  } else if (language === "java" || language === "kotlin") {
    reqs.push({ id: "java", toolchain: "java", label: "Java" })
  } else if (language === "ruby") {
    reqs.push({ id: "ruby", toolchain: null, label: "Ruby" })
  } else if (language === "php") {
    reqs.push({ id: "php", toolchain: null, label: "PHP" })
  }

  return reqs
}

function missingRuntimeWarnings(
  language: string | null,
  packageManager: string | null,
  installedIds: Set<string>,
  runtimesDetected: boolean,
): string[] {
  if (!runtimesDetected) {
    return []
  }

  const warnings: string[] = []
  const seen = new Set<string>()

  for (const req of projectRuntimeRequirements(language, packageManager)) {
    if (seen.has(req.id)) {
      continue
    }
    seen.add(req.id)

    if (installedIds.has(req.id)) {
      continue
    }

    if (req.toolchain) {
      warnings.push(
        `Este projeto usa ${req.label}, mas o \`${req.id}\` não foi encontrado neste PC. Posso instalar com \`device-setup-toolchain\` (\`toolchain: ${req.toolchain}\`).`,
      )
    } else {
      warnings.push(
        `Este projeto usa ${req.label}, mas o \`${req.id}\` não foi encontrado neste PC.`,
      )
    }
  }

  return warnings
}

export async function getProjectInfo(
  input: DeviceCommandInputMap["project-info"],
  sandbox: FileSandbox,
): Promise<DeviceCommandSuccess> {
  const start = await resolveStart(input.path, sandbox)
  const root = await findProjectRoot(start)
  const { manifests, names } = await detectManifests(root)
  const warnings: string[] = []

  let name: string | null = basename(root) || null
  let packageJson: PackageJson | null = null

  if (names.has("package.json")) {
    const content = await readText(join(root, "package.json"))

    try {
      packageJson = JSON.parse(content ?? "") as PackageJson
    } catch {
      warnings.push("package.json inválido: não foi possível ler nome, scripts e dependências.")
    }
  }

  if (packageJson && typeof packageJson.name === "string" && packageJson.name) {
    name = packageJson.name
  }

  const dependencies = {
    ...normalizeDependencies(packageJson?.dependencies),
    ...normalizeDependencies(packageJson?.devDependencies),
  }
  const scripts = normalizeScripts(packageJson?.scripts)
  const engines = normalizeEngines(packageJson?.engines)

  let language: string | null = null
  let framework: string | null = null
  let packageManager: string | null = null

  if (names.has("package.json")) {
    language = names.has("tsconfig.json") || "typescript" in dependencies
      ? "typescript"
      : "javascript"
    framework = pickFramework(dependencies)
    packageManager = await detectPackageManager(root)

    const declared = packageJson?.packageManager

    if (!packageManager && typeof declared === "string") {
      packageManager = declared.split("@")[0] ?? null
    }

    if (typeof declared === "string" && packageManager) {
      const declaredName = declared.split("@")[0]

      if (declaredName && declaredName !== packageManager) {
        warnings.push(
          `package.json declara ${declaredName}, mas o lockfile aponta ${packageManager}.`,
        )
      }
    }

    if (!packageManager) {
      warnings.push(
        "package.json sem lockfile: instalar dependências pode gerar versões diferentes.",
      )
    }
  } else if (
    names.has("pyproject.toml") ||
    names.has("requirements.txt") ||
    names.has("Pipfile")
  ) {
    language = "python"
    packageManager = await detectPythonManager(root)
  } else if (names.has("Cargo.toml")) {
    language = "rust"
    packageManager = "cargo"
  } else if (names.has("go.mod")) {
    language = "go"
    packageManager = "go"
  } else if (
    names.has("global.json") ||
    [...names].some((item) => item.endsWith(".sln") || item.endsWith(".csproj"))
  ) {
    language = "csharp"
    packageManager = "dotnet"
  } else if (names.has("pom.xml") || names.has("build.gradle") || names.has("build.gradle.kts")) {
    language = names.has("pom.xml") ? "java" : "kotlin"
    packageManager = names.has("pom.xml") ? "maven" : "gradle"
  } else if (names.has("Gemfile")) {
    language = "ruby"
    packageManager = "bundler"
  } else if (names.has("composer.json")) {
    language = "php"
    packageManager = "composer"
  }

  if (manifests.length === 0) {
    warnings.push("Nenhum manifesto de projeto reconhecido nesta pasta.")
  }

  const pinned = await readPinnedVersions(root, names, engines)
  const dependenciesState = await detectDependenciesInstalled(root, language)

  const runtimes = await getInstalledRuntimes()
  const installedIds = new Set(runtimes.map((item) => item.id))

  for (const warning of missingRuntimeWarnings(
    language,
    packageManager,
    installedIds,
    runtimes.length > 0,
  )) {
    warnings.push(warning)
  }

  if (dependenciesState.installed === false) {
    warnings.push(
      "Dependências ainda não instaladas: rode a instalação antes do build ou teste.",
    )
  }

  const nodePin = pinned.find((item) => item.tool === "node" || item.tool === "npm")

  if (nodePin) {
    const required = versionMajor(nodePin.version)
    const installed = versionMajor(await readVersion("node", ["--version"]))

    if (required && installed && installed < required) {
      warnings.push(
        `Node ${required} ou maior é exigido (${nodePin.source}); instalado: ${installed}.`,
      )
    }
  }

  return {
    ok: true,
    project: {
      root,
      name,
      stack: { language, framework, packageManager },
      manifests,
      scripts,
      engines,
      pinned,
      dependencies: dependenciesState,
      git: await detectGitState(root),
      entries: await listEntries(root),
      warnings,
    },
  }
}

export async function getGitStatus(
  input: DeviceCommandInputMap["git-status"],
  sandbox: FileSandbox,
): Promise<DeviceCommandSuccess> {
  const root = await resolveStart(input.path, sandbox)

  return {
    ok: true,
    gitStatus: await readGitStatus(root, input.includeUntracked),
  }
}

function truncateUtf8(value: string, maxBytes: number): string {
  const buffer = Buffer.from(value, "utf8")

  if (buffer.length <= maxBytes) {
    return value
  }

  return buffer.subarray(0, maxBytes).toString("utf8")
}

export async function getGitDiff(
  input: DeviceCommandInputMap["git-diff"],
  sandbox: FileSandbox,
): Promise<DeviceCommandSuccess> {
  const root = await resolveStart(input.path, sandbox)
  const git = await gitBinary()

  if (!git) {
    return { ok: true, gitDiff: null }
  }

  const repoRoot = await resolveGitRoot(git, root)

  if (!repoRoot) {
    return { ok: true, gitDiff: null }
  }

  const spec = input.file ? [toPosix(input.file)] : []
  const pathspec = spec.length > 0 ? ["--", ...spec] : []
  const base = [
    "diff",
    "--no-ext-diff",
    "--no-textconv",
    "--no-color",
    ...(input.staged ? ["--cached"] : []),
  ]

  const numstat = await runGit(git, repoRoot, [
    ...base,
    "--numstat",
    ...pathspec,
  ])

  if (numstat === null) {
    return { ok: true, gitDiff: null }
  }

  let filesChanged = 0
  let additions = 0
  let deletions = 0

  for (const line of numstat.split(/\r?\n/)) {
    if (!line.trim()) {
      continue
    }

    const [added, removed] = line.split("\t")

    filesChanged += 1

    if (added !== "-" && added) {
      additions += Number(added) || 0
    }

    if (removed !== "-" && removed) {
      deletions += Number(removed) || 0
    }
  }

  const patch = await runGit(git, repoRoot, [
    ...base,
    `--unified=${input.context}`,
    ...pathspec,
  ])

  if (patch === null) {
    return { ok: true, gitDiff: null }
  }

  const diff = truncateUtf8(patch, input.maxBytes)

  return {
    ok: true,
    gitDiff: {
      root: repoRoot,
      filesChanged,
      additions,
      deletions,
      diff,
      truncated: Buffer.byteLength(patch, "utf8") > input.maxBytes,
    },
  }
}
