export const DEVICE_COMMAND_NAMES = [
  "open-url",
  "open-app",
  "list-apps",
  "get-os",
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
  "glob",
  "grep",
  "check-admin",
  "write-file",
  "edit-file",
  "run-command",
  "screenshot",
  "list-windows",
  "focus-window",
  "minimize-window",
  "maximize-window",
  "restore-window",
  "close-window",
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

export const DEVICE_UI_ACTIONS = [
  "invoke",
  "select",
  "toggle",
  "expand",
  "collapse",
  "focus",
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

export type DeviceMouseButton = (typeof DEVICE_MOUSE_BUTTONS)[number]
export type DeviceMouseScrollDirection =
  (typeof DEVICE_MOUSE_SCROLL_DIRECTIONS)[number]

export const DEVICE_APP_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,39}$/
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
export const DEVICE_FILE_EDIT_MAX_BYTES = 1024 * 1024
export const DEVICE_FILE_EDIT_MAX_OLD_TEXT = 10 * 1024
export const DEVICE_FILE_EDIT_MAX_NEW_TEXT = 10 * 1024
export const DEVICE_RUN_TIMEOUT_DEFAULT_MS = 15_000
export const DEVICE_RUN_TIMEOUT_MAX_MS = 60_000
export const DEVICE_RUN_OUTPUT_MAX_BYTES = 64 * 1024
export const DEVICE_RUN_ARGS_MAX_LENGTH = 1024

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

export type DeviceAppInfo = {
  id: string
  name: string
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
  truncated: boolean
}

export type DeviceUiActionResult = {
  windowId: string
  action: DeviceUiAction
  element: DeviceUiElement
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

export type DeviceFileEditResult = {
  path: string
  replacements: number
  oldTextLength: number
  newTextLength: number
}

export type DeviceCommandRunResult = {
  command: string
  exitCode: number | null
  stdout: string
  stderr: string
  durationMs: number
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
  "open-app": { appId: string }
  "list-apps": Record<string, never>
  "get-os": Record<string, never>
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
  "inspect-ui": {
    windowId: string
    find?: string
    role?: string
    maxResults: number
    depth: number
    includeOffscreen: boolean
  }
  "ui-action": {
    windowId: string
    runtimeId: string
    action: DeviceUiAction
  }
  "list-files": {
    path?: string
    depth: number
    showHidden: boolean
    maxEntries: number
  }
  "read-file": { path: string; offset: number; limit: number }
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
  "edit-file": {
    path: string
    oldText: string
    newText: string
  }
  "run-command": {
    command: string
    args?: string[]
    timeoutMs?: number
    cwd?: string
  }
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

export type DeviceCommandSuccess = {
  ok: true
  output?: string
  apps?: DeviceAppInfo[]
  os?: DeviceOsInfo
  entries?: DeviceFileEntry[]
  file?: DeviceFileContent
  paths?: string[]
  matches?: DeviceGrepMatch[]
  truncated?: boolean
  total?: number
  filesScanned?: number
  admin?: boolean
  write?: DeviceFileWriteResult
  edit?: DeviceFileEditResult
  run?: DeviceCommandRunResult
  windows?: DeviceWindow[]
  window?: DeviceWindow
  screenshot?: DeviceScreenshot
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

function parseOpenApp(input: unknown): DeviceCommand {
  const appId = readString(input, "appId", "invalid_app")
    .trim()
    .toLowerCase()

  if (!DEVICE_APP_ID_PATTERN.test(appId)) {
    throw new DeviceCommandValidationError(
      "invalid_app",
      "Identificador de aplicativo inválido.",
    )
  }

  return { command: "open-app", input: { appId } }
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

  return {
    command: "inspect-ui",
    input: {
      windowId,
      ...(find ? { find } : {}),
      ...(role ? { role } : {}),
      maxResults,
      depth,
      includeOffscreen,
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

  return {
    command: "ui-action",
    input: {
      windowId,
      runtimeId,
      action: rawAction as DeviceUiAction,
    },
  }
}

function readOptionalPath(input: unknown): string | undefined {
  if (!isRecord(input) || input.path === undefined || input.path === null) {
    return undefined
  }

  if (typeof input.path !== "string") {
    throw new DeviceCommandValidationError(
      "invalid_path",
      'Campo "path" deve ser um texto.',
    )
  }

  const value = input.path.trim()

  if (value.length === 0) {
    return undefined
  }

  if (value.length > DEVICE_PATH_MAX_LENGTH) {
    throw new DeviceCommandValidationError(
      "invalid_path",
      `O caminho deve ter no máximo ${DEVICE_PATH_MAX_LENGTH} caracteres.`,
    )
  }

  if (/[\u0000-\u001f\u007f]/.test(value)) {
    throw new DeviceCommandValidationError(
      "invalid_path",
      "O caminho contém caracteres de controle não suportados.",
    )
  }

  return value
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
  max: number,
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

  if (integer < min || integer > max) {
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
      return { command, input: {} }
    case "get-os":
      return { command, input: {} }
    case "open-url":
      return parseOpenUrl(input)
    case "open-app":
      return parseOpenApp(input)
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
    case "glob":
      return parseGlob(input)
    case "grep":
      return parseGrep(input)
    case "check-admin":
      return { command, input: {} }
    case "write-file":
      return parseWriteFile(input)
    case "edit-file":
      return parseEditFile(input)
    case "run-command":
      return parseRunCommand(input)
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
  }
}
