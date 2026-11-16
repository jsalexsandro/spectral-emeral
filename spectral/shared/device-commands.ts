export const DEVICE_COMMAND_NAMES = [
  "open-url",
  "open-app",
  "open-path",
  "register-app",
  "remove-app",
  "list-apps",
  "find-app",
  "get-os",
  "get-env",
  "shell",
  "type-text",
  "press-key",
  "read-clipboard",
  "write-clipboard",
  "move-mouse",
  "click",
  "scroll",
  "drag",
  "inspect-ui",
  "ui-action",
  "list-files",
  "read-file",
  "read-files",
  "glob",
  "grep",
  "check-admin",
  "write-file",
  "write-files",
  "edit-file",
  "mkdir",
  "stat",
  "copy",
  "move",
  "delete",
  "apply-patch",
  "run-command",
  "job-start",
  "job-status",
  "job-output",
  "job-cancel",
  "job-list",
  "screenshot",
  "list-windows",
  "focus-window",
  "minimize-window",
  "maximize-window",
  "restore-window",
  "close-window",
  "list-processes",
  "kill-process",
  "get-system-status",
  "set-volume",
  "set-brightness",
  "lock-screen",
  "power",
  "media-control",
] as const

export type DeviceCommandName = (typeof DEVICE_COMMAND_NAMES)[number]

const DEVICE_COMMAND_NAME_SET = new Set<string>(DEVICE_COMMAND_NAMES)

export const DEVICE_KEY_MODIFIERS = ["ctrl", "alt", "shift", "meta"] as const

export type DeviceKeyModifier = (typeof DEVICE_KEY_MODIFIERS)[number]

const DEVICE_KEY_MODIFIER_SET = new Set<string>(DEVICE_KEY_MODIFIERS)

const DEVICE_LETTER_KEYS = [
  "a",
  "b",
  "c",
  "d",
  "e",
  "f",
  "g",
  "h",
  "i",
  "j",
  "k",
  "l",
  "m",
  "n",
  "o",
  "p",
  "q",
  "r",
  "s",
  "t",
  "u",
  "v",
  "w",
  "x",
  "y",
  "z",
] as const

const DEVICE_DIGIT_KEYS = [
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
] as const

export const DEVICE_KEYS = [
  ...DEVICE_LETTER_KEYS,
  ...DEVICE_DIGIT_KEYS,
  "enter",
  "tab",
  "escape",
  "backspace",
  "delete",
  "space",
  "insert",
  "arrowup",
  "arrowdown",
  "arrowleft",
  "arrowright",
  "home",
  "end",
  "pageup",
  "pagedown",
  "f1",
  "f2",
  "f3",
  "f4",
  "f5",
  "f6",
  "f7",
  "f8",
  "f9",
  "f10",
  "f11",
  "f12",
] as const

export type DeviceKey = (typeof DEVICE_KEYS)[number]

const DEVICE_KEY_SET = new Set<string>(DEVICE_KEYS)

export const DEVICE_URL_MAX_LENGTH = 2048
export const DEVICE_TEXT_MAX_LENGTH = 2000
export const DEVICE_CLIPBOARD_TEXT_MAX_LENGTH = 100_000
export const DEVICE_MOUSE_COORD_MIN = -100_000
export const DEVICE_MOUSE_COORD_MAX = 100_000
export const DEVICE_MOUSE_BUTTONS = ["left", "right", "middle"] as const
export const DEVICE_MOUSE_CLICK_COUNT_MIN = 1
export const DEVICE_MOUSE_CLICK_COUNT_MAX = 3
export const DEVICE_MOUSE_CLICK_COUNT_DEFAULT = 1
export const DEVICE_MOUSE_SCROLL_DIRECTIONS = [
  "up",
  "down",
  "left",
  "right",
] as const
export const DEVICE_MOUSE_SCROLL_AMOUNT_MIN = 1
export const DEVICE_MOUSE_SCROLL_AMOUNT_MAX = 50
export const DEVICE_MOUSE_SCROLL_AMOUNT_DEFAULT = 3
export const DEVICE_MOUSE_DRAG_DURATION_MIN_MS = 100
export const DEVICE_MOUSE_DRAG_DURATION_MAX_MS = 10_000
export const DEVICE_MOUSE_DRAG_DURATION_DEFAULT_MS = 500
export const DEVICE_WINDOW_ID_MAX_LENGTH = 128
export const DEVICE_WINDOW_TITLE_MAX_LENGTH = 120
export const DEVICE_WINDOW_PROCESS_NAME_MAX_LENGTH = 80
export const DEVICE_WINDOW_LIMIT_MIN = 1
export const DEVICE_WINDOW_LIMIT_MAX = 30
export const DEVICE_WINDOW_LIMIT_DEFAULT = 20
export const DEVICE_WINDOW_ID_PATTERN = /^[A-Za-z0-9:._-]{1,128}$/

export const DEVICE_WINDOW_ACTIONS = [
  "minimize",
  "maximize",
  "restore",
  "close",
] as const

export type DeviceWindowAction = (typeof DEVICE_WINDOW_ACTIONS)[number]

export const DEVICE_PROCESS_QUERY_MAX_LENGTH = 120
export const DEVICE_PROCESS_COMMAND_MAX_LENGTH = 512
export const DEVICE_PROCESS_LIMIT_MIN = 1
export const DEVICE_PROCESS_LIMIT_MAX = 100
export const DEVICE_PROCESS_LIMIT_DEFAULT = 40

/** Processo retornado por `list-processes`. */
export type DeviceProcessInfo = {
  pid: number
  parentPid: number
  name: string
  command: string | null
  memoryBytes: number | null
  startedAt: string | null
  sessionId: number | null
}

/** Estado do sistema retornado por `get-system-status`. */
export type DeviceSystemStatus = {
  volume: number | null
  muted: boolean | null
  brightness: number | null
  battery: {
    percent: number | null
    charging: boolean | null
    acConnected: boolean | null
  } | null
}

/** Resultado de `set-volume`. `requested` é o que se pediu; `applied` é o que o driver confirmou. */
export type DeviceVolumeResult = {
  volume: number
  muted: boolean
}

/** Resultado de `set-brightness`. `null` quando o painel não expõe brilho controlável. */
export type DeviceBrightnessResult = {
  brightness: number | null
}

/** Resultado de `power`. */
export type DevicePowerResult = {
  action: "sleep" | "shutdown" | "restart" | "cancel"
  delaySec: number | null
  cancelled: boolean | null
}

/** Resultado de `media-control`. */
export type DeviceMediaControlResult = {
  action: "play-pause" | "next" | "previous" | "stop"
}

type DevicePowerAction = "sleep" | "shutdown" | "restart" | "cancel"
type DeviceMediaControlAction =
  | "play-pause"
  | "next"
  | "previous"
  | "stop"

export const DEVICE_UI_ACTIONS = [
  "invoke",
  "select",
  "toggle",
  "expand",
  "collapse",
  "focus",
  "setValue",
] as const

export type DeviceUiAction = (typeof DEVICE_UI_ACTIONS)[number]

const DEVICE_UI_ACTION_SET = new Set<string>(DEVICE_UI_ACTIONS)

export const DEVICE_UI_FIND_MAX_LENGTH = 120
export const DEVICE_UI_ROLE_MAX_LENGTH = 40
export const DEVICE_UI_ROLE_PATTERN = /^[A-Za-z][A-Za-z0-9]{0,39}$/
export const DEVICE_UI_RUNTIME_ID_MAX_LENGTH = 256
export const DEVICE_UI_RUNTIME_ID_PATTERN = /^[0-9]+(?:\.[0-9]+)*$/
export const DEVICE_UI_RESULTS_MIN = 1
export const DEVICE_UI_RESULTS_MAX = 100
export const DEVICE_UI_RESULTS_DEFAULT = 40
export const DEVICE_UI_DEPTH_MIN = 1
export const DEVICE_UI_DEPTH_MAX = 12
export const DEVICE_UI_DEPTH_DEFAULT = 10
export const DEVICE_UI_WAIT_MIN_MS = 0
export const DEVICE_UI_WAIT_MAX_MS = 10_000
export const DEVICE_UI_WAIT_DEFAULT_MS = 1_500
export const DEVICE_UI_VALUE_MAX_LENGTH = 4_096

export type DeviceMouseButton = (typeof DEVICE_MOUSE_BUTTONS)[number]
export type DeviceMouseScrollDirection =
  (typeof DEVICE_MOUSE_SCROLL_DIRECTIONS)[number]

export const DEVICE_APP_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,39}$/
export const DEVICE_APP_QUERY_MAX_LENGTH = 120
export const DEVICE_APP_RESULTS_MAX = 200
export const DEVICE_APP_RESULTS_DEFAULT = 50
export const DEVICE_APP_ARGS_MAX = 32
export const DEVICE_APP_ARG_MAX_LENGTH = 512
export const DEVICE_APP_NAME_MAX_LENGTH = 120

/**
 * Verificação de abertura de app: o driver considera que o app abriu quando
 * surge uma janela nova não minimizada dentro desse prazo.
 */
export const DEVICE_APP_VERIFY_WAIT_MS = 3_000
export const DEVICE_APP_VERIFY_POLL_MS = 500

/**
 * Detecta um AUMID da Windows Store (`PackageFamilyName!AppId`, ex.: `SpotifyAB.SpotifyMusic_zpdnekdrzrea0!Spotify`): contém `!` e não é um caminho de arquivo (não começa com letra de drive, barra ou barra invertida).
 */
export function isStoreAppTarget(target: string): boolean {
  if (!target.includes("!")) {
    return false
  }

  return !/^[a-zA-Z]:[\\/]|^[\\/]|^~[\\/]/.test(target)
}

/**
 * Extensões que o driver aceita abrir por caminho absoluto. A lista evita que
 * um caminho arbitrário vire execução de script sem extensão ou documento
 * inesperado; apps personalizados usam .exe ou .lnk na prática.
 */
export const DEVICE_APP_PATH_EXTENSIONS = [
  ".exe",
  ".cmd",
  ".bat",
  ".com",
  ".lnk",
  ".msc",
  ".appref-ms",
  ".app",
] as const

/**
 * Caminho absoluto aceito em `open-app`: drive do Windows, UNC, POSIX ou `~`.
 * A validação final (existência e extensão) fica no driver.
 */
export function isAbsoluteAppPath(value: string): boolean {
  if (value.length === 0 || value.length > DEVICE_PATH_MAX_LENGTH) {
    return false
  }

  return (
    /^[a-zA-Z]:[\\/]/.test(value) ||
    /^\\\\[^\\]+\\/.test(value) ||
    value.startsWith("/") ||
    /^~[\\/]/.test(value)
  )
}

/**
 * Extensões que o `open-path` recusa. O handler padrão do sistema executa
 * scripts, instaladores e documentos com macro ao "abrir" esses tipos, então
 * eles não podem passar por um comando que não pede aprovação.
 */
export const DEVICE_OPEN_PATH_BLOCKED_EXTENSIONS = [
  // Executáveis e atalhos
  ".exe",
  ".com",
  ".scr",
  ".pif",
  ".cpl",
  ".msc",
  ".lnk",
  ".appref-ms",
  ".app",
  ".gadget",
  // Scripts
  ".bat",
  ".cmd",
  ".vbs",
  ".vbe",
  ".js",
  ".jse",
  ".wsf",
  ".wsh",
  ".hta",
  ".ps1",
  ".psm1",
  ".psd1",
  ".py",
  ".pyw",
  ".jar",
  ".sh",
  ".bash",
  ".zsh",
  ".command",
  ".run",
  // Instaladores e pacotes
  ".msi",
  ".msp",
  ".mst",
  ".msix",
  ".appx",
  ".appxbundle",
  ".msixbundle",
  // Registro e handlers
  ".reg",
  ".inf",
  ".url",
  ".scf",
  ".application",
  ".chm",
  // Documentos com macro
  ".docm",
  ".xlsm",
  ".pptm",
] as const

/** O caminho aponta para um tipo que o `open-app` sabe executar? */
export function hasAppPathExtension(value: string): boolean {
  const lower = value.toLowerCase()

  return DEVICE_APP_PATH_EXTENSIONS.some((extension) =>
    lower.endsWith(extension),
  )
}

/** O `open-path` recusaria este caminho por poder executar código? */
export function hasBlockedOpenPathExtension(value: string): boolean {
  const lower = value.toLowerCase()

  return DEVICE_OPEN_PATH_BLOCKED_EXTENSIONS.some((extension) =>
    lower.endsWith(extension),
  )
}

