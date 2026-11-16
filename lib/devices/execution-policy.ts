/**
 * Dois modos de sessão no chat. O "cérebro" fica no app; esta camada só decide
 * se uma tool pode rodar sozinha, se precisa de aprovação humana ou se é negada.
 *
 * - `plan` (Modo Leitura): apenas leitura. Qualquer ação que mude a máquina é
 *   negada e o usuário precisa trocar para o Modo Construtor.
 * - `build` (Modo Construtor): escreve, executa e controla a máquina. Ações
 *   destrutivas ou de sistema só rodam sozinhas quando o dispositivo foi
 *   configurado como "Poder Total"; caso contrário pedem uma aprovação no chat.
 */

import { homedir } from "node:os"
import { isAbsolute, resolve, sep } from "node:path"

export const CHAT_EXECUTION_MODES = ["plan", "build"] as const

export type ChatExecutionMode = (typeof CHAT_EXECUTION_MODES)[number]

const CHAT_EXECUTION_MODE_SET = new Set<string>(CHAT_EXECUTION_MODES)

export const DEFAULT_CHAT_EXECUTION_MODE: ChatExecutionMode = "plan"

export type DeviceExecutionPolicy = {
  /** `true` = ações destrutivas/de sistema pedem aprovação no chat. */
  confirmDestructive: boolean
  updatedAt?: string
}

export const DEFAULT_DEVICE_EXECUTION_POLICY: DeviceExecutionPolicy = {
  confirmDestructive: true,
}

export const DEVICE_TOOL_RISKS = [
  "read",
  "input",
  "write",
  "exec",
  "launch",
  "destructive",
  "system",
] as const

export type DeviceToolRisk = (typeof DEVICE_TOOL_RISKS)[number]

export function isChatExecutionMode(value: unknown): value is ChatExecutionMode {
  return typeof value === "string" && CHAT_EXECUTION_MODE_SET.has(value)
}

/**
 * Normaliza o JSON persistido. Qualquer valor desconhecido cai para o padrão
 * seguro (pedir confirmação) em vez de liberar ações destrutivas por acidente.
 */
export function parseDeviceExecutionPolicy(
  value: unknown,
): DeviceExecutionPolicy {
  if (value === null || value === undefined) {
    return { ...DEFAULT_DEVICE_EXECUTION_POLICY }
  }

  // Formato legado: string com o antigo nível de execução.
  if (typeof value === "string") {
    return { confirmDestructive: value !== "full" }
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    return { ...DEFAULT_DEVICE_EXECUTION_POLICY }
  }

  const record = value as Record<string, unknown>
  const confirmDestructive =
    typeof record.confirmDestructive === "boolean"
      ? record.confirmDestructive
      : record.level === "full"
        ? false
        : true

  return {
    confirmDestructive,
    ...(typeof record.updatedAt === "string"
      ? { updatedAt: record.updatedAt }
      : {}),
  }
}

export const EXECUTION_MODE_LABELS: Record<ChatExecutionMode, string> = {
  plan: "Leitura",
  build: "Construtor",
}

export const EXECUTION_MODE_DESCRIPTIONS: Record<ChatExecutionMode, string> = {
  plan: "Só leitura: consulta arquivos, janelas, tela e ambiente, sem alterar a máquina.",
  build:
    "Pode escrever, executar e controlar a máquina. Ações destrutivas seguem a configuração do dispositivo.",
}

export const DEVICE_CONFIRMATION_LABELS = {
  confirm: "Pedir confirmação",
  full: "Poder Total",
} as const

export const DEVICE_CONFIRMATION_DESCRIPTIONS = {
  confirm:
    "Escrita, execução e cliques rodam direto no Modo Construtor. Ações destrutivas ou de sistema pedem aprovação no chat.",
  full: "Ações destrutivas e de sistema rodam sem confirmação. O Modo Leitura continua bloqueando qualquer alteração.",
} as const

/** Diretório de referência do usuário: escrita fora dele é tratada como destrutiva. */
export const HOME_WORKSPACE = homedir()

