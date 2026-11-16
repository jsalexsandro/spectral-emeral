import { readFile } from "node:fs/promises"
import { basename, join } from "node:path"
import { minimatch } from "minimatch"

const IS_WINDOWS = process.platform === "win32"

/**
 * Regra de `.gitignore` já normalizada.
 *
 * `base` é o diretório da regra relativo à raiz da listagem (posix, "" na
 * raiz). Padrões com `/` no meio são ancorados nesse diretório; os demais
 * valem para qualquer nível (`*.log`, `node_modules`).
 */
export type GitignoreRule = {
  base: string
  pattern: string
  anchored: boolean
  dirOnly: boolean
  negate: boolean
}

function normalizeBase(value: string): string {
  return value
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/^\/+|\/+$/g, "")
}

function toPosix(value: string): string {
  return value.replace(/\\/g, "/")
}

/**
 * Converte o conteúdo de um `.gitignore` em regras. Implementa o subconjunto
 * que o driver usa: comentários, negação, âncora, `dir/`, `*`, `**` e `?`.
 * Escapes de espaço no fim da linha são tratados como espaço comum.
 */
export function parseGitignore(
  content: string,
  base = "",
): GitignoreRule[] {
  const normalizedBase = normalizeBase(base)
  const rules: GitignoreRule[] = []

  for (const rawLine of content.split(/\r?\n/)) {
    let line = rawLine.trimEnd()

    if (line.length === 0 || line.startsWith("#")) {
      continue
    }

    let negate = false

    if (line.startsWith("!")) {
      negate = true
      line = line.slice(1)
    }

    if (line.startsWith("\\#") || line.startsWith("\\!")) {
      line = line.slice(1)
    }

    let dirOnly = false

    if (line.endsWith("/")) {
      dirOnly = true
      line = line.slice(0, -1)
    }

    let anchored = false

    if (line.startsWith("/")) {
      anchored = true
      line = line.slice(1)
    }

    if (line.length === 0) {
      continue
    }

    rules.push({
      base: normalizedBase,
      pattern: line,
      anchored: anchored || line.includes("/"),
      dirOnly,
      negate,
    })
  }

  return rules
}

/** Lê o `.gitignore` de um diretório. Ausência ou erro devolve lista vazia. */
export async function readGitignoreRules(
  directory: string,
  base: string,
): Promise<GitignoreRule[]> {
  try {
    const content = await readFile(join(directory, ".gitignore"), "utf8")

    return parseGitignore(content, base)
  } catch {
    return []
  }
}

function relativeToBase(path: string, base: string): string | null {
  if (base.length === 0) {
    return path
  }

  if (path === base) {
    return ""
  }

  if (!path.startsWith(`${base}/`)) {
    return null
  }

  return path.slice(base.length + 1)
}

/**
 * Aplica as regras na ordem em que aparecem (a última que casa vence), como o
 * git. Recebe o caminho relativo à raiz da listagem, em formato posix.
 */
export function isGitignored(
  path: string,
  isDirectory: boolean,
  rules: readonly GitignoreRule[],
): boolean {
  const normalized = toPosix(path).replace(/^\/+/, "")
  let ignored = false

  for (const rule of rules) {
    if (rule.dirOnly && !isDirectory) {
      continue
    }

    const relative = relativeToBase(normalized, rule.base)

    if (relative === null || relative.length === 0) {
      continue
    }

    const candidate = rule.anchored ? relative : basename(relative)

    if (
      minimatch(candidate, rule.pattern, {
        dot: true,
        nocase: IS_WINDOWS,
        nocomment: true,
      })
    ) {
      ignored = !rule.negate
    }
  }

  return ignored
}