/** Deriva um id estável e compatível com DEVICE_APP_ID_PATTERN. */
export function deviceAppIdFromTarget(name: string, target: string): string {
  const slug =
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 28) || "app"

  const normalizedTarget = target.toLowerCase()
  let hash = 0x811c9dc5

  for (let index = 0; index < normalizedTarget.length; index += 1) {
    hash ^= normalizedTarget.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }

  return `${slug}-${hash.toString(16).padStart(8, "0").slice(0, 6)}`
}
export const DEVICE_COMMAND_TIMEOUT_MIN_MS = 1_000
export const DEVICE_COMMAND_TIMEOUT_MAX_MS = 60_000
export const DEVICE_COMMAND_TIMEOUT_DEFAULT_MS = 15_000
export const DEVICE_PATH_MAX_LENGTH = 1024
export const DEVICE_PATTERN_MAX_LENGTH = 256
export const DEVICE_FILE_DEPTH_MIN = 1
export const DEVICE_FILE_DEPTH_MAX = 3
export const DEVICE_FILE_DEPTH_DEFAULT = 1
export const DEVICE_FILE_ENTRIES_MIN = 1
export const DEVICE_FILE_ENTRIES_MAX = 500
export const DEVICE_FILE_ENTRIES_DEFAULT = 200
export const DEVICE_FILE_RESULTS_MIN = 1
export const DEVICE_FILE_RESULTS_MAX = 200
export const DEVICE_FILE_RESULTS_DEFAULT = 100
export const DEVICE_FILE_READ_OFFSET_MIN = 1
export const DEVICE_FILE_READ_OFFSET_MAX = 1_000_000
export const DEVICE_FILE_READ_OFFSET_DEFAULT = 1
export const DEVICE_FILE_READ_LINES_MIN = 1
export const DEVICE_FILE_READ_LINES_MAX = 2000
export const DEVICE_FILE_READ_LINES_DEFAULT = 2000
export const DEVICE_FILE_WRITE_MAX_BYTES = 1024 * 1024
export const DEVICE_FILES_BATCH_MAX = 20
export const DEVICE_READ_FILES_TOTAL_BYTES_MAX = 256 * 1024
export const DEVICE_WRITE_FILES_TOTAL_BYTES_MAX = 2 * 1024 * 1024
export const DEVICE_FILE_EDIT_MAX_BYTES = 1024 * 1024
export const DEVICE_FILE_EDIT_MAX_OLD_TEXT = 10 * 1024
export const DEVICE_FILE_EDIT_MAX_NEW_TEXT = 10 * 1024
export const DEVICE_FILE_PATCH_MAX_COUNT = 10
export const DEVICE_FILE_PATCH_MAX_BYTES = 1024 * 1024
export const DEVICE_RUN_TIMEOUT_DEFAULT_MS = 15_000
export const DEVICE_RUN_TIMEOUT_MAX_MS = 60_000
export const DEVICE_RUN_OUTPUT_MAX_BYTES = 64 * 1024
export const DEVICE_RUN_ARGS_MAX_LENGTH = 1024

/**
 * Shell é a primitiva central do plano de execução. O script sempre roda a
 * partir de um arquivo temporário; nunca é interpolado numa linha de comando.
 * O teto de saída fica abaixo do `maxPayload` do WebSocket (4 MB) para não
 * quebrar o transporte quando stdout e stderr vêm cheios.
 */
export const DEVICE_SHELL_KINDS = [
  "auto",
  "pwsh",
  "powershell",
  "cmd",
  "bash",
  "sh",
  "zsh",
] as const

export type DeviceShellKind = (typeof DEVICE_SHELL_KINDS)[number]

const DEVICE_SHELL_KIND_SET = new Set<string>(DEVICE_SHELL_KINDS)

export const DEVICE_SHELL_SCRIPT_MAX_LENGTH = 64 * 1024
export const DEVICE_SHELL_STDIN_MAX_LENGTH = 64 * 1024
export const DEVICE_SHELL_TIMEOUT_MIN_MS = 1_000
export const DEVICE_SHELL_TIMEOUT_MAX_MS = 60_000
export const DEVICE_SHELL_TIMEOUT_DEFAULT_MS = 30_000
export const DEVICE_SHELL_OUTPUT_MIN_BYTES = 1024
export const DEVICE_SHELL_OUTPUT_MAX_BYTES = 512 * 1024
export const DEVICE_SHELL_OUTPUT_DEFAULT_BYTES = 64 * 1024
export const DEVICE_SHELL_ENV_MAX_ENTRIES = 32
export const DEVICE_SHELL_ENV_NAME_MAX_LENGTH = 64
export const DEVICE_SHELL_ENV_VALUE_MAX_LENGTH = 4096
export const DEVICE_SHELL_ENV_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/
export const DEVICE_ENV_RUNTIMES_MAX = 24

/**
 * Jobs são processos de fundo: o `job-start` responde na hora e a saída é lida
 * por cursor. O buffer fica abaixo do `maxPayload` do WebSocket e o teto de
 * execução evita processo esquecido.
 */
export const DEVICE_JOB_MAX_ACTIVE = 3
export const DEVICE_JOB_ID_MAX_LENGTH = 128
export const DEVICE_JOB_LABEL_MAX_LENGTH = 80
export const DEVICE_JOB_MAX_RUNTIME_MIN_MS = 1_000
export const DEVICE_JOB_MAX_RUNTIME_DEFAULT_MS = 30 * 60_000
export const DEVICE_JOB_MAX_RUNTIME_MS = 60 * 60_000
export const DEVICE_JOB_OUTPUT_MIN_BYTES = 1024
export const DEVICE_JOB_OUTPUT_MAX_BYTES = 256 * 1024
export const DEVICE_JOB_OUTPUT_DEFAULT_BYTES = 64 * 1024
export const DEVICE_JOB_BUFFER_BYTES = 1024 * 1024
export const DEVICE_JOB_RETENTION_MS = 10 * 60_000
/** Espera ativa (long-poll) de status/saída: 0 responde na hora. */
export const DEVICE_JOB_WAIT_MIN_MS = 0
export const DEVICE_JOB_WAIT_MAX_MS = 10_000
export const DEVICE_JOB_WAIT_DEFAULT_MS = 0
export const DEVICE_JOB_STATUSES = [
  "running",
  "exited",
  "killed",
  "failed",
] as const

export type DeviceJobStatus = (typeof DEVICE_JOB_STATUSES)[number]

export const DEVICE_SCREENSHOT_FORMATS = ["jpeg", "png"] as const

export type DeviceScreenshotFormat = (typeof DEVICE_SCREENSHOT_FORMATS)[number]

const DEVICE_SCREENSHOT_FORMAT_SET = new Set<string>(DEVICE_SCREENSHOT_FORMATS)

export const DEVICE_SCREENSHOT_MAX_WIDTH_MIN = 320
export const DEVICE_SCREENSHOT_MAX_WIDTH_MAX = 3840
export const DEVICE_SCREENSHOT_MAX_WIDTH_DEFAULT = 1280
export const DEVICE_SCREENSHOT_QUALITY_MIN = 30
export const DEVICE_SCREENSHOT_QUALITY_MAX = 90
export const DEVICE_SCREENSHOT_QUALITY_DEFAULT = 70
export const DEVICE_SCREENSHOT_MAX_BYTES = 400 * 1024
export const DEVICE_SCREENSHOT_IMAGE_MAX_LENGTH = 4_000_000
export const DEVICE_SCREENSHOT_MONITOR_MAX = 15

/**
 * Escala usada nas coordenadas normalizadas: 0 = borda esquerda/topo,
 * 1000 = borda direita/baixo da imagem ou região de referência.
 */
export const DEVICE_SCREENSHOT_NORMALIZED_COORD_MAX = 1000

export const DEVICE_APP_SOURCES = [
  "builtin",
  "start-menu",
  "app-path",
  "store",
  "custom",
] as const

export type DeviceAppSource = (typeof DEVICE_APP_SOURCES)[number]

export type DeviceAppInfo = {
  id: string
  name: string
  source?: DeviceAppSource
  /** Caminho do executável quando a descoberta conseguiu resolvê-lo. */
  target?: string
  /** Argumentos padrão gravados no catálogo do driver (`register-app`). */
  args?: string[]
  /** Diretório de trabalho padrão gravado no catálogo do driver. */
  cwd?: string
}

export type DeviceOsInfo = {
  platform: string
  type: string
  release: string
  version: string
  architecture: string
  elevated?: boolean
}

export type DeviceWindowBounds = {
  x: number
  y: number
  width: number
  height: number
}

export type DeviceWindow = {
  id: string
  title: string
  processId: number
  processName: string
  bounds: DeviceWindowBounds | null
  focused: boolean
  minimized: boolean
}

export type DeviceUiElementPathItem = {
  name: string
  role: string
}

export type DeviceUiElement = {
  /**
   * Identificador de runtime do UI Automation. Vale apenas enquanto o elemento
   * existir; use imediatamente em `ui-action`. Pode ser null quando o provedor
   * de acessibilidade não expõe um runtime id.
   */
  runtimeId: string | null
  name: string
  role: string
  /** Texto atual do controle quando ele expõe ValuePattern; null caso contrário. */
  value: string | null
  bounds: DeviceWindowBounds | null
  center: DeviceMousePoint | null
  enabled: boolean
  focused: boolean
  selected: boolean | null
  expanded: boolean | null
  offscreen: boolean
  actionable: boolean
  actions: DeviceUiAction[]
  automationId: string
  path: DeviceUiElementPathItem[]
}

export type DeviceUiInspection = {
  windowId: string
  windowTitle: string
  elements: DeviceUiElement[]
  scanned: number
  /**
   * Tempo total gasto esperando o alvo aparecer. Zero quando a primeira
   * varredura já encontrou o resultado.
   */
  waitedMs: number
  truncated: boolean
}

export type DeviceUiActionResult = {
  windowId: string
  action: DeviceUiAction
  element: DeviceUiElement
  /** Tempo gasto reenumerando a árvore até o runtimeId aparecer. */
  waitedMs: number
  /**
   * Correção sugerida quando a ação escolhida não é a ideal para o controle,
   * como `focus` num elemento que só ativa com `select`.
   */
  hint?: string
}

export type DeviceScreenshot = {
  id: string
  width: number
  height: number
  /**
   * Pixels da captura nativa por unidade do sistema operacional. Em telas
   * Retina, por exemplo, é 2. A imagem final pode ter sido reduzida; use
   * `width`/`region` para converter coordenadas da imagem em coordenadas da
   * tela.
   */
  scale: number
  monitor: number | null
  region: DeviceWindowBounds
  format: DeviceScreenshotFormat
  byteLength: number
  capturedAt: string
}

export type DeviceFileEntryType =
  | "file"
  | "directory"
  | "symlink"
  | "other"

export type DeviceFileEntry = {
  name: string
  path: string
  type: DeviceFileEntryType
  size: number | null
  modifiedAt: string | null
}

export type DeviceFileContent = {
  path: string
  content: string
  startLine: number
  endLine: number
  totalLines: number
  truncated: boolean
  size: number
}

export type DeviceFileWriteResult = {
  path: string
  size: number
  created: boolean
}

/** Item de `read-files`: sucesso traz o conteúdo, falha traz código e motivo. */
export type DeviceFileReadItem =
  | { path: string; file: DeviceFileContent }
  | { path: string; code: string; error: string }

/** Falha por arquivo em `write-files`, sem abortar o restante do lote. */
export type DeviceFileBatchFailure = {
  path: string
  code: string
  error: string
}

export type DeviceFileEditResult = {
  path: string
  replacements: number
  oldTextLength: number
  newTextLength: number
}

export type DeviceFileStat = {
  path: string
  type: DeviceFileEntryType
  size: number | null
  modifiedAt: string | null
  createdAt: string | null
  mode: number
  isSymlink: boolean
  /** Destino do link, quando `isSymlink` for true. */
  linkTarget: string | null
}

export type DeviceFileMkdirResult = {
  path: string
  created: boolean
}

export type DeviceFileCopyResult = {
  from: string
  to: string
  files: number
  bytes: number
}

export type DeviceFileMoveResult = {
  from: string
  to: string
}

export type DeviceFileDeleteResult = {
  path: string
  deleted: boolean
  toTrash: boolean
}

export type DeviceFilePatch = {
  oldText: string
  newText: string
  replaceAll: boolean
}

