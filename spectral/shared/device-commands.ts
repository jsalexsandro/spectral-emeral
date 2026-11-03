export const DEVICE_COMMAND_NAMES = [
  "open-url",
  "open-app",
  "list-apps",
  "get-os",
  "type-text",
  "press-key",
  "list-files",
  "read-file",
  "glob",
  "grep",
  "check-admin",
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

export type DeviceGrepMatch = {
  path: string
  line: number
  column: number
  text: string
}

export type DeviceCommandInputMap = {
  "open-url": { url: string }
  "open-app": { appId: string }
  "list-apps": Record<string, never>
  "get-os": Record<string, never>
  "type-text": { text: string }
  "press-key": { key: DeviceKey; modifiers: DeviceKeyModifier[] }
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

  return { command: "type-text", input: { text } }
}

function parsePressKey(input: unknown): DeviceCommand {
  const key = readString(input, "key", "invalid_key").trim().toLowerCase()

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

  return { command: "press-key", input: { key, modifiers } }
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
  }
}
