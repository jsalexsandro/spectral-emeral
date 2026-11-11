/**
 * Política de execução por dispositivo (teto persistente) e modo por sessão
 * (escolhido no chat). O "cérebro" fica no app; esta camada só decide se uma
 * tool pode rodar sozinha, se precisa de aprovação humana ou se é negada.
 *
 * Regra de ouro: o modo da sessão nunca ultrapassa o teto do dispositivo.
 */

export const DEVICE_EXECUTION_LEVELS = ["read-only", "trusted", "full"] as const

export type DeviceExecutionLevel = (typeof DEVICE_EXECUTION_LEVELS)[number]

const DEVICE_EXECUTION_LEVEL_SET = new Set<string>(DEVICE_EXECUTION_LEVELS)

export const CHAT_EXECUTION_MODES = ["ask", "auto", "full"] as const

export type ChatExecutionMode = (typeof CHAT_EXECUTION_MODES)[number]

const CHAT_EXECUTION_MODE_SET = new Set<string>(CHAT_EXECUTION_MODES)

export type DeviceExecutionPolicy = {
  level: DeviceExecutionLevel
  updatedAt?: string
}

export const DEFAULT_DEVICE_EXECUTION_POLICY: DeviceExecutionPolicy = {
  level: "read-only",
}

export const DEFAULT_CHAT_EXECUTION_MODE: ChatExecutionMode = "ask"

export const DEVICE_TOOL_RISKS = [
  "read",
  "input",
  "write",
  "exec",
  "destructive",
  "system",
] as const

export type DeviceToolRisk = (typeof DEVICE_TOOL_RISKS)[number]

export function isDeviceExecutionLevel(
  value: unknown,
): value is DeviceExecutionLevel {
  return typeof value === "string" && DEVICE_EXECUTION_LEVEL_SET.has(value)
}

export function isChatExecutionMode(value: unknown): value is ChatExecutionMode {
  return typeof value === "string" && CHAT_EXECUTION_MODE_SET.has(value)
}

/**
 * Normaliza o JSON persistido. Qualquer valor desconhecido cai para o padrão
 * seguro (`read-only`) em vez de abrir permissões por acidente.
 */
export function parseDeviceExecutionPolicy(
  value: unknown,
): DeviceExecutionPolicy {
  if (value === null || value === undefined) {
    return { ...DEFAULT_DEVICE_EXECUTION_POLICY }
  }

  if (typeof value === "string" && isDeviceExecutionLevel(value)) {
    return { level: value }
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    return { ...DEFAULT_DEVICE_EXECUTION_POLICY }
  }

  const record = value as Record<string, unknown>
  const level = isDeviceExecutionLevel(record.level)
    ? record.level
    : DEFAULT_DEVICE_EXECUTION_POLICY.level

  return {
    level,
    ...(typeof record.updatedAt === "string"
      ? { updatedAt: record.updatedAt }
      : {}),
  }
}

export const EXECUTION_LEVEL_LABELS: Record<DeviceExecutionLevel, string> = {
  "read-only": "Somente leitura",
  trusted: "Confiável",
  full: "Completo",
}

export const EXECUTION_LEVEL_DESCRIPTIONS: Record<DeviceExecutionLevel, string> = {
  "read-only":
    "Lê arquivos, ambiente e janelas. Não executa comandos, não escreve arquivos e não controla mouse/teclado.",
  trusted:
    "Executa comandos e escreve arquivos, mas ações de risco pedem aprovação no chat. Ações destrutivas sempre pedem.",
  full: "Executa qualquer ação aprovada no chat, inclusive destrutivas. Use apenas em máquinas dedicadas.",
}

export const EXECUTION_MODE_LABELS: Record<ChatExecutionMode, string> = {
  ask: "Perguntar",
  auto: "Automático",
  full: "Sem atrito",
}

export const EXECUTION_MODE_DESCRIPTIONS: Record<ChatExecutionMode, string> = {
  ask: "Toda ação que muda o computador pede sua aprovação.",
  auto:
    "Ações de escrita e execução rodam sozinhas dentro do teto do dispositivo; destrutivas ainda pedem.",
  full:
    "Aprova tudo o que o teto do dispositivo permitir, sem pedir confirmação a cada ação.",
}

const READ_TOOLS = new Set<string>([
  "device-list",
  "device-online-list",
  "device-list-apps",
  "device-get-os",
  "device-get-env",
  "device-env",
  "device-read-clipboard",
  "device-list-files",
  "device-read-file",
  "device-glob",
  "device-grep",
  "device-check-admin",
  "device-list-windows",
  "device-inspect-ui",
  "device-screenshot",
])

const INPUT_TOOLS = new Set<string>([
  "device-type-text",
  "device-press-key",
  "device-move-mouse",
  "device-click",
  "device-scroll",
  "device-drag",
  "device-open-url",
  "device-open-app",
  "device-focus-window",
  "device-minimize-window",
  "device-maximize-window",
  "device-restore-window",
  "device-ui-action",
])

const WRITE_TOOLS = new Set<string>([
  "device-write-clipboard",
  "device-write-file",
  "device-edit-file",
])

const EXEC_TOOLS = new Set<string>([
  "device-run-command",
  "device-shell",
])

const DESTRUCTIVE_TOOLS = new Set<string>(["device-close-window"])

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
  /\bstart-process\b[^\n]*\b-verb\s+runas\b/i,
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

  if (INPUT_TOOLS.has(toolName)) {
    return "input"
  }

  if (WRITE_TOOLS.has(toolName)) {
    return "write"
  }

  if (DESTRUCTIVE_TOOLS.has(toolName)) {
    return "destructive"
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
  destructive: "destrutiva",
  system: "de sistema",
}

export function describeDeviceToolRisk(risk: DeviceToolRisk): string {
  return RISK_LABELS[risk]
}

/**
 * Decide o destino de uma chamada. A ordem importa: primeiro o teto do
 * dispositivo, depois o modo da sessão, depois o risco.
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

  if (policy.level === "read-only") {
    return {
      action: "deny",
      reason:
        "Este dispositivo está configurado como somente leitura. Peça ao usuário para elevar o nível de execução em Configurações → Dispositivos.",
    }
  }

  if (risk === "system") {
    if (policy.level === "full" && mode === "full") {
      return { action: "allow" }
    }

    return {
      action: "approval",
      reason:
        "Ação de sistema (energia, contas, serviços ou segurança). Confirme antes de aplicar.",
    }
  }

  if (risk === "destructive") {
    if (policy.level === "full" && mode !== "ask") {
      return { action: "allow" }
    }

    return {
      action: "approval",
      reason:
        "Ação potencialmente destrutiva (apaga, encerra processo ou descarta alterações). Confirme antes de aplicar.",
    }
  }

  if (mode === "ask") {
    return {
      action: "approval",
      reason: `Ação de ${describeDeviceToolRisk(risk)} no dispositivo. Confirme antes de aplicar.`,
    }
  }

  return { action: "allow" }
}