export type DeviceFilePatchResult = {
  path: string
  applied: number
  replacements: number
}

export type DeviceCommandRunResult = {
  command: string
  exitCode: number | null
  stdout: string
  stderr: string
  durationMs: number
}

export type DeviceShellInfo = {
  /** Como o shell foi identificado: pwsh, powershell, cmd, bash, sh ou zsh. */
  kind: Exclude<DeviceShellKind, "auto">
  path: string
  version: string | null
}

export type DeviceRuntimeInfo = {
  id: string
  version: string | null
  path: string | null
}

/**
 * Retrato do ambiente da máquina. Serve para o modelo parar de adivinhar
 * caminhos, shells e runtimes antes de executar qualquer script.
 */
export type DeviceEnv = {
  platform: string
  arch: string
  hostname: string
  user: string
  home: string
  temp: string
  cwd: string
  shell: DeviceShellInfo
  shells: DeviceShellInfo[]
  runtimes: DeviceRuntimeInfo[]
  elevated: boolean
  locale: string | null
  /** Comandos que este driver realmente sabe executar nesta plataforma. */
  capabilities: DeviceCommandName[]
  collectedAt: string
}

export type DeviceShellResult = {
  shell: Exclude<DeviceShellKind, "auto">
  shellPath: string
  cwd: string
  /** 0..255, ou -1 quando o processo foi morto por timeout/abort. */
  exitCode: number
  stdout: string
  stderr: string
  stdoutBytes: number
  stderrBytes: number
  durationMs: number
  truncated: boolean
  timedOut: boolean
}

/** Retrato de um processo de fundo mantido pelo driver. */
export type DeviceJob = {
  id: string
  label: string | null
  status: DeviceJobStatus
  shell: Exclude<DeviceShellKind, "auto">
  shellPath: string
  cwd: string
  /** ISO 8601. */
  startedAt: string
  durationMs: number
  exitCode: number | null
  /** Motivo da falha quando o processo nem chegou a rodar. */
  error: string | null
  stdoutBytes: number
  stderrBytes: number
  /** Total de caracteres já emitidos, base do cursor de `job-output`. */
  outputChars: number
  truncated: boolean
  timedOut: boolean
  cancelled: boolean
}

export type DeviceJobStream = "stdout" | "stderr"

export type DeviceJobChunk = {
  /** Posição do primeiro caractere do chunk no fluxo combinado. */
  cursor: number
  stream: DeviceJobStream
  text: string
}

export type DeviceJobOutput = {
  jobId: string
  /** Cursor do primeiro caractere ainda retido no buffer. */
  startCursor: number
  chunks: DeviceJobChunk[]
  nextCursor: number
  truncated: boolean
  /** Status do job no momento da leitura: evita um status extra por leitura. */
  status: DeviceJobStatus
  exitCode: number | null
  cancelled: boolean
}

export type DeviceGrepMatch = {
  path: string
  line: number
  column: number
  text: string
}

export type DeviceClipboardContent = {
  text: string
  length: number
  truncated: boolean
}

export type DeviceMousePoint = {
  x: number
  y: number
}

export type DeviceCommandInputMap = {
  "open-url": { url: string }
  "open-app": {
    appId?: string
    path?: string
    args?: string[]
    cwd?: string
  }
  "open-path": { path: string }
  "register-app": {
    name: string
    path: string
    args?: string[]
    cwd?: string
  }
  "remove-app": { appId: string }
  "list-apps": { query?: string; refresh?: boolean; limit?: number }
  "find-app": { query: string; refresh?: boolean; limit?: number }
  "get-os": Record<string, never>
  "get-env": Record<string, never>
  shell: {
    script: string
    shell: DeviceShellKind
    cwd?: string
    timeoutMs: number
    env?: Record<string, string>
    stdin?: string
    maxOutputBytes: number
  }
  "type-text": { text: string; windowId?: string }
  "read-clipboard": Record<string, never>
  "write-clipboard": { text: string }
  "move-mouse": { x: number; y: number }
  click: {
    x?: number
    y?: number
    button: DeviceMouseButton
    count: number
  }
  scroll: {
    x?: number
    y?: number
    direction: DeviceMouseScrollDirection
    amount: number
  }
  drag: {
    from: DeviceMousePoint
    to: DeviceMousePoint
    button: DeviceMouseButton
    durationMs: number
  }
  "press-key": {
    key: DeviceKey
    modifiers: DeviceKeyModifier[]
    windowId?: string
  }
  "list-windows": { includeMinimized: boolean; limit: number }
  "focus-window": { windowId: string }
  "minimize-window": { windowId: string }
  "maximize-window": { windowId: string }
  "restore-window": { windowId: string }
  "close-window": { windowId: string }
  "list-processes": { query?: string; limit?: number }
  "kill-process": { pid: number; force?: boolean; tree?: boolean }
  "get-system-status": Record<string, never>
  "set-volume": { level?: number; mute?: boolean }
  "set-brightness": { level: number }
  "lock-screen": Record<string, never>
  "power": { action: "sleep" | "shutdown" | "restart" | "cancel"; delaySec?: number }
  "media-control": { action: "play-pause" | "next" | "previous" | "stop" }
  "inspect-ui": {
    windowId: string
    find?: string
    role?: string
    maxResults: number
    depth: number
    includeOffscreen: boolean
    waitMs: number
  }
  "ui-action": {
    windowId: string
    runtimeId: string
    action: DeviceUiAction
    waitMs: number
    value?: string
  }
  "list-files": {
    path?: string
    depth: number
    showHidden: boolean
    maxEntries: number
  }
  "read-file": { path: string; offset: number; limit: number }
  "read-files": { paths: string[]; offset: number; limit: number }
  glob: {
    pattern: string
    path?: string
    showHidden: boolean
    maxResults: number
  }
  grep: {
    pattern: string
    path?: string
    glob?: string
    caseSensitive: boolean
    maxResults: number
  }
  "check-admin": Record<string, never>
  "write-file": {
    path: string
    content: string
  }
  "write-files": {
    files: Array<{ path: string; content: string }>
  }
  "edit-file": {
    path: string
    oldText: string
    newText: string
  }
  mkdir: { path: string; recursive: boolean }
  stat: { path: string }
  copy: { from: string; to: string; overwrite: boolean; recursive: boolean }
  move: { from: string; to: string; overwrite: boolean }
  delete: { path: string; recursive: boolean; permanent: boolean }
  "apply-patch": { path: string; patches: DeviceFilePatch[] }
  "run-command": {
    command: string
    args?: string[]
    timeoutMs?: number
    cwd?: string
  }
  "job-start": {
    script: string
    shell: DeviceShellKind
    cwd?: string
    env?: Record<string, string>
    label?: string
    maxRuntimeMs: number
  }
  "job-status": { jobId: string; waitMs: number }
  "job-output": {
    jobId: string
    cursor: number
    maxBytes: number
    waitMs: number
  }
  "job-cancel": { jobId: string }
  "job-list": Record<string, never>
  screenshot: {
    monitor?: number
    region?: DeviceWindowBounds
    windowId?: string
    maxWidth: number
    quality: number
    format: DeviceScreenshotFormat
  }
}

export type DeviceCommand = {
  [Name in DeviceCommandName]: {
    command: Name
    input: DeviceCommandInputMap[Name]
  }
}[DeviceCommandName]

/**
 * Orçamento real de execução no driver, quando o comando declara um. O
 * transporte precisa esperar esse valor; usar o default do cliente cortava
 * scripts que o driver ainda estava executando.
 */
export function deviceCommandTimeoutMs(
  command: DeviceCommand,
): number | undefined {
  switch (command.command) {
    case "shell":
      return command.input.timeoutMs
    case "run-command":
      return command.input.timeoutMs
    case "job-status":
    case "job-output":
      // A espera ativa precisa de folga para o backend não desistir antes.
      return command.input.waitMs > 0 ? command.input.waitMs + 2_000 : undefined
    case "list-processes":
    case "kill-process":
    case "get-system-status":
    case "set-volume":
    case "set-brightness":
    case "lock-screen":
    case "media-control":
      return 10_000
    case "read-files":
    case "write-files":
      return 20_000
    case "power":
      return 20_000
    default:
      return undefined
  }
}

export type DeviceCommandSuccess = {
  ok: true
  output?: string
  apps?: DeviceAppInfo[]
  /** Presente em `find-app`: true quando ao menos um app casou com a busca. */
  found?: boolean
  /** Eco da busca feita em `find-app`/`list-apps`. */
  query?: string
  os?: DeviceOsInfo
  env?: DeviceEnv
  shell?: DeviceShellResult
  entries?: DeviceFileEntry[]
  file?: DeviceFileContent
  files?: DeviceFileReadItem[]
  paths?: string[]
  matches?: DeviceGrepMatch[]
  truncated?: boolean
  total?: number
  totalBytes?: number
  filesScanned?: number
  admin?: boolean
  write?: DeviceFileWriteResult
  writes?: DeviceFileWriteResult[]
  written?: number
  failed?: DeviceFileBatchFailure[]
  edit?: DeviceFileEditResult
  stat?: DeviceFileStat
  mkdir?: DeviceFileMkdirResult
  copy?: DeviceFileCopyResult
  move?: DeviceFileMoveResult
  delete?: DeviceFileDeleteResult
  patch?: DeviceFilePatchResult
  run?: DeviceCommandRunResult
  job?: DeviceJob
  jobs?: DeviceJob[]
  jobOutput?: DeviceJobOutput
  /** Presente em `job-cancel`: true quando um job em execução recebeu o sinal. */
  cancelled?: boolean
  windows?: DeviceWindow[]
  window?: DeviceWindow
  screenshot?: DeviceScreenshot
  /**
   * Presente em `open-app`: true quando o driver confirmou o surgimento de
   * uma janela do aplicativo depois de abri-lo. Quando ausente ou false, o
   * processo foi disparado mas a janela ainda não foi vista.
   */
  verified?: boolean
  processes?: DeviceProcessInfo[]
  process?: DeviceProcessInfo
  killed?: boolean
  systemStatus?: DeviceSystemStatus
  volume?: DeviceVolumeResult
  brightness?: DeviceBrightnessResult
  locked?: boolean
  power?: DevicePowerResult
  mediaControl?: DeviceMediaControlResult
  /**
   * Bytes da imagem em base64. Transiente: o app guarda em disco e remove
   * antes de expor o resultado ao modelo e ao histórico do chat.
   */
  imageBase64?: string
  clipboard?: DeviceClipboardContent
  ui?: DeviceUiInspection
  uiAction?: DeviceUiActionResult
}

export type DeviceCommandFailure = {
  ok: false
  error: string
  code?: string
}

export type DeviceCommandResult = DeviceCommandSuccess | DeviceCommandFailure

export class DeviceCommandValidationError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = "DeviceCommandValidationError"
    this.code = code
  }
}

export function isDeviceCommandName(value: string): value is DeviceCommandName {
  return DEVICE_COMMAND_NAME_SET.has(value)
}

export function isDeviceKey(value: string): value is DeviceKey {
  return DEVICE_KEY_SET.has(value)
}

export function isDeviceWindowId(value: string): boolean {
  return DEVICE_WINDOW_ID_PATTERN.test(value)
}

export function isAllowedDeviceUrl(value: string): boolean {
  if (value.length === 0 || value.length > DEVICE_URL_MAX_LENGTH) {
    return false
  }

  let parsed: URL

  try {
    parsed = new URL(value)
  } catch {
    return false
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return false
  }

  return parsed.username === "" && parsed.password === ""
}

