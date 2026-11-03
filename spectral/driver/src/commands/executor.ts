import { execFile, spawn } from "node:child_process"
import { promisify } from "node:util"
import {
  type DeviceCommand,
  type DeviceCommandResult,
  type DeviceKey,
  type DeviceKeyModifier,
} from "../../../shared/device-commands.js"
import { findApp, getAppTarget, listApps } from "./apps.js"
import { getOsInfo } from "./system.js"
import {
  DeviceFileError,
  getDefaultFileSandbox,
} from "./files.js"

const execFileAsync = promisify(execFile)
const EXEC_TIMEOUT_MS = 10_000
const MAX_BUFFER_BYTES = 1024 * 1024
const MAX_ERROR_LENGTH = 900

const files = getDefaultFileSandbox()

function errorMessage(error: unknown): string {
  const message =
    error instanceof Error && error.message
      ? error.message
      : "Falha ao executar o comando no dispositivo."

  return message.slice(0, MAX_ERROR_LENGTH)
}

export class DeviceCommandExecutionError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = "DeviceCommandExecutionError"
    this.code = code
  }
}

function unsupported(message: string): DeviceCommandExecutionError {
  return new DeviceCommandExecutionError("unsupported_platform", message)
}

function launch(file: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    })

    child.once("error", reject)
    child.once("spawn", () => {
      child.unref()
      resolve()
    })
  })
}

async function run(file: string, args: string[], env?: NodeJS.ProcessEnv) {
  await execFileAsync(file, args, {
    timeout: EXEC_TIMEOUT_MS,
    windowsHide: true,
    maxBuffer: MAX_BUFFER_BYTES,
    env: env ?? process.env,
  })
}

const SENDKEYS_SPECIAL = new Set([
  "+",
  "^",
  "%",
  "~",
  "(",
  ")",
  "{",
  "}",
  "[",
  "]",
])

function escapeSendKeys(text: string): string {
  const normalized = text.replace(/\r\n/g, "\n")
  let result = ""

  for (const char of normalized) {
    if (char === "\n" || char === "\r") {
      result += "{ENTER}"
      continue
    }

    if (char === "\t") {
      result += "{TAB}"
      continue
    }

    result += SENDKEYS_SPECIAL.has(char) ? "{" + char + "}" : char
  }

  return result
}

const SENDKEYS_TOKENS: Record<string, string> = {
  enter: "{ENTER}",
  tab: "{TAB}",
  escape: "{ESC}",
  backspace: "{BACKSPACE}",
  delete: "{DELETE}",
  space: " ",
  insert: "{INSERT}",
  arrowup: "{UP}",
  arrowdown: "{DOWN}",
  arrowleft: "{LEFT}",
  arrowright: "{RIGHT}",
  home: "{HOME}",
  end: "{END}",
  pageup: "{PGUP}",
  pagedown: "{PGDN}",
  f1: "{F1}",
  f2: "{F2}",
  f3: "{F3}",
  f4: "{F4}",
  f5: "{F5}",
  f6: "{F6}",
  f7: "{F7}",
  f8: "{F8}",
  f9: "{F9}",
  f10: "{F10}",
  f11: "{F11}",
  f12: "{F12}",
}

function sendKeysToken(key: DeviceKey): string {
  return SENDKEYS_TOKENS[key] ?? key
}

function sendKeysPrefix(modifiers: readonly DeviceKeyModifier[]): string {
  let prefix = ""

  if (modifiers.includes("ctrl")) {
    prefix += "^"
  }

  if (modifiers.includes("alt")) {
    prefix += "%"
  }

  if (modifiers.includes("shift")) {
    prefix += "+"
  }

  return prefix
}

const POWERSHELL_SENDKEYS_SCRIPT = [
  "Add-Type -AssemblyName System.Windows.Forms",
  "[System.Windows.Forms.SendKeys]::SendWait($env:SPECTRAL_SENDKEYS)",
].join("\n")

async function sendKeysWindows(value: string): Promise<void> {
  await run(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", POWERSHELL_SENDKEYS_SCRIPT],
    { ...process.env, SPECTRAL_SENDKEYS: value },
  )
}

const DARWIN_KEY_CODES: Record<string, number> = {
  enter: 36,
  tab: 48,
  escape: 53,
  backspace: 51,
  delete: 117,
  space: 49,
  insert: 114,
  arrowleft: 123,
  arrowright: 124,
  arrowdown: 125,
  arrowup: 126,
  home: 115,
  end: 119,
  pageup: 116,
  pagedown: 121,
  f1: 122,
  f2: 120,
  f3: 99,
  f4: 118,
  f5: 96,
  f6: 97,
  f7: 98,
  f8: 100,
  f9: 101,
  f10: 109,
  f11: 103,
  f12: 111,
}

const DARWIN_MODIFIERS: Record<DeviceKeyModifier, string> = {
  ctrl: "control down",
  alt: "option down",
  shift: "shift down",
  meta: "command down",
}

function darwinModifierList(modifiers: readonly DeviceKeyModifier[]): string {
  if (modifiers.length === 0) {
    return ""
  }

  return " using {" + modifiers.map((item) => DARWIN_MODIFIERS[item]).join(", ") + "}"
}

function darwinPressKeyScript(
  key: DeviceKey,
  modifiers: readonly DeviceKeyModifier[],
): string {
  const suffix = darwinModifierList(modifiers)
  const keyCode = DARWIN_KEY_CODES[key]

  if (keyCode !== undefined) {
    return (
      'tell application "System Events" to key code ' +
      keyCode +
      suffix
    )
  }

  return 'tell application "System Events" to keystroke "' + key + '"' + suffix
}