/** True quando o caminho absoluto está fora do diretório de referência do usuário. */
export function isOutsideWorkspace(path: string): boolean {
  const absolute = isAbsolute(path) ? resolve(path) : resolve(HOME_WORKSPACE, path)
  const homeLower = HOME_WORKSPACE.toLowerCase()
  const targetLower = absolute.toLowerCase()

  return targetLower !== homeLower && !targetLower.startsWith(homeLower + sep)
}

/**
 * Extrai os caminhos de arquivo de uma tool de escrita, quando houver.
 * Retorna vazia quando não há caminho ou não se aplica.
 */
export function collectFilePaths(toolName: string, input: unknown): string[] {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return []
  }

  const record = input as Record<string, unknown>
  const paths: string[] = []

  const push = (value: unknown) => {
    if (typeof value === "string" && value.trim().length > 0) {
      paths.push(value.trim())
    }
  }

  const pushList = (value: unknown) => {
    if (!Array.isArray(value)) {
      return
    }

    for (const item of value) {
      if (typeof item === "string") {
        push(item)
        continue
      }

      if (typeof item === "object" && item !== null) {
        push((item as Record<string, unknown>).path)
      }
    }
  }

  if (toolName === "device-copy" || toolName === "device-move") {
    push(record.from)
    push(record.to)
  } else {
    push(record.path)
    pushList(record.files)
    pushList(record.paths)
  }

  return paths
}

const READ_TOOLS = new Set<string>([
  "device-list",
  "device-online-list",
  "device-list-apps",
  "device-find-app",
  "device-get-os",
  "device-get-env",
  "device-env",
  "device-read-clipboard",
  "device-list-files",
  "device-read-file",
  "device-read-files",
  "device-project-info",
  "device-git-status",
  "device-git-diff",
  "device-glob",
  "device-grep",
  "device-stat",
  "device-check-admin",
  "device-list-windows",
  "device-inspect-ui",
  "device-screenshot",
  "device-job-status",
  "device-job-output",
  "device-job-list",
  "device-list-processes",
  "device-get-system-status",
])

const INPUT_TOOLS = new Set<string>([
  "device-type-text",
  "device-press-key",
  "device-move-mouse",
  "device-click",
  "device-scroll",
  "device-drag",
  "device-open-url",
  "device-set-volume",
  "device-set-brightness",
  "device-media-control",
  "device-open-path",
  "device-focus-window",
  "device-minimize-window",
  "device-maximize-window",
  "device-restore-window",
  "device-ui-action",
  "device-job-cancel",
])

const WRITE_TOOLS = new Set<string>([
  "device-write-clipboard",
  "device-write-file",
  "device-write-files",
  "device-edit-file",
  "device-mkdir",
  "device-copy",
  "device-move",
  "device-apply-patch",
  "device-register-app",
  "device-remove-app",
])

/** Tools que gravam arquivos no disco: escrita fora do home vira destrutiva. */
const FILE_WRITE_TOOLS = new Set<string>([
  "device-write-file",
  "device-write-files",
  "device-edit-file",
  "device-mkdir",
  "device-copy",
  "device-move",
  "device-apply-patch",
])

const EXEC_TOOLS = new Set<string>([
  "device-run-command",
  "device-shell",
  "device-job-start",
])

const DESTRUCTIVE_TOOLS = new Set<string>([
  "device-close-window",
  "device-delete",
  "device-kill-process",
  "device-lock-screen",
])

const SYSTEM_TOOLS = new Set<string>(["device-power"])

const SYSTEM_COMMAND_PATTERNS: RegExp[] = [
  /\bshutdown\b/i,
  /\brestart-computer\b/i,
  /\bstop-computer\b/i,
  /\blogoff\b/i,
  /\bexitwindows(ex)?\b/i,
  /\bbcdedit\b/i,
  /\bdiskpart\b/i,
  /\bformat-volume\b/i,
  /\bformat\s+[a-z]:/i,
  /\breg\s+delete\b/i,
  /\bnet\s+user\b/i,
  /\bnet\s+localgroup\b/i,
  /\bnew-localuser\b/i,
  /\bset-executionpolicy\b/i,
  /\bsc\s+(delete|config)\b/i,
  /\bstop-service\b/i,
  /\bdisable-windowsoptionalfeature\b/i,
  /\bvssadmin\s+delete\b/i,
  /\bwbadmin\s+delete\b/i,
  /\bcipher\s+\/w/i,
  /\bstart-process\b[^\n]*\s-verb\s+runas\b/i,
  /\b(set|change)\s+.*\bpassword\b/i,
  /\bpasswd\b/i,
  /\bsudo\b/i,
  /\bdoas\b/i,
  /\bchmod\s+(-r\s+)?777\s+\//i,
]