export function isBlockedKeyCombination(
  key: string,
  modifiers: readonly string[],
): boolean {
  const normalizedKey = key.trim().toLowerCase()
  const active = new Set(modifiers.map((modifier) => modifier.toLowerCase()))

  if (normalizedKey === "f4" && active.has("alt")) {
    return true
  }

  if (
    normalizedKey === "delete" &&
    active.has("ctrl") &&
    active.has("alt")
  ) {
    return true
  }

  return false
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function readString(
  input: unknown,
  field: string,
  code: string,
): string {
  if (!isRecord(input) || typeof input[field] !== "string") {
    throw new DeviceCommandValidationError(
      code,
      `Campo "${field}" é obrigatório.`,
    )
  }

  return input[field]
}

function parseModifiers(input: unknown): DeviceKeyModifier[] {
  if (input === undefined || input === null) {
    return []
  }

  if (!Array.isArray(input)) {
    throw new DeviceCommandValidationError(
      "invalid_modifiers",
      "Modificadores devem ser uma lista.",
    )
  }

  const selected = new Set<string>()

  for (const modifier of input) {
    if (typeof modifier !== "string") {
      throw new DeviceCommandValidationError(
        "invalid_modifiers",
        "Modificador inválido.",
      )
    }

    const normalized = modifier.trim().toLowerCase()

    if (!DEVICE_KEY_MODIFIER_SET.has(normalized)) {
      throw new DeviceCommandValidationError(
        "invalid_modifiers",
        `Modificador não permitido: ${normalized || "(vazio)"}.`,
      )
    }

    selected.add(normalized)
  }

  return DEVICE_KEY_MODIFIERS.filter((modifier) => selected.has(modifier))
}

function parseOpenUrl(input: unknown): DeviceCommand {
  const url = readString(input, "url", "invalid_url").trim()

  if (!isAllowedDeviceUrl(url)) {
    throw new DeviceCommandValidationError(
      "invalid_url",
      "A URL deve usar http:// ou https:// e não pode conter credenciais.",
    )
  }

  return { command: "open-url", input: { url } }
}

function readOptionalTrimmedString(
  input: unknown,
  field: string,
  maxLength: number,
  code: string,
): string | undefined {
  if (!isRecord(input) || input[field] === undefined || input[field] === null) {
    return undefined
  }

  const value = input[field]

  if (typeof value !== "string") {
    throw new DeviceCommandValidationError(
      code,
      `Campo "${field}" deve ser um texto.`,
    )
  }

  const trimmed = value.trim()

  if (trimmed.length === 0) {
    return undefined
  }

  if (trimmed.length > maxLength) {
    throw new DeviceCommandValidationError(
      code,
      `Campo "${field}" deve ter no máximo ${maxLength} caracteres.`,
    )
  }

  return trimmed
}

function readOptionalBoolean(
  input: unknown,
  field: string,
  code: string,
): boolean | undefined {
  if (!isRecord(input) || input[field] === undefined || input[field] === null) {
    return undefined
  }

  if (typeof input[field] !== "boolean") {
    throw new DeviceCommandValidationError(
      code,
      `Campo "${field}" deve ser booleano.`,
    )
  }

  return input[field]
}

function parseListApps(input: unknown): DeviceCommand {
  const query = readOptionalTrimmedString(
    input,
    "query",
    DEVICE_APP_QUERY_MAX_LENGTH,
    "invalid_app_query",
  )
  const refresh = readOptionalBoolean(input, "refresh", "invalid_app_query")
  const limit = readOptionalInteger(
    input,
    "limit",
    1,
    DEVICE_APP_RESULTS_MAX,
  )

  return {
    command: "list-apps",
    input: {
      ...(query !== undefined ? { query } : {}),
      ...(refresh !== undefined ? { refresh } : {}),
      ...(limit !== undefined ? { limit } : {}),
    },
  }
}

function parseFindApp(input: unknown): DeviceCommand {
  const query = readString(input, "query", "invalid_app_query").trim()

  if (query.length === 0 || query.length > DEVICE_APP_QUERY_MAX_LENGTH) {
    throw new DeviceCommandValidationError(
      "invalid_app_query",
      `A busca deve ter entre 1 e ${DEVICE_APP_QUERY_MAX_LENGTH} caracteres.`,
    )
  }

  if (/[\u0000-\u001f\u007f]/.test(query)) {
    throw new DeviceCommandValidationError(
      "invalid_app_query",
      "A busca contém caracteres de controle não suportados.",
    )
  }

  const refresh = readOptionalBoolean(input, "refresh", "invalid_app_query")
  const limit = readOptionalInteger(
    input,
    "limit",
    1,
    DEVICE_APP_RESULTS_MAX,
  )

  return {
    command: "find-app",
    input: {
      query,
      ...(refresh !== undefined ? { refresh } : {}),
      ...(limit !== undefined ? { limit } : {}),
    },
  }
}

function readAppArgs(input: unknown): string[] | undefined {
  if (!isRecord(input) || input.args === undefined || input.args === null) {
    return undefined
  }

  if (!Array.isArray(input.args)) {
    throw new DeviceCommandValidationError(
      "invalid_app_args",
      'Campo "args" deve ser uma lista de textos.',
    )
  }

  if (input.args.length > DEVICE_APP_ARGS_MAX) {
    throw new DeviceCommandValidationError(
      "invalid_app_args",
      `Informe no máximo ${DEVICE_APP_ARGS_MAX} argumentos.`,
    )
  }

  const args: string[] = []

  for (const item of input.args) {
    if (typeof item !== "string") {
      throw new DeviceCommandValidationError(
        "invalid_app_args",
        "Cada argumento deve ser um texto.",
      )
    }

    if (item.length === 0 || item.length > DEVICE_APP_ARG_MAX_LENGTH) {
      throw new DeviceCommandValidationError(
        "invalid_app_args",
        `Cada argumento deve ter entre 1 e ${DEVICE_APP_ARG_MAX_LENGTH} caracteres.`,
      )
    }

    if (/[\u0000-\u001f\u007f]/.test(item)) {
      throw new DeviceCommandValidationError(
        "invalid_app_args",
        "Os argumentos não podem conter caracteres de controle ou quebra de linha.",
      )
    }

    args.push(item)
  }

  return args.length > 0 ? args : undefined
}

function readAppCwd(input: unknown): string | undefined {
  const cwd = readOptionalTrimmedString(
    input,
    "cwd",
    DEVICE_PATH_MAX_LENGTH,
    "invalid_app_cwd",
  )

  if (cwd === undefined) {
    return undefined
  }

  if (!isAbsoluteAppPath(cwd) || /[\u0000-\u001f\u007f]/.test(cwd)) {
    throw new DeviceCommandValidationError(
      "invalid_app_cwd",
      "O diretório de trabalho deve ser um caminho absoluto válido.",
    )
  }

  return cwd
}

function parseOpenApp(input: unknown): DeviceCommand {
  const appId = readOptionalTrimmedString(
    input,
    "appId",
    64,
    "invalid_app",
  )
  const path = readOptionalTrimmedString(
    input,
    "path",
    DEVICE_PATH_MAX_LENGTH,
    "invalid_app_path",
  )
  const args = readAppArgs(input)
  const cwd = readAppCwd(input)

  if ((appId === undefined) === (path === undefined)) {
    throw new DeviceCommandValidationError(
      "invalid_app",
      'Informe "appId" ou "path", mas não os dois.',
    )
  }

  if (appId !== undefined) {
    const normalized = appId.toLowerCase()

    if (!DEVICE_APP_ID_PATTERN.test(normalized)) {
      throw new DeviceCommandValidationError(
        "invalid_app",
        "Identificador de aplicativo inválido.",
      )
    }

    return {
      command: "open-app",
      input: {
        appId: normalized,
        ...(args ? { args } : {}),
        ...(cwd ? { cwd } : {}),
      },
    }
  }

  if (
    !path ||
    !isAbsoluteAppPath(path) ||
    /[\u0000-\u001f\u007f]/.test(path)
  ) {
    throw new DeviceCommandValidationError(
      "invalid_app_path",
      "Informe um caminho absoluto para o aplicativo.",
    )
  }

  if (!hasAppPathExtension(path)) {
    throw new DeviceCommandValidationError(
      "invalid_app_path",
      "O caminho precisa apontar para um executável, atalho ou app.",
    )
  }

  return {
    command: "open-app",
    input: {
      path,
      ...(args ? { args } : {}),
      ...(cwd ? { cwd } : {}),
    },
  }
}

function parseOpenPath(input: unknown): DeviceCommand {
  const path = readString(input, "path", "invalid_path").trim()

  if (
    path.length === 0 ||
    path.length > DEVICE_PATH_MAX_LENGTH ||
    !isAbsoluteAppPath(path) ||
    /[\u0000-\u001f\u007f]/.test(path)
  ) {
    throw new DeviceCommandValidationError(
      "invalid_path",
      "Informe um caminho absoluto para o arquivo ou pasta.",
    )
  }

  if (hasAppPathExtension(path)) {
    throw new DeviceCommandValidationError(
      "invalid_path",
      "Para abrir um executável ou atalho, use open-app com aprovação.",
    )
  }

  if (hasBlockedOpenPathExtension(path)) {
    throw new DeviceCommandValidationError(
      "invalid_path",
      "Scripts e instaladores não abrem por open-path. Use open-app com aprovação.",
    )
  }

  return { command: "open-path", input: { path } }
}

function parseRegisterApp(input: unknown): DeviceCommand {
  const name = readString(input, "name", "invalid_app_name").trim()

  if (name.length === 0 || name.length > DEVICE_APP_NAME_MAX_LENGTH) {
    throw new DeviceCommandValidationError(
      "invalid_app_name",
      `O nome do aplicativo deve ter entre 1 e ${DEVICE_APP_NAME_MAX_LENGTH} caracteres.`,
    )
  }

  if (/[\u0000-\u001f\u007f]/.test(name)) {
    throw new DeviceCommandValidationError(
      "invalid_app_name",
      "O nome do aplicativo contém caracteres de controle não suportados.",
    )
  }

  const path = readString(input, "path", "invalid_app_path").trim()

  if (
    path.length === 0 ||
    !isAbsoluteAppPath(path) ||
    !hasAppPathExtension(path) ||
    /[\u0000-\u001f\u007f]/.test(path)
  ) {
    throw new DeviceCommandValidationError(
      "invalid_app_path",
      "Informe um caminho absoluto para um executável ou atalho.",
    )
  }

  const args = readAppArgs(input)
  const cwd = readAppCwd(input)

  return {
    command: "register-app",
    input: {
      name,
      path,
      ...(args ? { args } : {}),
      ...(cwd ? { cwd } : {}),
    },
  }
}

function parseRemoveApp(input: unknown): DeviceCommand {
  const appId = readString(input, "appId", "invalid_app").trim().toLowerCase()

  if (!DEVICE_APP_ID_PATTERN.test(appId)) {
    throw new DeviceCommandValidationError(
      "invalid_app",
      "Identificador de aplicativo inválido.",
    )
  }

  return { command: "remove-app", input: { appId } }
}

function parseTypeText(input: unknown): DeviceCommand {
  const text = readString(input, "text", "invalid_text")
  const windowId = readOptionalWindowId(input)

  if (text.length === 0 || text.length > DEVICE_TEXT_MAX_LENGTH) {
    throw new DeviceCommandValidationError(
      "invalid_text",
      `O texto deve ter entre 1 e ${DEVICE_TEXT_MAX_LENGTH} caracteres.`,
    )
  }

  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) {
    throw new DeviceCommandValidationError(
      "invalid_text",
      "O texto contém caracteres de controle não suportados.",
    )
  }

  return {
    command: "type-text",
    input: { text, ...(windowId ? { windowId } : {}) },
  }
}

function parsePressKey(input: unknown): DeviceCommand {
  const key = readString(input, "key", "invalid_key").trim().toLowerCase()
  const windowId = readOptionalWindowId(input)

  if (!isDeviceKey(key)) {
    throw new DeviceCommandValidationError(
      "invalid_key",
      "Tecla não permitida.",
    )
  }

  const modifiers = parseModifiers(isRecord(input) ? input.modifiers : undefined)

  if (isBlockedKeyCombination(key, modifiers)) {
    throw new DeviceCommandValidationError(
      "blocked_key_combination",
      "Esta combinação de teclas é bloqueada por segurança.",
    )
  }

  return {
    command: "press-key",
    input: { key, modifiers, ...(windowId ? { windowId } : {}) },
  }
}

function parseReadClipboard(): DeviceCommand {
  return { command: "read-clipboard", input: {} }
}

function parseWriteClipboard(input: unknown): DeviceCommand {
  const text = readString(input, "text", "invalid_text")

  if (text.length === 0 || text.length > DEVICE_CLIPBOARD_TEXT_MAX_LENGTH) {
    throw new DeviceCommandValidationError(
      "invalid_text",
      `O texto deve ter entre 1 e ${DEVICE_CLIPBOARD_TEXT_MAX_LENGTH} caracteres.`,
    )
  }

  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) {
    throw new DeviceCommandValidationError(
      "invalid_text",
      "O texto contém caracteres de controle não suportados.",
    )
  }

  return { command: "write-clipboard", input: { text } }
}

