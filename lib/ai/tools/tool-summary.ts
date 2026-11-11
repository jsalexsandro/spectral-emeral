const MAX_SUMMARY_LENGTH = 120
const MAX_VALUE_LENGTH = 48

// Nomes literais para manter o módulo seguro no bundle do cliente: importar
// device-tools.ts arrastaria o cliente de comandos e o banco para o browser.
const DEVICE_UI_ACTION = "device-ui-action"
const DEVICE_INSPECT_UI = "device-inspect-ui"
const DEVICE_LIST_WINDOWS = "device-list-windows"
const DEVICE_FOCUS_WINDOW = "device-focus-window"
const DEVICE_WINDOW_ACTION = "device-window-action"
const DEVICE_CLICK = "device-click"
const DEVICE_MOVE_MOUSE = "device-move-mouse"
const DEVICE_SCROLL = "device-scroll"
const DEVICE_DRAG = "device-drag"
const DEVICE_TYPE_TEXT = "device-type-text"
const DEVICE_PRESS_KEY = "device-press-key"
const DEVICE_OPEN_URL = "device-open-url"
const DEVICE_OPEN_APP = "device-open-app"
const DEVICE_WRITE_CLIPBOARD = "device-write-clipboard"
const DEVICE_LIST_FILES = "device-list-files"
const DEVICE_READ_FILE = "device-read-file"
const DEVICE_WRITE_FILE = "device-write-file"
const DEVICE_EDIT_FILE = "device-edit-file"
const DEVICE_RUN_COMMAND = "device-run-command"
const DEVICE_SCREENSHOT = "device-screenshot"

type InputRecord = Record<string, unknown>

function asRecord(value: unknown): InputRecord | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null
  }

  return value as InputRecord
}

function readString(record: InputRecord, key: string): string | undefined {
  const value = record[key]

  if (typeof value !== "string") {
    return undefined
  }

  const trimmed = value.trim()

  return trimmed.length > 0 ? trimmed : undefined
}

function readNumber(record: InputRecord, key: string): number | undefined {
  const value = record[key]

  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

function truncate(value: string, max = MAX_VALUE_LENGTH): string {
  const collapsed = value.replace(/\s+/g, " ").trim()

  return collapsed.length <= max
    ? collapsed
    : `${collapsed.slice(0, max - 1)}…`
}

function formatValue(value: unknown): string {
  if (typeof value === "string") {
    return truncate(value)
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }

  if (value === null) {
    return "null"
  }

  try {
    return truncate(JSON.stringify(value))
  } catch {
    return "?"
  }
}

function joinParts(parts: Array<string | undefined>): string {
  return parts.filter((part): part is string => Boolean(part)).join(" · ")
}

function point(record: InputRecord, key: string): string | undefined {
  const value = asRecord(record[key])

  if (!value) {
    return undefined
  }

  const x = readNumber(value, "x")
  const y = readNumber(value, "y")

  return x !== undefined && y !== undefined ? `${x},${y}` : undefined
}

function coords(record: InputRecord): string | undefined {
  const x = readNumber(record, "x")
  const y = readNumber(record, "y")

  return x !== undefined && y !== undefined ? `${x},${y}` : undefined
}

function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return truncate(url)
  }
}

function summarizeMouseButton(record: InputRecord): string | undefined {
  const button = readString(record, "button")

  return button && button !== "left" ? button : undefined
}

function summarizeCount(record: InputRecord): string | undefined {
  const count = readNumber(record, "count")

  return count && count > 1 ? `${count}x` : undefined
}

/**
 * Resume os argumentos de uma tool em uma linha curta para exibir no chat.
 * Retorna string vazia quando não há argumentos relevantes.
 */