const DESTRUCTIVE_COMMAND_PATTERNS: RegExp[] = [
  /\brm\s+-[a-z]*r[a-z]*f[a-z]*\b/i,
  /\brm\s+-[a-z]*f[a-z]*r[a-z]*\b/i,
  /\bremove-item\b[^\n]*(-recurse|-force)/i,
  /\bdel\s+\/[a-z]*[sqf]/i,
  /\b(rmdir|rd)\s+\/[sq]/i,
  /\bgit\s+reset\s+--hard\b/i,
  /\bgit\s+clean\s+-[a-z]*[fdx]/i,
  /\bgit\s+push\b[^\n]*--force\b/i,
  /\bgit\s+push\b[^\n]*\s-f(\s|$)/i,
  /\bclear-content\b/i,
  /\btruncate\b/i,
  /\bstop-process\b/i,
  /\btaskkill\b/i,
  /\bkill(all)?\b/i,
  /\bpkill\b/i,
  /\b(drop|truncate)\s+table\b/i,
  /\bdelete\s+from\b/i,
  /\bnpm\s+publish\b/i,
]

/**
 * Scripts que iniciam outro aplicativo. O `open-app` com argumentos já é
 * `launch`; sem estes padrões, o mesmo lançamento via `device-shell` rodaria
 * como `exec` e contornaria a aprovação. É heurística: entradas indiretas
 * (`cmd /c start`, `Invoke-Expression`, `schtasks`) ainda não são cobertas.
 */