function readMouseEnum<T extends string>(
  input: unknown,
  field: string,
  values: readonly T[],
  code: string,
  fallback?: T,
): T {
  if (!isRecord(input) || input[field] === undefined || input[field] === null) {
    if (fallback !== undefined) {
      return fallback
    }

    throw new DeviceCommandValidationError(
      code,
      `Campo "${field}" é obrigatório.`,
    )
  }

  const value = input[field]

  if (typeof value !== "string" || !values.includes(value as T)) {
    throw new DeviceCommandValidationError(code, `Campo "${field}" inválido.`)
  }

  return value as T
}

function readMouseCoordinate(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new DeviceCommandValidationError(
      "invalid_coordinates",
      `Campo "${field}" deve ser um número inteiro.`,
    )
  }

  const integer = Math.trunc(value)

  if (integer < DEVICE_MOUSE_COORD_MIN || integer > DEVICE_MOUSE_COORD_MAX) {
    throw new DeviceCommandValidationError(
      "invalid_coordinates",
      `Campo "${field}" deve estar entre ${DEVICE_MOUSE_COORD_MIN} e ${DEVICE_MOUSE_COORD_MAX}.`,
    )
  }

  return integer
}

function readOptionalMouseCoordinate(
  input: unknown,
  field: string,
): number | undefined {
  if (!isRecord(input) || input[field] === undefined || input[field] === null) {
    return undefined
  }

  return readMouseCoordinate(input[field], field)
}

function readMousePoint(value: unknown, field: string): DeviceMousePoint {
  if (!isRecord(value)) {
    throw new DeviceCommandValidationError(
      "invalid_coordinates",
      `Campo "${field}" deve conter "x" e "y".`,
    )
  }

  const x = readOptionalMouseCoordinate(value, "x")
  const y = readOptionalMouseCoordinate(value, "y")

  if (x === undefined || y === undefined) {
    throw new DeviceCommandValidationError(
      "invalid_coordinates",
      `Campo "${field}" deve conter "x" e "y".`,
    )
  }

  return { x, y }
}

function readOptionalMousePoint(input: unknown): DeviceMousePoint | undefined {
  const x = readOptionalMouseCoordinate(input, "x")
  const y = readOptionalMouseCoordinate(input, "y")

  if (x === undefined && y === undefined) {
    return undefined
  }

  if (x === undefined || y === undefined) {
    throw new DeviceCommandValidationError(
      "invalid_coordinates",
      'Informe "x" e "y" juntos.',
    )
  }

  return { x, y }
}

function parseMoveMouse(input: unknown): DeviceCommand {
  const point = readOptionalMousePoint(input)

  if (!point) {
    throw new DeviceCommandValidationError(
      "invalid_coordinates",
      'Campos "x" e "y" são obrigatórios.',
    )
  }

  return { command: "move-mouse", input: point }
}

function parseClick(input: unknown): DeviceCommand {
  const point = readOptionalMousePoint(input)
  const button = readMouseEnum(
    input,
    "button",
    DEVICE_MOUSE_BUTTONS,
    "invalid_button",
    "left",
  )
  const count = readInteger(
    input,
    "count",
    DEVICE_MOUSE_CLICK_COUNT_DEFAULT,
    DEVICE_MOUSE_CLICK_COUNT_MIN,
    DEVICE_MOUSE_CLICK_COUNT_MAX,
  )

  return {
    command: "click",
    input: {
      ...(point ? point : {}),
      button,
      count,
    },
  }
}

function parseScroll(input: unknown): DeviceCommand {
  const point = readOptionalMousePoint(input)
  const direction = readMouseEnum(
    input,
    "direction",
    DEVICE_MOUSE_SCROLL_DIRECTIONS,
    "invalid_direction",
  )
  const amount = readInteger(
    input,
    "amount",
    DEVICE_MOUSE_SCROLL_AMOUNT_DEFAULT,
    DEVICE_MOUSE_SCROLL_AMOUNT_MIN,
    DEVICE_MOUSE_SCROLL_AMOUNT_MAX,
  )

  return {
    command: "scroll",
    input: {
      ...(point ? point : {}),
      direction,
      amount,
    },
  }
}

function parseDrag(input: unknown): DeviceCommand {
  if (!isRecord(input)) {
    throw new DeviceCommandValidationError(
      "invalid_coordinates",
      'Campos "from" e "to" são obrigatórios.',
    )
  }

  const from = readMousePoint(input.from, "from")
  const to = readMousePoint(input.to, "to")
  const button = readMouseEnum(
    input,
    "button",
    DEVICE_MOUSE_BUTTONS,
    "invalid_button",
    "left",
  )
  const durationMs = readInteger(
    input,
    "durationMs",
    DEVICE_MOUSE_DRAG_DURATION_DEFAULT_MS,
    DEVICE_MOUSE_DRAG_DURATION_MIN_MS,
    DEVICE_MOUSE_DRAG_DURATION_MAX_MS,
  )

  return { command: "drag", input: { from, to, button, durationMs } }
}

function readOptionalWindowId(input: unknown): string | undefined {
  if (
    !isRecord(input) ||
    input.windowId === undefined ||
    input.windowId === null
  ) {
    return undefined
  }

  if (typeof input.windowId !== "string") {
    throw new DeviceCommandValidationError(
      "invalid_window",
      'Campo "windowId" deve ser um texto.',
    )
  }

  const value = input.windowId.trim()

  if (value.length === 0) {
    return undefined
  }

  if (!isDeviceWindowId(value)) {
    throw new DeviceCommandValidationError(
      "invalid_window",
      "Identificador de janela inválido.",
    )
  }

  return value
}

function parseListWindows(input: unknown): DeviceCommand {
  const includeMinimized = readBoolean(input, "includeMinimized", false)
  const limit = readInteger(
    input,
    "limit",
    DEVICE_WINDOW_LIMIT_DEFAULT,
    DEVICE_WINDOW_LIMIT_MIN,
    DEVICE_WINDOW_LIMIT_MAX,
  )

  return { command: "list-windows", input: { includeMinimized, limit } }
}

function parseFocusWindow(input: unknown): DeviceCommand {
  const windowId = readOptionalWindowId(input)

  if (!windowId) {
    throw new DeviceCommandValidationError(
      "invalid_window",
      'Campo "windowId" é obrigatório.',
    )
  }

  return { command: "focus-window", input: { windowId } }
}

function parseWindowAction(
  command:
    | "minimize-window"
    | "maximize-window"
    | "restore-window"
    | "close-window",
  input: unknown,
): DeviceCommand {
  const windowId = readOptionalWindowId(input)

  if (!windowId) {
    throw new DeviceCommandValidationError(
      "invalid_window",
      'Campo "windowId" é obrigatório.',
    )
  }

  return { command, input: { windowId } }
}

function parseListProcesses(input: unknown): DeviceCommand {
  const query = readOptionalString(input, "query", DEVICE_PROCESS_QUERY_MAX_LENGTH)
  const limit = readInteger(
    input,
    "limit",
    DEVICE_PROCESS_LIMIT_DEFAULT,
    DEVICE_PROCESS_LIMIT_MIN,
    DEVICE_PROCESS_LIMIT_MAX,
  )

  return { command: "list-processes", input: { query, limit } }
}

function parseKillProcess(input: unknown): DeviceCommand {
  const pid = readOptionalInteger(input, "pid", 0, undefined)
  const force = readBoolean(input, "force", false)
  const tree = readBoolean(input, "tree", false)

  if (typeof pid !== "number" || !Number.isInteger(pid) || pid <= 0) {
    throw new DeviceCommandValidationError(
      "invalid_pid",
      'Campo "pid" deve ser um número inteiro positivo.',
    )
  }

  return { command: "kill-process", input: { pid, force, tree } }
}

function parseSetVolume(input: unknown): DeviceCommand {
  const level = readOptionalInteger(input, "level", 0, 100)
  const mute = readBoolean(input, "mute", false)

  return { command: "set-volume", input: { level, mute } }
}

function parseSetBrightness(input: unknown): DeviceCommand {
  if (!isRecord(input) || input.level === undefined || input.level === null) {
    throw new DeviceCommandValidationError(
      "missing_level",
      'Campo "level" é obrigatório e deve ser um número entre 0 e 100.',
    )
  }

  const level = readInteger(input, "level", 0, 0, 100)

  return { command: "set-brightness", input: { level } }
}

function parsePower(input: unknown): DeviceCommand {
  if (!isRecord(input) || typeof input.action !== "string") {
    throw new DeviceCommandValidationError(
      "invalid_power_action",
      'Campo "action" é obrigatório e deve ser "sleep", "shutdown", "restart" ou "cancel".',
    )
  }

  const action = input.action

  if (!["sleep", "shutdown", "restart", "cancel"].includes(action)) {
    throw new DeviceCommandValidationError(
      "invalid_power_action",
      'Campo "action" deve ser "sleep", "shutdown", "restart" ou "cancel".',
    )
  }

  const delaySec = readOptionalInteger(input, "delaySec", 0, undefined)

  return { command: "power", input: { action: action as DevicePowerAction, delaySec } }
}

function parseMediaControl(input: unknown): DeviceCommand {
  if (!isRecord(input) || typeof input.action !== "string") {
    throw new DeviceCommandValidationError(
      "invalid_media_action",
      'Campo "action" é obrigatório e deve ser "play-pause", "next", "previous" ou "stop".',
    )
  }

  const action = input.action

  if (!["play-pause", "next", "previous", "stop"].includes(action)) {
    throw new DeviceCommandValidationError(
      "invalid_media_action",
      'Campo "action" deve ser "play-pause", "next", "previous" ou "stop".',
    )
  }

  return {
    command: "media-control",
    input: { action: action as DeviceMediaControlAction },
  }
}

function readOptionalUiString(
  input: unknown,
  field: string,
  maxLength: number,
  code: string,
): string | undefined {
  if (!isRecord(input) || input[field] === undefined || input[field] === null) {
    return undefined
  }

  if (typeof input[field] !== "string") {
    throw new DeviceCommandValidationError(
      code,
      `Campo "${field}" deve ser um texto.`,
    )
  }

  const value = input[field].trim()

  if (value.length === 0) {
    return undefined
  }

  if (value.length > maxLength) {
    throw new DeviceCommandValidationError(
      code,
      `Campo "${field}" deve ter no máximo ${maxLength} caracteres.`,
    )
  }

  return value
}

function parseInspectUi(input: unknown): DeviceCommand {
  const windowId = readOptionalWindowId(input)

  if (!windowId) {
    throw new DeviceCommandValidationError(
      "invalid_window",
      'Campo "windowId" é obrigatório.',
    )
  }

  const find = readOptionalUiString(
    input,
    "find",
    DEVICE_UI_FIND_MAX_LENGTH,
    "invalid_ui_filter",
  )
  const rawRole = readOptionalUiString(
    input,
    "role",
    DEVICE_UI_ROLE_MAX_LENGTH,
    "invalid_ui_role",
  )
  let role: string | undefined

  if (rawRole) {
    const normalized = rawRole.replace(/^ControlType\./i, "")

    if (!DEVICE_UI_ROLE_PATTERN.test(normalized)) {
      throw new DeviceCommandValidationError(
        "invalid_ui_role",
        "O papel do elemento deve conter apenas letras e números, como Button ou TabItem.",
      )
    }

    role = normalized
  }

  const maxResults = readInteger(
    input,
    "maxResults",
    DEVICE_UI_RESULTS_DEFAULT,
    DEVICE_UI_RESULTS_MIN,
    DEVICE_UI_RESULTS_MAX,
  )
  const depth = readInteger(
    input,
    "depth",
    DEVICE_UI_DEPTH_DEFAULT,
    DEVICE_UI_DEPTH_MIN,
    DEVICE_UI_DEPTH_MAX,
  )
  const includeOffscreen = readBoolean(input, "includeOffscreen", false)
  const waitMs = readInteger(
    input,
    "waitMs",
    0,
    DEVICE_UI_WAIT_MIN_MS,
    DEVICE_UI_WAIT_MAX_MS,
  )

  return {
    command: "inspect-ui",
    input: {
      windowId,
      ...(find ? { find } : {}),
      ...(role ? { role } : {}),
      maxResults,
      depth,
      includeOffscreen,
      waitMs,
    },
  }
}