const LINUX_KEYS: Record<string, string> = {
  enter: "Return",
  tab: "Tab",
  escape: "Escape",
  backspace: "BackSpace",
  delete: "Delete",
  space: "space",
  insert: "Insert",
  arrowup: "Up",
  arrowdown: "Down",
  arrowleft: "Left",
  arrowright: "Right",
  home: "Home",
  end: "End",
  pageup: "Prior",
  pagedown: "Next",
  f1: "F1",
  f2: "F2",
  f3: "F3",
  f4: "F4",
  f5: "F5",
  f6: "F6",
  f7: "F7",
  f8: "F8",
  f9: "F9",
  f10: "F10",
  f11: "F11",
  f12: "F12",
}

const LINUX_MODIFIERS: Record<DeviceKeyModifier, string> = {
  ctrl: "ctrl",
  alt: "alt",
  shift: "shift",
  meta: "super",
}

function linuxCombo(
  key: DeviceKey,
  modifiers: readonly DeviceKeyModifier[],
): string {
  const parts = modifiers.map((item) => LINUX_MODIFIERS[item])
  parts.push(LINUX_KEYS[key] ?? key)
  return parts.join("+")
}

async function openUrl(url: string): Promise<void> {
  if (process.platform === "win32") {
    await launch("rundll32.exe", ["url.dll,FileProtocolHandler", url])
    return
  }

  if (process.platform === "darwin") {
    await launch("open", [url])
    return
  }

  if (process.platform === "linux") {
    await launch("xdg-open", [url])
    return
  }

  throw unsupported("Abrir URLs não é suportado nesta plataforma.")
}

async function openApp(appId: string): Promise<string> {
  const app = findApp(appId)

  if (!app) {
    throw new DeviceCommandExecutionError(
      "app_not_allowed",
      "Aplicativo não permitido.",
    )
  }

  const target = getAppTarget(app)

  if (!target) {
    throw unsupported("Este aplicativo não está disponível nesta plataforma.")
  }

  if (process.platform === "win32") {
    await launch("cmd.exe", ["/c", "start", "", target])
    return app.name
  }

  if (process.platform === "darwin") {
    await launch("open", ["-a", target])
    return app.name
  }

  if (process.platform === "linux") {
    await launch(target, [])
    return app.name
  }

  throw unsupported("Abrir aplicativos não é suportado nesta plataforma.")
}

async function typeText(text: string): Promise<void> {
  const safe = escapeSendKeys(text)

  console.log(
    `[driver] typeText: length=${text.length} platform=${process.platform}`,
  )

  if (process.platform === "win32") {
    await sendKeysWindows(safe)
    return
  }

  if (process.platform === "darwin") {
    await run("osascript", [
      "-e",
      'on run argv\n  tell application "System Events" to keystroke (item 1 of argv)\nend run',
      text,
    ])
    return
  }

  if (process.platform === "linux") {
    await run("xdotool", ["type", "--clearmodifiers", "--", text])
    return
  }

  throw unsupported("Digitação não é suportada nesta plataforma.")
}

async function pressKey(
  key: DeviceKey,
  modifiers: readonly DeviceKeyModifier[],
): Promise<void> {
  const combo = sendKeysPrefix(modifiers) + sendKeysToken(key)

  console.log(
    `[driver] pressKey: key="${key}" modifiers=${JSON.stringify(
      modifiers,
    )} combo="${combo}" platform=${process.platform}`,
  )

  if (process.platform === "win32") {
    if (modifiers.includes("meta")) {
      throw unsupported("A tecla Windows não é suportada no Windows.")
    }

    await sendKeysWindows(combo)
    return
  }

  if (process.platform === "darwin") {
    await run("osascript", ["-e", darwinPressKeyScript(key, modifiers)])
    return
  }

  if (process.platform === "linux") {
    await run("xdotool", [
      "key",
      "--clearmodifiers",
      "--",
      linuxCombo(key, modifiers),
    ])
    return
  }

  throw unsupported("Teclas não são suportadas nesta plataforma.")
}

export async function executeDeviceCommand(
  command: DeviceCommand,
): Promise<DeviceCommandResult> {
  try {
    switch (command.command) {
      case "list-apps":
        return { ok: true, apps: listApps() }
      case "get-os":
        return { ok: true, os: getOsInfo() }
      case "open-url":
        await openUrl(command.input.url)
        return { ok: true }
      case "open-app": {
        const name = await openApp(command.input.appId)
        return { ok: true, output: "Aplicativo aberto: " + name }
      }
      case "type-text":
        await typeText(command.input.text)
        return { ok: true }
      case "press-key":
        await pressKey(command.input.key, command.input.modifiers)
        return { ok: true }

      case "list-files":
        return { ...(await files.listFiles(command.input)), ok: true }
      case "read-file":
        return { ...(await files.readFile(command.input)), ok: true }
      case "glob":
        return { ...(await files.glob(command.input)), ok: true }
      case "grep":
        return { ...(await files.grep(command.input)), ok: true }

      case "check-admin": {
        const admin = getOsInfo().elevated
        return { ok: true, admin }
      }

      case "write-file":
        return { ...(await files.writeFile(command.input)), ok: true }

      case "edit-file":
        return { ...(await files.editFile(command.input)), ok: true }
    }
  } catch (error) {
    if (error instanceof DeviceFileError) {
      return { ok: false, code: error.code, error: errorMessage(error) }
    }

    if (error instanceof DeviceCommandExecutionError) {
      return { ok: false, code: error.code, error: errorMessage(error) }
    }

    return {
      ok: false,
      code: "command_failed",
      error: errorMessage(error),
    }
  }
}
