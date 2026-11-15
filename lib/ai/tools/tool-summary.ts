const MAX_SUMMARY_LENGTH = 120
const MAX_VALUE_LENGTH = 48

// Nomes literais para manter o módulo seguro no bundle do cliente: importar
// device-tools.ts arrastaria o cliente de comandos e o banco para o browser.
const DEVICE_UI_ACTION = "device-ui-action"
const DEVICE_INSPECT_UI = "device-inspect-ui"
const DEVICE_LIST_WINDOWS = "device-list-windows"
const DEVICE_FOCUS_WINDOW = "device-focus-window"
const DEVICE_WINDOW_ACTION = "device-window-action"
const DEVICE_LIST_PROCESSES = "device-list-processes"
const DEVICE_KILL_PROCESS = "device-kill-process"
const DEVICE_CLICK = "device-click"
const DEVICE_MOVE_MOUSE = "device-move-mouse"
const DEVICE_SCROLL = "device-scroll"
const DEVICE_DRAG = "device-drag"
const DEVICE_TYPE_TEXT = "device-type-text"
const DEVICE_PRESS_KEY = "device-press-key"
const DEVICE_OPEN_URL = "device-open-url"
const DEVICE_OPEN_APP = "device-open-app"
const DEVICE_OPEN_PATH = "device-open-path"
const DEVICE_REGISTER_APP = "device-register-app"
const DEVICE_REMOVE_APP = "device-remove-app"
const DEVICE_LIST_APPS = "device-list-apps"
const DEVICE_FIND_APP = "device-find-app"
const DEVICE_WRITE_CLIPBOARD = "device-write-clipboard"
const DEVICE_LIST_FILES = "device-list-files"
const DEVICE_READ_FILE = "device-read-file"
const DEVICE_WRITE_FILE = "device-write-file"
const DEVICE_EDIT_FILE = "device-edit-file"
const DEVICE_MKDIR = "device-mkdir"
const DEVICE_STAT = "device-stat"
const DEVICE_COPY = "device-copy"
const DEVICE_MOVE = "device-move"
const DEVICE_DELETE = "device-delete"
const DEVICE_APPLY_PATCH = "device-apply-patch"
const DEVICE_RUN_COMMAND = "device-run-command"
const DEVICE_ENV = "device-env"
const DEVICE_SHELL = "device-shell"
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

    case DEVICE_LIST_PROCESSES:
      summary = joinParts([
        readString(record, "query") && `"${readString(record, "query")}"`,
        `limite ${readNumber(record, "limit") ?? 40}`,
      ])
      break

    case DEVICE_KILL_PROCESS:
      summary = joinParts([
        `pid ${readNumber(record, "pid")}`,
        record.tree === true ? "árvore" : undefined,
        record.force === true ? "forçado" : undefined,
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

    case DEVICE_OPEN_APP: {
      const appId = readString(record, "appId")
      const path = readString(record, "path")
      const args = Array.isArray(record.args)
        ? record.args.filter((item): item is string => typeof item === "string")
        : []
      const cwd = readString(record, "cwd")

      return joinParts([
        appId,
        path ? (path.length > 40 ? `${path.slice(0, 39)}…` : path) : undefined,
        args.length > 0 ? `args: ${args.map((item) => truncate(item)).join(" ")}` : undefined,
        cwd ? `cwd: ${cwd}` : undefined,
      ])
    }

    case DEVICE_OPEN_PATH: {
      const path = readString(record, "path")

      return path ? (path.length > 60 ? `${path.slice(0, 59)}…` : path) : ""
    }

    case DEVICE_REGISTER_APP: {
      const name = readString(record, "name")
      const path = readString(record, "path")
      const cwd = readString(record, "cwd")

      return joinParts([
        name ? `"${truncate(name, 30)}"` : undefined,
        path ? `→ ${path}` : undefined,
        cwd ? `cwd: ${cwd}` : undefined,
      ])
    }

    case DEVICE_REMOVE_APP: {
      const appId = readString(record, "appId")

      return appId ? `remover ${appId}` : ""
    }

    case DEVICE_LIST_APPS: {
      const query = readString(record, "query")
      summary = joinParts([
        query ? `"${query}"` : undefined,
        record.refresh === true ? "atualizado" : undefined,
      ])
      break
    }

    case DEVICE_FIND_APP: {
      const query = readString(record, "query")
      summary = joinParts([
        query ? `"${query}"` : undefined,
        record.refresh === true ? "atualizado" : undefined,
      ])
      break
    }

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
    case DEVICE_MKDIR:
    case DEVICE_STAT:
      summary = joinParts([readString(record, "path")])
      break

    case DEVICE_COPY:
    case DEVICE_MOVE: {
      const from = readString(record, "from")
      const to = readString(record, "to")
      summary = from && to ? `${from} → ${to}` : joinParts([from, to])
      break
    }

    case DEVICE_DELETE: {
      const permanent = record.permanent === true
      const recursive = record.recursive === true
      summary = joinParts([
        readString(record, "path"),
        permanent ? "permanente" : "lixeira",
        recursive ? "recursivo" : undefined,
      ])
      break
    }

    case DEVICE_APPLY_PATCH: {
      const patches = Array.isArray(record.patches) ? record.patches.length : 0
      summary = joinParts([
        readString(record, "path"),
        patches > 0 ? `${patches} ${patches === 1 ? "patch" : "patches"}` : undefined,
      ])
      break
    }

    case DEVICE_RUN_COMMAND: {
      const command = readString(record, "command")
      summary = command ? `"${truncate(command, 50)}"` : ""
      break
    }

    case DEVICE_ENV:
      summary = "ambiente da máquina"
      break

    case DEVICE_SHELL: {
      const script = readString(record, "script")
      const shell = readString(record, "shell")

      summary = joinParts([
        shell && shell !== "auto" ? shell : undefined,
        script ? `"${truncate(script, 60)}"` : undefined,
      ])
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