function parseUiAction(input: unknown): DeviceCommand {
  const windowId = readOptionalWindowId(input)

  if (!windowId) {
    throw new DeviceCommandValidationError(
      "invalid_window",
      'Campo "windowId" é obrigatório.',
    )
  }

  const runtimeId = readOptionalUiString(
    input,
    "runtimeId",
    DEVICE_UI_RUNTIME_ID_MAX_LENGTH,
    "invalid_runtime_id",
  )

  if (!runtimeId || !DEVICE_UI_RUNTIME_ID_PATTERN.test(runtimeId)) {
    throw new DeviceCommandValidationError(
      "invalid_runtime_id",
      "Informe o runtimeId retornado por inspect-ui para o elemento alvo.",
    )
  }

  const rawAction =
    isRecord(input) && input.action !== undefined && input.action !== null
      ? input.action
      : "invoke"

  if (typeof rawAction !== "string" || !DEVICE_UI_ACTION_SET.has(rawAction)) {
    throw new DeviceCommandValidationError(
      "invalid_ui_action",
      `Ação inválida. Use uma de: ${DEVICE_UI_ACTIONS.join(", ")}.`,
    )
  }

  const action = rawAction as DeviceUiAction
  const waitMs = readInteger(
    input,
    "waitMs",
    DEVICE_UI_WAIT_DEFAULT_MS,
    DEVICE_UI_WAIT_MIN_MS,
    DEVICE_UI_WAIT_MAX_MS,
  )
  const value = readUiActionValue(input, action)

  return {
    command: "ui-action",
    input: {
      windowId,
      runtimeId,
      action,
      waitMs,
      ...(value === undefined ? {} : { value }),
    },
  }
}

function readUiActionValue(
  input: unknown,
  action: DeviceUiAction,
): string | undefined {
  if (!isRecord(input) || input.value === undefined || input.value === null) {
    if (action === "setValue") {
      throw new DeviceCommandValidationError(
        "invalid_ui_value",
        'Campo "value" é obrigatório quando action é "setValue".',
      )
    }

    return undefined
  }

  if (typeof input.value !== "string") {
    throw new DeviceCommandValidationError(
      "invalid_ui_value",
      'Campo "value" deve ser um texto.',
    )
  }

  if (input.value.length > DEVICE_UI_VALUE_MAX_LENGTH) {
    throw new DeviceCommandValidationError(
      "invalid_ui_value",
      `Campo "value" excede ${DEVICE_UI_VALUE_MAX_LENGTH} caracteres.`,
    )
  }

  if (action !== "setValue") {
    throw new DeviceCommandValidationError(
      "invalid_ui_value",
      'Campo "value" só é aceito com action "setValue".',
    )
  }

  return input.value
}

function readOptionalPath(
  input: unknown,
  field = "path",
): string | undefined {
  if (!isRecord(input) || input[field] === undefined || input[field] === null) {
    return undefined
  }

  if (typeof input[field] !== "string") {
    throw new DeviceCommandValidationError(
      "invalid_path",
      `Campo "${field}" deve ser um texto.`,
    )
  }

  const value = (input[field] as string).trim()

  if (value.length === 0) {
    return undefined
  }

  return readPathValue(value, field)
}

function readPathValue(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new DeviceCommandValidationError(
      "invalid_path",
      `Campo "${label}" deve ser um texto.`,
    )
  }

  const trimmed = value.trim()

  if (trimmed.length === 0) {
    throw new DeviceCommandValidationError(
      "invalid_path",
      `Campo "${label}" é obrigatório.`,
    )
  }

  if (trimmed.length > DEVICE_PATH_MAX_LENGTH) {
    throw new DeviceCommandValidationError(
      "invalid_path",
      `O caminho deve ter no máximo ${DEVICE_PATH_MAX_LENGTH} caracteres.`,
    )
  }

  if (/[\u0000-\u001f\u007f]/.test(trimmed)) {
    throw new DeviceCommandValidationError(
      "invalid_path",
      "O caminho contém caracteres de controle não suportados.",
    )
  }

  return trimmed
}

/** Lista de caminhos de `read-files`: 1..20, sem duplicatas, ordem preservada. */
function readPathList(input: unknown, field: string): string[] {
  if (!isRecord(input) || input[field] === undefined || input[field] === null) {
    throw new DeviceCommandValidationError(
      "invalid_paths",
      `Campo "${field}" é obrigatório.`,
    )
  }

  const value = input[field]

  if (!Array.isArray(value)) {
    throw new DeviceCommandValidationError(
      "invalid_paths",
      `Campo "${field}" deve ser uma lista de caminhos.`,
    )
  }

  if (value.length === 0) {
    throw new DeviceCommandValidationError(
      "invalid_paths",
      "A lista precisa de pelo menos 1 caminho.",
    )
  }

  if (value.length > DEVICE_FILES_BATCH_MAX) {
    throw new DeviceCommandValidationError(
      "invalid_paths",
      `A lista aceita no máximo ${DEVICE_FILES_BATCH_MAX} caminhos.`,
    )
  }

  const paths = value.map((item) => readPathValue(item, field))

  return [...new Set(paths)]
}

/** Lote de `write-files`: caminhos únicos, 1 MB por arquivo, 2 MB no total. */
function readWriteFiles(
  input: unknown,
): Array<{ path: string; content: string }> {
  if (!isRecord(input) || input.files === undefined || input.files === null) {
    throw new DeviceCommandValidationError(
      "invalid_files",
      'Campo "files" é obrigatório.',
    )
  }

  const value = input.files

  if (!Array.isArray(value)) {
    throw new DeviceCommandValidationError(
      "invalid_files",
      'Campo "files" deve ser uma lista de arquivos.',
    )
  }

  if (value.length === 0) {
    throw new DeviceCommandValidationError(
      "invalid_files",
      "A lista precisa de pelo menos 1 arquivo.",
    )
  }

  if (value.length > DEVICE_FILES_BATCH_MAX) {
    throw new DeviceCommandValidationError(
      "invalid_files",
      `A lista aceita no máximo ${DEVICE_FILES_BATCH_MAX} arquivos.`,
    )
  }

  const seen = new Set<string>()
  const files: Array<{ path: string; content: string }> = []
  let totalBytes = 0

  value.forEach((item, index) => {
    if (!isRecord(item)) {
      throw new DeviceCommandValidationError(
        "invalid_files",
        `O item ${index + 1} deve ser um objeto com "path" e "content".`,
      )
    }

    const path = readPathValue(item.path, `files[${index}].path`)

    if (seen.has(path)) {
      throw new DeviceCommandValidationError(
        "duplicate_path",
        `O caminho "${path}" aparece mais de uma vez no lote.`,
      )
    }

    seen.add(path)

    if (typeof item.content !== "string") {
      throw new DeviceCommandValidationError(
        "invalid_content",
        `O conteúdo de "${path}" deve ser um texto.`,
      )
    }

    const bytes = Buffer.byteLength(item.content, "utf8")

    if (bytes > DEVICE_FILE_WRITE_MAX_BYTES) {
      throw new DeviceCommandValidationError(
        "invalid_content",
        `O conteúdo de "${path}" excede o limite de ${DEVICE_FILE_WRITE_MAX_BYTES} bytes.`,
      )
    }

    totalBytes += bytes

    files.push({ path, content: item.content })
  })

  if (totalBytes > DEVICE_WRITE_FILES_TOTAL_BYTES_MAX) {
    throw new DeviceCommandValidationError(
      "invalid_content",
      `O lote excede o limite de ${DEVICE_WRITE_FILES_TOTAL_BYTES_MAX} bytes.`,
    )
  }

  return files
}

function readRequiredPath(input: unknown): string {
  const value = readOptionalPath(input)

  if (!value) {
    throw new DeviceCommandValidationError(
      "invalid_path",
      'Campo "path" é obrigatório.',
    )
  }

  return value
}

function readRequiredPathField(input: unknown, field: string): string {
  const value = readOptionalPath(input, field)

  if (!value) {
    throw new DeviceCommandValidationError(
      "invalid_path",
      `Campo "${field}" é obrigatório.`,
    )
  }

  return value
}

function readPattern(
  input: unknown,
  field: string,
  required: boolean,
): string | undefined {
  if (!isRecord(input) || input[field] === undefined || input[field] === null) {
    if (required) {
      throw new DeviceCommandValidationError(
        "invalid_pattern",
        `Campo "${field}" é obrigatório.`,
      )
    }

    return undefined
  }

  if (typeof input[field] !== "string") {
    throw new DeviceCommandValidationError(
      "invalid_pattern",
      `Campo "${field}" deve ser um texto.`,
    )
  }

  const value = input[field].trim()

  if (value.length === 0) {
    if (required) {
      throw new DeviceCommandValidationError(
        "invalid_pattern",
        `Campo "${field}" é obrigatório.`,
      )
    }

    return undefined
  }

  if (value.length > DEVICE_PATTERN_MAX_LENGTH) {
    throw new DeviceCommandValidationError(
      "invalid_pattern",
      `O padrão deve ter no máximo ${DEVICE_PATTERN_MAX_LENGTH} caracteres.`,
    )
  }

  if (/[\u0000-\u001f\u007f]/.test(value)) {
    throw new DeviceCommandValidationError(
      "invalid_pattern",
      "O padrão contém caracteres de controle não suportados.",
    )
  }

  return value
}

function readInteger(
  input: unknown,
  field: string,
  fallback: number,
  min: number,
  max: number,
): number {
  if (!isRecord(input) || input[field] === undefined || input[field] === null) {
    return fallback
  }

  const value = input[field]

  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new DeviceCommandValidationError(
      "invalid_number",
      `Campo "${field}" deve ser um número inteiro.`,
    )
  }

  const integer = Math.trunc(value)

  if (integer < min || integer > max) {
    throw new DeviceCommandValidationError(
      "invalid_number",
      `Campo "${field}" deve estar entre ${min} e ${max}.`,
    )
  }

  return integer
}

function readOptionalInteger(
  input: unknown,
  field: string,
  min: number,
  max: number | undefined,
): number | undefined {
  if (!isRecord(input) || input[field] === undefined || input[field] === null) {
    return undefined
  }

  const value = input[field]

  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new DeviceCommandValidationError(
      "invalid_number",
      `Campo "${field}" deve ser um número inteiro.`,
    )
  }

  const integer = Math.trunc(value)

  if (integer < min) {
    throw new DeviceCommandValidationError(
      "invalid_number",
      `Campo "${field}" deve ser maior ou igual a ${min}.`,
    )
  }

  if (max !== undefined && integer > max) {
    throw new DeviceCommandValidationError(
      "invalid_number",
      `Campo "${field}" deve estar entre ${min} e ${max}.`,
    )
  }

  return integer
}

function readBoolean(
  input: unknown,
  field: string,
  fallback: boolean,
): boolean {
  if (!isRecord(input) || input[field] === undefined || input[field] === null) {
    return fallback
  }

  const value = input[field]

  if (typeof value !== "boolean") {
    throw new DeviceCommandValidationError(
      "invalid_boolean",
      `Campo "${field}" deve ser booleano.`,
    )
  }

  return value
}

function readOptionalString(
  input: unknown,
  field: string,
  maxLength: number,
): string | undefined {
  if (!isRecord(input) || input[field] === undefined || input[field] === null) {
    return undefined
  }

  const value = input[field]

  if (typeof value !== "string") {
    throw new DeviceCommandValidationError(
      "invalid_string",
      `Campo "${field}" deve ser um texto.`,
    )
  }

  const trimmed = value.trim()

  if (trimmed.length === 0) {
    return undefined
  }

  if (trimmed.length > maxLength) {
    throw new DeviceCommandValidationError(
      "invalid_string",
      `Campo "${field}" excede ${maxLength} caracteres.`,
    )
  }

  return trimmed
}

function parseListFiles(input: unknown): DeviceCommand {
  const path = readOptionalPath(input)
  const depth = readInteger(
    input,
    "depth",
    DEVICE_FILE_DEPTH_DEFAULT,
    DEVICE_FILE_DEPTH_MIN,
    DEVICE_FILE_DEPTH_MAX,
  )
  const showHidden = readBoolean(input, "showHidden", false)
  const maxEntries = readInteger(
    input,
    "maxEntries",
    DEVICE_FILE_ENTRIES_DEFAULT,
    DEVICE_FILE_ENTRIES_MIN,
    DEVICE_FILE_ENTRIES_MAX,
  )

  return {
    command: "list-files",
    input: {
      ...(path ? { path } : {}),
      depth,
      showHidden,
      maxEntries,
    },
  }
}

function parseReadFile(input: unknown): DeviceCommand {
  const path = readRequiredPath(input)
  const offset = readInteger(
    input,
    "offset",
    DEVICE_FILE_READ_OFFSET_DEFAULT,
    DEVICE_FILE_READ_OFFSET_MIN,
    DEVICE_FILE_READ_OFFSET_MAX,
  )
  const limit = readInteger(
    input,
    "limit",
    DEVICE_FILE_READ_LINES_DEFAULT,
    DEVICE_FILE_READ_LINES_MIN,
    DEVICE_FILE_READ_LINES_MAX,
  )

  return { command: "read-file", input: { path, offset, limit } }
}