export function summarizeToolInput(
  toolName: string,
  input: unknown,
): string {
  const record = asRecord(input)

  if (!record) {
    return ""
  }

  let summary: string

  switch (toolName) {
    case DEVICE_UI_ACTION: {
      const action = readString(record, "action")
      const rawValue = record.value
      const value =
        action === "setValue" && typeof rawValue === "string"
          ? `"${truncate(rawValue, 40)}"`
          : undefined

      summary = joinParts([
        action,
        readString(record, "runtimeId"),
        value,
      ])
      break
    }

    case DEVICE_INSPECT_UI: {
      const waitMs = readNumber(record, "waitMs")

      summary = joinParts([
        readString(record, "role") && `role: ${readString(record, "role")}`,
        readString(record, "find") && `"${readString(record, "find")}"`,
        readString(record, "windowId") &&
          `janela ${readString(record, "windowId")}`,
        waitMs && waitMs > 0 ? `espera ${waitMs}ms` : undefined,
      ])
      break
    }

    case DEVICE_LIST_WINDOWS:
      summary = record.includeMinimized === true ? "inclui minimizadas" : "visíveis"
      break

    case DEVICE_FOCUS_WINDOW:
      summary = joinParts([
        readString(record, "windowId") &&
          `janela ${readString(record, "windowId")}`,
      ])
      break

    case DEVICE_WINDOW_ACTION:
      summary = joinParts([
        readString(record, "action"),
        readString(record, "windowId") &&
          `janela ${readString(record, "windowId")}`,
      ])
      break

    case DEVICE_CLICK:
      summary = joinParts([
        coords(record),
        summarizeMouseButton(record),
        summarizeCount(record),
      ])
      break

    case DEVICE_MOVE_MOUSE:
      summary = joinParts([coords(record)])
      break

    case DEVICE_SCROLL:
      summary = joinParts([
        readString(record, "direction"),
        readNumber(record, "amount") !== undefined
          ? String(readNumber(record, "amount"))
          : undefined,
      ])
      break

    case DEVICE_DRAG: {
      const from = point(record, "from")
      const to = point(record, "to")
      summary = from && to ? `${from} → ${to}` : ""
      break
    }

    case DEVICE_TYPE_TEXT: {
      const text = readString(record, "text")
      summary = text ? `"${truncate(text, 40)}"` : ""
      break
    }

    case DEVICE_PRESS_KEY: {
      const modifiers = Array.isArray(record.modifiers)
        ? record.modifiers.filter(
            (item): item is string => typeof item === "string",
          )
        : []
      summary = joinParts([
        readString(record, "key"),
        modifiers.length > 0 ? modifiers.join("+") : undefined,
      ])
      break
    }

    case DEVICE_OPEN_URL: {
      const url = readString(record, "url")
      summary = url ? hostOf(url) : ""
      break
    }

    case DEVICE_OPEN_APP:
      summary = joinParts([readString(record, "appId")])
      break

    case DEVICE_WRITE_CLIPBOARD: {
      const text = readString(record, "text")
      summary = text ? `${text.length} caracteres` : ""
      break
    }

    case DEVICE_LIST_FILES:
      summary = joinParts([
        readString(record, "path"),
        readNumber(record, "depth") !== undefined
          ? `depth ${readNumber(record, "depth")}`
          : undefined,
      ])
      break

    case DEVICE_READ_FILE:
      summary = joinParts([
        readString(record, "path"),
        readNumber(record, "lines") !== undefined
          ? `${readNumber(record, "lines")} linhas`
          : undefined,
      ])
      break

    case DEVICE_WRITE_FILE:
    case DEVICE_EDIT_FILE:
      summary = joinParts([readString(record, "path")])
      break

    case DEVICE_RUN_COMMAND: {
      const command = readString(record, "command")
      summary = command ? `"${truncate(command, 50)}"` : ""
      break
    }

    case DEVICE_SCREENSHOT:
      summary = joinParts([
        readString(record, "windowId") &&
          `janela ${readString(record, "windowId")}`,
        readNumber(record, "monitor") !== undefined
          ? `monitor ${readNumber(record, "monitor")}`
          : undefined,
      ])
      break

    default: {
      const entries = Object.entries(record)
        .slice(0, 3)
        .map(([key, value]) => `${key}=${formatValue(value)}`)

      summary = entries.join(", ")
    }
  }

  return summary.length <= MAX_SUMMARY_LENGTH
    ? summary
    : `${summary.slice(0, MAX_SUMMARY_LENGTH - 1)}…`
}