const LAUNCH_COMMAND_PATTERNS: RegExp[] = [
  /\bstart-process\b/i,
  /(?:^|[;&|]\s*)start(?:\s|$)/im,
  /\bxdg-open\b/i,
  /\bexplorer(?:\.exe)?\s+[^\n]/i,
  /(?:^|[;&|]\s*)open\s+-[a-zA-Z-]+\s+/im,
  /(?:^|[;&|]\s*)open\s+(?:["'~./\\]|https?:\/\/)/im,
  /^\s*&\s*["']?[a-z]:\\[^\n]*\.(?:exe|com|bat|cmd|lnk|msc)["']?/im,
  /(?:^|[;&|]\s*)["']?[a-z]:\\[^\n]*\.(?:exe|com|bat|cmd|lnk|msc)["']?(?:\s|$)/im,
]

function collectCommandText(toolName: string, input: unknown): string {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return ""
  }

  const record = input as Record<string, unknown>

  if (toolName === "device-shell") {
    return typeof record.script === "string" ? record.script : ""
  }

  if (toolName === "device-run-command") {
    const command = typeof record.command === "string" ? record.command : ""
    const args = Array.isArray(record.args)
      ? record.args.filter((item): item is string => typeof item === "string")
      : []

    return [command, ...args].join(" ")
  }

  if (toolName === "device-open-app") {
    const target =
      typeof record.path === "string"
        ? record.path
        : typeof record.appId === "string"
          ? record.appId
          : ""
    const args = Array.isArray(record.args)
      ? record.args.filter((item): item is string => typeof item === "string")
      : []

    return [target, ...args].join(" ")
  }

  return ""
}

function matchesAny(patterns: readonly RegExp[], text: string): boolean {
  return patterns.some((pattern) => pattern.test(text))
}

/**
 * Classifica a tool em risco. Retorna `null` para tools que não são de
 * dispositivo, para o `toolApproval` deixá-las em paz.
 */
export function classifyDeviceToolRisk(
  toolName: string,
  input: unknown,
): DeviceToolRisk | null {
  if (!toolName.startsWith("device-")) {
    return null
  }

  if (READ_TOOLS.has(toolName)) {
    return "read"
  }

  if (toolName === "device-open-app") {
    const text = collectCommandText(toolName, input)
    const record =
      typeof input === "object" && input !== null && !Array.isArray(input)
        ? (input as Record<string, unknown>)
        : {}
    const args = Array.isArray(record.args) ? record.args : []
    const hasCwd =
      typeof record.cwd === "string" && record.cwd.trim().length > 0

    if (matchesAny(SYSTEM_COMMAND_PATTERNS, text)) {
      return "system"
    }

    if (matchesAny(DESTRUCTIVE_COMMAND_PATTERNS, text)) {
      return "destructive"
    }

    // Sem argumentos é só abrir o app; com argumentos o app passa a executar
    // algo em nome do modelo, então pede aprovação como qualquer launch.
    return args.length > 0 || hasCwd ? "launch" : "input"
  }

  if (INPUT_TOOLS.has(toolName)) {
    return "input"
  }

  if (FILE_WRITE_TOOLS.has(toolName)) {
    // Escrita fora do diretorio de referencia do usuario eh tratada como
    // destrutiva: pede aprovacao (salvo Poder Total).
    const paths = collectFilePaths(toolName, input)

    if (paths.length > 0 && paths.some((p) => isOutsideWorkspace(p))) {
      return "destructive"
    }

    return "write"
  }

  if (WRITE_TOOLS.has(toolName)) {
    return "write"
  }

  if (DESTRUCTIVE_TOOLS.has(toolName)) {
    return "destructive"
  }

  if (SYSTEM_TOOLS.has(toolName)) {
    return "system"
  }

  if (toolName === "device-window-action") {
    const action =
      typeof input === "object" && input !== null
        ? (input as Record<string, unknown>).action
        : undefined

    return action === "close" ? "destructive" : "input"
  }

  if (EXEC_TOOLS.has(toolName)) {
    const text = collectCommandText(toolName, input)

    if (matchesAny(SYSTEM_COMMAND_PATTERNS, text)) {
      return "system"
    }

    if (matchesAny(DESTRUCTIVE_COMMAND_PATTERNS, text)) {
      return "destructive"
    }

    if (matchesAny(LAUNCH_COMMAND_PATTERNS, text)) {
      return "launch"
    }

    return "exec"
  }

  // Tool de dispositivo desconhecida: trata como escrita para não abrir
  // permissão por engano quando uma tool nova for adicionada.
  return "write"
}

export type DeviceToolDecision =
  | { action: "allow" }
  | { action: "deny"; reason: string }
  | { action: "approval"; reason: string }

const RISK_LABELS: Record<DeviceToolRisk, string> = {
  read: "leitura",
  input: "interação",
  write: "escrita",
  exec: "execução",
  launch: "abertura com argumentos",
  destructive: "destrutiva",
  system: "de sistema",
}

export function describeDeviceToolRisk(risk: DeviceToolRisk): string {
  return RISK_LABELS[risk]
}

/**
 * Decide o destino de uma chamada. A ordem importa: leitura sempre passa,
 * depois o modo da sessão, depois a configuração do dispositivo para ações
 * irreversíveis.
 */
export function evaluateDeviceToolCall({
  policy,
  mode,
  risk,
}: {
  policy: DeviceExecutionPolicy
  mode: ChatExecutionMode
  risk: DeviceToolRisk
}): DeviceToolDecision {
  if (risk === "read") {
    return { action: "allow" }
  }

  if (mode === "plan") {
    return {
      action: "deny",
      reason:
        "O Modo Leitura só consulta. Troque para o Modo Construtor (Shift+Tab) para executar esta ação.",
    }
  }

  if (
    policy.confirmDestructive &&
    (risk === "destructive" || risk === "system" || risk === "launch")
  ) {
    return {
      action: "approval",
      reason:
        risk === "system"
          ? "Ação de sistema (energia, contas, serviços ou segurança). Confirme antes de aplicar."
          : risk === "launch"
            ? "O aplicativo vai receber argumentos ou diretório de trabalho. Confirme para abrir."
            : "Ação potencialmente destrutiva (apaga, encerra processo ou descarta alterações). Confirme antes de aplicar.",
    }
  }

  return { action: "allow" }
}