function parseReadFiles(input: unknown): DeviceCommand {
  const paths = readPathList(input, "paths")
  const offset = readInteger(
    input,
    "offset",
    DEVICE_FILE_READ_OFFSET_DEFAULT,
    DEVICE_FILE_READ_OFFSET_MIN,
    DEVICE_FILE_READ_OFFSET_MAX,
  )
  const limit = readInteger(
    input,
    "limit",
    DEVICE_FILE_READ_LINES_DEFAULT,
    DEVICE_FILE_READ_LINES_MIN,
    DEVICE_FILE_READ_LINES_MAX,
  )

  return { command: "read-files", input: { paths, offset, limit } }
}

function parseGlob(input: unknown): DeviceCommand {
  const pattern = readPattern(input, "pattern", true) as string
  const path = readOptionalPath(input)
  const showHidden = readBoolean(input, "showHidden", false)
  const maxResults = readInteger(
    input,
    "maxResults",
    DEVICE_FILE_RESULTS_DEFAULT,
    DEVICE_FILE_RESULTS_MIN,
    DEVICE_FILE_RESULTS_MAX,
  )

  return {
    command: "glob",
    input: {
      pattern,
      ...(path ? { path } : {}),
      showHidden,
      maxResults,
    },
  }
}

function parseGrep(input: unknown): DeviceCommand {
  const pattern = readPattern(input, "pattern", true) as string
  const path = readOptionalPath(input)
  const glob = readPattern(input, "glob", false)
  const caseSensitive = readBoolean(input, "caseSensitive", false)
  const maxResults = readInteger(
    input,
    "maxResults",
    DEVICE_FILE_RESULTS_DEFAULT,
    DEVICE_FILE_RESULTS_MIN,
    DEVICE_FILE_RESULTS_MAX,
  )

  return {
    command: "grep",
    input: {
      pattern,
      ...(path ? { path } : {}),
      ...(glob ? { glob } : {}),
      caseSensitive,
      maxResults,
    },
  }
}

function parseWriteFile(input: unknown): DeviceCommand {
  const path = readRequiredPath(input)
  const content = readString(input, "content", "invalid_content")

  if (content.length === 0) {
    throw new DeviceCommandValidationError(
      "invalid_content",
      `O conteúdo deve ter entre 1 e ${DEVICE_FILE_WRITE_MAX_BYTES} bytes.`,
    )
  }

  if (Buffer.byteLength(content, "utf8") > DEVICE_FILE_WRITE_MAX_BYTES) {
    throw new DeviceCommandValidationError(
      "invalid_content",
      `O conteúdo excede o limite de ${DEVICE_FILE_WRITE_MAX_BYTES} bytes.`,
    )
  }

  return { command: "write-file", input: { path, content } }
}

function parseWriteFiles(input: unknown): DeviceCommand {
  return { command: "write-files", input: { files: readWriteFiles(input) } }
}

function parseEditFile(input: unknown): DeviceCommand {
  const path = readRequiredPath(input)
  const oldText = readString(input, "oldText", "invalid_oldText")
  const newText = readString(input, "newText", "invalid_newText")

  if (oldText.length === 0) {
    throw new DeviceCommandValidationError(
      "invalid_oldText",
      "O texto antigo não pode estar vazio.",
    )
  }

  if (Buffer.byteLength(oldText, "utf8") > DEVICE_FILE_EDIT_MAX_OLD_TEXT) {
    throw new DeviceCommandValidationError(
      "invalid_oldText",
      `O texto antigo excede o limite de ${DEVICE_FILE_EDIT_MAX_OLD_TEXT} bytes.`,
    )
  }

  if (Buffer.byteLength(newText, "utf8") > DEVICE_FILE_EDIT_MAX_NEW_TEXT) {
    throw new DeviceCommandValidationError(
      "invalid_newText",
      `O texto novo excede o limite de ${DEVICE_FILE_EDIT_MAX_NEW_TEXT} bytes.`,
    )
  }

  return { command: "edit-file", input: { path, oldText, newText } }
}

function parseMkdir(input: unknown): DeviceCommand {
  const path = readRequiredPath(input)
  const recursive = readBoolean(input, "recursive", true)

  return { command: "mkdir", input: { path, recursive } }
}

function parseStat(input: unknown): DeviceCommand {
  return { command: "stat", input: { path: readRequiredPath(input) } }
}

function parseCopy(input: unknown): DeviceCommand {
  const from = readRequiredPathField(input, "from")
  const to = readRequiredPathField(input, "to")
  const overwrite = readBoolean(input, "overwrite", false)
  const recursive = readBoolean(input, "recursive", true)

  return { command: "copy", input: { from, to, overwrite, recursive } }
}

function parseMove(input: unknown): DeviceCommand {
  const from = readRequiredPathField(input, "from")
  const to = readRequiredPathField(input, "to")
  const overwrite = readBoolean(input, "overwrite", false)

  return { command: "move", input: { from, to, overwrite } }
}

function parseDelete(input: unknown): DeviceCommand {
  const path = readRequiredPath(input)
  const recursive = readBoolean(input, "recursive", false)
  const permanent = readBoolean(input, "permanent", false)

  return { command: "delete", input: { path, recursive, permanent } }
}

function readPatches(input: unknown): DeviceFilePatch[] {
  if (!isRecord(input) || !Array.isArray(input.patches)) {
    throw new DeviceCommandValidationError(
      "invalid_patches",
      `Campo "patches" é obrigatório e deve ser uma lista de 1 a ${DEVICE_FILE_PATCH_MAX_COUNT} patches.`,
    )
  }

  if (
    input.patches.length === 0 ||
    input.patches.length > DEVICE_FILE_PATCH_MAX_COUNT
  ) {
    throw new DeviceCommandValidationError(
      "invalid_patches",
      `Informe entre 1 e ${DEVICE_FILE_PATCH_MAX_COUNT} patches.`,
    )
  }

  return input.patches.map((entry, index) => {
    if (!isRecord(entry)) {
      throw new DeviceCommandValidationError(
        "invalid_patches",
        `O patch ${index + 1} deve ser um objeto com oldText e newText.`,
      )
    }

    const oldText = readString(entry, "oldText", "invalid_oldText")
    const newText = readString(entry, "newText", "invalid_newText")
    const replaceAll = readBoolean(entry, "replaceAll", false)

    if (oldText.length === 0) {
      throw new DeviceCommandValidationError(
        "invalid_oldText",
        `O texto antigo do patch ${index + 1} não pode estar vazio.`,
      )
    }

    if (Buffer.byteLength(oldText, "utf8") > DEVICE_FILE_EDIT_MAX_OLD_TEXT) {
      throw new DeviceCommandValidationError(
        "invalid_oldText",
        `O texto antigo do patch ${index + 1} excede ${DEVICE_FILE_EDIT_MAX_OLD_TEXT} bytes.`,
      )
    }

    if (Buffer.byteLength(newText, "utf8") > DEVICE_FILE_EDIT_MAX_NEW_TEXT) {
      throw new DeviceCommandValidationError(
        "invalid_newText",
        `O texto novo do patch ${index + 1} excede ${DEVICE_FILE_EDIT_MAX_NEW_TEXT} bytes.`,
      )
    }

    return { oldText, newText, replaceAll }
  })
}

function parseApplyPatch(input: unknown): DeviceCommand {
  const path = readRequiredPath(input)
  const patches = readPatches(input)

  return { command: "apply-patch", input: { path, patches } }
}

function parseRunCommand(input: unknown): DeviceCommand {
  const command = readString(input, "command", "invalid_command_arg")

  if (command.length === 0) {
    throw new DeviceCommandValidationError(
      "invalid_command_arg",
      "O campo 'command' não pode estar vazio.",
    )
  }

  if (command.length > 256) {
    throw new DeviceCommandValidationError(
      "invalid_command_arg",
      "O comando excede o limite de 256 caracteres.",
    )
  }

  // Bloqueia caracteres de shell perigosos
  if (/[;&|`$<>(){}\[\]\\]/.test(command)) {
    throw new DeviceCommandValidationError(
      "invalid_command_arg",
      "O comando contém caracteres não permitidos.",
    )
  }

  const args: string[] = []
  let rawArgs: unknown

  if (typeof input === "object" && input !== null) {
    rawArgs = (input as Record<string, unknown>).args
  }

  if (rawArgs !== undefined && rawArgs !== null) {
    if (!Array.isArray(rawArgs)) {
      throw new DeviceCommandValidationError(
        "invalid_args",
        "O campo 'args' deve ser uma lista de strings.",
      )
    }

    for (let i = 0; i < rawArgs.length; i += 1) {
      const arg = rawArgs[i]

      if (typeof arg !== "string") {
        throw new DeviceCommandValidationError(
          "invalid_args",
          `O argumento ${i} deve ser uma string.`,
        )
      }

      if (arg.length > DEVICE_RUN_ARGS_MAX_LENGTH) {
        throw new DeviceCommandValidationError(
          "invalid_args",
          `O argumento ${i} excede o limite de ${DEVICE_RUN_ARGS_MAX_LENGTH} caracteres.`,
        )
      }

      // Bloqueia caracteres de shell perigosos nos argumentos
      if (/[;&|`$<>(){}\[\]\\]/.test(arg)) {
        throw new DeviceCommandValidationError(
          "invalid_args",
          `O argumento ${i} contém caracteres não permitidos.`,
        )
      }

      args.push(arg)
    }
  }

  const timeoutMs = readInteger(
    input,
    "timeoutMs",
    DEVICE_RUN_TIMEOUT_DEFAULT_MS,
    1_000,
    DEVICE_RUN_TIMEOUT_MAX_MS,
  )

  const cwd = readOptionalPath(input)

  return {
    command: "run-command",
    input: {
      command,
      ...(args.length > 0 ? { args } : {}),
      ...(timeoutMs !== DEVICE_RUN_TIMEOUT_DEFAULT_MS ? { timeoutMs } : {}),
      ...(cwd ? { cwd } : {}),
    },
  }
}

function readShellScript(input: unknown): string {
  const script = readString(input, "script", "invalid_script")

  if (script.trim().length === 0) {
    throw new DeviceCommandValidationError(
      "invalid_script",
      "O script não pode estar vazio.",
    )
  }

  if (script.length > DEVICE_SHELL_SCRIPT_MAX_LENGTH) {
    throw new DeviceCommandValidationError(
      "invalid_script",
      `O script excede o limite de ${DEVICE_SHELL_SCRIPT_MAX_LENGTH} caracteres.`,
    )
  }

  if (script.includes("\u0000")) {
    throw new DeviceCommandValidationError(
      "invalid_script",
      "O script contém bytes nulos.",
    )
  }

  return script
}

function readShellKind(input: unknown): DeviceShellKind {
  const rawShell = isRecord(input) ? input.shell : undefined

  if (rawShell === undefined || rawShell === null) {
    return "auto"
  }

  if (typeof rawShell !== "string" || !DEVICE_SHELL_KIND_SET.has(rawShell)) {
    throw new DeviceCommandValidationError(
      "invalid_shell",
      `Shell inválido. Use um de: ${DEVICE_SHELL_KINDS.join(", ")}.`,
    )
  }

  return rawShell as DeviceShellKind
}

function parseShell(input: unknown): DeviceCommand {
  const script = readShellScript(input)
  const kind = readShellKind(input)

  const timeoutMs = readInteger(
    input,
    "timeoutMs",
    DEVICE_SHELL_TIMEOUT_DEFAULT_MS,
    DEVICE_SHELL_TIMEOUT_MIN_MS,
    DEVICE_SHELL_TIMEOUT_MAX_MS,
  )
  const maxOutputBytes = readInteger(
    input,
    "maxOutputBytes",
    DEVICE_SHELL_OUTPUT_DEFAULT_BYTES,
    DEVICE_SHELL_OUTPUT_MIN_BYTES,
    DEVICE_SHELL_OUTPUT_MAX_BYTES,
  )
  const cwd = readOptionalPath(input, "cwd")
  const stdin = readOptionalShellStdin(input)
  const env = readShellEnv(input)

  return {
    command: "shell",
    input: {
      script,
      shell: kind,
      timeoutMs,
      maxOutputBytes,
      ...(cwd ? { cwd } : {}),
      ...(stdin === undefined ? {} : { stdin }),
      ...(env ? { env } : {}),
    },
  }
}

function readJobId(input: unknown): string {
  const value = readString(input, "jobId", "invalid_job_id").trim()

  if (value.length === 0) {
    throw new DeviceCommandValidationError(
      "invalid_job_id",
      "O id do job não pode estar vazio.",
    )
  }

  if (value.length > DEVICE_JOB_ID_MAX_LENGTH) {
    throw new DeviceCommandValidationError(
      "invalid_job_id",
      `O id do job excede o limite de ${DEVICE_JOB_ID_MAX_LENGTH} caracteres.`,
    )
  }

  if (/[\u0000-\u001f\u007f]/.test(value)) {
    throw new DeviceCommandValidationError(
      "invalid_job_id",
      "O id do job contém caracteres de controle.",
    )
  }

  return value
}

function parseJobStart(input: unknown): DeviceCommand {
  const script = readShellScript(input)
  const shell = readShellKind(input)
  const cwd = readOptionalPath(input, "cwd")
  const env = readShellEnv(input)
  const maxRuntimeMs = readInteger(
    input,
    "maxRuntimeMs",
    DEVICE_JOB_MAX_RUNTIME_DEFAULT_MS,
    DEVICE_JOB_MAX_RUNTIME_MIN_MS,
    DEVICE_JOB_MAX_RUNTIME_MS,
  )

  let label: string | undefined

  if (isRecord(input) && input.label !== undefined && input.label !== null) {
    if (typeof input.label !== "string") {
      throw new DeviceCommandValidationError(
        "invalid_label",
        'Campo "label" deve ser um texto.',
      )
    }

    const trimmed = input.label.trim()

    if (trimmed.length > DEVICE_JOB_LABEL_MAX_LENGTH) {
      throw new DeviceCommandValidationError(
        "invalid_label",
        `O rótulo excede o limite de ${DEVICE_JOB_LABEL_MAX_LENGTH} caracteres.`,
      )
    }

    if (/[\u0000-\u001f\u007f]/.test(trimmed)) {
      throw new DeviceCommandValidationError(
        "invalid_label",
        "O rótulo contém caracteres de controle.",
      )
    }

    if (trimmed.length > 0) {
      label = trimmed
    }
  }

  return {
    command: "job-start",
    input: {
      script,
      shell,
      maxRuntimeMs,
      ...(cwd ? { cwd } : {}),
      ...(env ? { env } : {}),
      ...(label ? { label } : {}),
    },
  }
}

function parseJobStatus(input: unknown): DeviceCommand {
  return {
    command: "job-status",
    input: { jobId: readJobId(input), waitMs: readJobWaitMs(input) },
  }
}

function parseJobCancel(input: unknown): DeviceCommand {
  return { command: "job-cancel", input: { jobId: readJobId(input) } }
}

function parseJobOutput(input: unknown): DeviceCommand {
  return {
    command: "job-output",
    input: {
      jobId: readJobId(input),
      cursor: readInteger(input, "cursor", 0, 0, Number.MAX_SAFE_INTEGER),
      maxBytes: readInteger(
        input,
        "maxBytes",
        DEVICE_JOB_OUTPUT_DEFAULT_BYTES,
        DEVICE_JOB_OUTPUT_MIN_BYTES,
        DEVICE_JOB_OUTPUT_MAX_BYTES,
      ),
      waitMs: readJobWaitMs(input),
    },
  }
}

/** Espera ativa opcional: 0 responde na hora; acima disso segura a chamada. */
function readJobWaitMs(input: unknown): number {
  return readInteger(
    input,
    "waitMs",
    DEVICE_JOB_WAIT_DEFAULT_MS,
    DEVICE_JOB_WAIT_MIN_MS,
    DEVICE_JOB_WAIT_MAX_MS,
  )
}

function parseJobList(): DeviceCommand {
  return { command: "job-list", input: {} }
}

function readOptionalShellStdin(input: unknown): string | undefined {
  if (!isRecord(input) || input.stdin === undefined || input.stdin === null) {
    return undefined
  }

  if (typeof input.stdin !== "string") {
    throw new DeviceCommandValidationError(
      "invalid_stdin",
      'Campo "stdin" deve ser um texto.',
    )
  }

  if (input.stdin.length > DEVICE_SHELL_STDIN_MAX_LENGTH) {
    throw new DeviceCommandValidationError(
      "invalid_stdin",
      `O stdin excede o limite de ${DEVICE_SHELL_STDIN_MAX_LENGTH} caracteres.`,
    )
  }

  return input.stdin
}

function readShellEnv(input: unknown): Record<string, string> | undefined {
  if (!isRecord(input) || input.env === undefined || input.env === null) {
    return undefined
  }

  if (!isRecord(input.env)) {
    throw new DeviceCommandValidationError(
      "invalid_env",
      'Campo "env" deve ser um objeto de string para string.',
    )
  }

  const entries = Object.entries(input.env)

  if (entries.length === 0) {
    return undefined
  }

  if (entries.length > DEVICE_SHELL_ENV_MAX_ENTRIES) {
    throw new DeviceCommandValidationError(
      "invalid_env",
      `O env aceita no máximo ${DEVICE_SHELL_ENV_MAX_ENTRIES} variáveis.`,
    )
  }

  const env: Record<string, string> = {}

  for (const [name, value] of entries) {
    if (!DEVICE_SHELL_ENV_NAME_PATTERN.test(name)) {
      throw new DeviceCommandValidationError(
        "invalid_env",
        `Nome de variável inválido: ${name}.`,
      )
    }

    if (typeof value !== "string") {
      throw new DeviceCommandValidationError(
        "invalid_env",
        `O valor de ${name} deve ser um texto.`,
      )
    }

    if (value.length > DEVICE_SHELL_ENV_VALUE_MAX_LENGTH) {
      throw new DeviceCommandValidationError(
        "invalid_env",
        `O valor de ${name} excede ${DEVICE_SHELL_ENV_VALUE_MAX_LENGTH} caracteres.`,
      )
    }

    env[name] = value
  }

  return env
}

function parseScreenshot(input: unknown): DeviceCommand {
  const monitor = readOptionalInteger(
    input,
    "monitor",
    0,
    DEVICE_SCREENSHOT_MONITOR_MAX,
  )
  const region = readScreenshotRegion(input)
  const windowId = readOptionalWindowId(input)

  if (
    (monitor !== undefined && region !== undefined) ||
    (windowId !== undefined &&
      (monitor !== undefined || region !== undefined))
  ) {
    throw new DeviceCommandValidationError(
      "invalid_region",
      "Use apenas um alvo por captura: windowId, monitor ou region.",
    )
  }

  const maxWidth = readInteger(
    input,
    "maxWidth",
    DEVICE_SCREENSHOT_MAX_WIDTH_DEFAULT,
    DEVICE_SCREENSHOT_MAX_WIDTH_MIN,
    DEVICE_SCREENSHOT_MAX_WIDTH_MAX,
  )
  const quality = readInteger(
    input,
    "quality",
    DEVICE_SCREENSHOT_QUALITY_DEFAULT,
    DEVICE_SCREENSHOT_QUALITY_MIN,
    DEVICE_SCREENSHOT_QUALITY_MAX,
  )
  const format = readScreenshotFormat(input)

  return {
    command: "screenshot",
    input: {
      ...(monitor !== undefined ? { monitor } : {}),
      ...(region ? { region } : {}),
      ...(windowId ? { windowId } : {}),
      maxWidth,
      quality,
      format,
    },
  }
}

function readScreenshotFormat(input: unknown): DeviceScreenshotFormat {
  if (
    !isRecord(input) ||
    input.format === undefined ||
    input.format === null
  ) {
    return "jpeg"
  }

  if (typeof input.format !== "string") {
    throw new DeviceCommandValidationError(
      "invalid_format",
      'Campo "format" deve ser "jpeg" ou "png".',
    )
  }

  const value = input.format.trim().toLowerCase()

  if (!DEVICE_SCREENSHOT_FORMAT_SET.has(value)) {
    throw new DeviceCommandValidationError(
      "invalid_format",
      'Formato inválido. Use "jpeg" ou "png".',
    )
  }

  return value as DeviceScreenshotFormat
}

function readScreenshotRegion(
  input: unknown,
): DeviceWindowBounds | undefined {
  if (!isRecord(input) || input.region === undefined || input.region === null) {
    return undefined
  }

  if (!isRecord(input.region)) {
    throw new DeviceCommandValidationError(
      "invalid_region",
      'Campo "region" deve ser um objeto com x, y, width e height.',
    )
  }

  const region = input.region

  const x = readRegionInteger(region, "x", -100_000, 100_000)
  const y = readRegionInteger(region, "y", -100_000, 100_000)
  const width = readRegionInteger(region, "width", 1, 100_000)
  const height = readRegionInteger(region, "height", 1, 100_000)

  return { x, y, width, height }
}

function readRegionInteger(
  region: Record<string, unknown>,
  field: string,
  min: number,
  max: number,
): number {
  const value = region[field]

  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new DeviceCommandValidationError(
      "invalid_region",
      `Campo "region.${field}" deve ser um número inteiro.`,
    )
  }

  const integer = Math.trunc(value)

  if (integer < min || integer > max) {
    throw new DeviceCommandValidationError(
      "invalid_region",
      `Campo "region.${field}" deve estar entre ${min} e ${max}.`,
    )
  }

  return integer
}

export function parseDeviceCommand(
  command: unknown,
  input: unknown,
): DeviceCommand {
  if (typeof command !== "string" || !isDeviceCommandName(command)) {
    throw new DeviceCommandValidationError(
      "invalid_command",
      "Comando de dispositivo desconhecido.",
    )
  }

  switch (command) {
    case "list-apps":
      return parseListApps(input)
    case "find-app":
      return parseFindApp(input)
    case "get-os":
      return { command, input: {} }
    case "get-env":
      return { command, input: {} }
    case "shell":
      return parseShell(input)
    case "open-url":
      return parseOpenUrl(input)
    case "open-app":
      return parseOpenApp(input)
    case "open-path":
      return parseOpenPath(input)
    case "register-app":
      return parseRegisterApp(input)
    case "remove-app":
      return parseRemoveApp(input)
    case "type-text":
      return parseTypeText(input)
    case "press-key":
      return parsePressKey(input)
    case "read-clipboard":
      return parseReadClipboard()
    case "write-clipboard":
      return parseWriteClipboard(input)
    case "move-mouse":
      return parseMoveMouse(input)
    case "click":
      return parseClick(input)
    case "scroll":
      return parseScroll(input)
    case "drag":
      return parseDrag(input)
    case "inspect-ui":
      return parseInspectUi(input)
    case "ui-action":
      return parseUiAction(input)
    case "list-files":
      return parseListFiles(input)
    case "read-file":
      return parseReadFile(input)
    case "read-files":
      return parseReadFiles(input)
    case "glob":
      return parseGlob(input)
    case "grep":
      return parseGrep(input)
    case "check-admin":
      return { command, input: {} }
    case "write-file":
      return parseWriteFile(input)
    case "write-files":
      return parseWriteFiles(input)
    case "edit-file":
      return parseEditFile(input)
    case "mkdir":
      return parseMkdir(input)
    case "stat":
      return parseStat(input)
    case "copy":
      return parseCopy(input)
    case "move":
      return parseMove(input)
    case "delete":
      return parseDelete(input)
    case "apply-patch":
      return parseApplyPatch(input)
    case "run-command":
      return parseRunCommand(input)
    case "job-start":
      return parseJobStart(input)
    case "job-status":
      return parseJobStatus(input)
    case "job-output":
      return parseJobOutput(input)
    case "job-cancel":
      return parseJobCancel(input)
    case "job-list":
      return parseJobList()
    case "screenshot":
      return parseScreenshot(input)
    case "list-windows":
      return parseListWindows(input)
    case "focus-window":
      return parseFocusWindow(input)
    case "minimize-window":
    case "maximize-window":
    case "restore-window":
    case "close-window":
      return parseWindowAction(command, input)
    case "list-processes":
      return parseListProcesses(input)
    case "kill-process":
      return parseKillProcess(input)
    case "get-system-status":
      return { command, input: {} }
    case "set-volume":
      return parseSetVolume(input)
    case "set-brightness":
      return parseSetBrightness(input)
    case "lock-screen":
      return { command, input: {} }
    case "power":
      return parsePower(input)
    case "media-control":
      return parseMediaControl(input)
  }
}
