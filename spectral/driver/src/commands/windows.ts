import { execFile } from "node:child_process"
import { readFile } from "node:fs/promises"
import { promisify } from "node:util"
import {
  DEVICE_WINDOW_ID_MAX_LENGTH,
  DEVICE_WINDOW_LIMIT_MAX,
  DEVICE_WINDOW_PROCESS_NAME_MAX_LENGTH,
  DEVICE_WINDOW_TITLE_MAX_LENGTH,
  type DeviceCommandInputMap,
  type DeviceWindow,
  type DeviceWindowBounds,
} from "../../../shared/device-commands.js"

const execFileAsync = promisify(execFile)
const WINDOW_EXEC_TIMEOUT_MS = 8_000
const WINDOW_MAX_BUFFER_BYTES = 1024 * 1024
const WINDOW_ID_PATTERN = /^[A-Za-z0-9:._-]+$/

export type { DeviceWindow } from "../../../shared/device-commands.js"

export class DeviceWindowError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = "DeviceWindowError"
    this.code = code
  }
}

type RawWindow = Record<string, unknown>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function clampText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") {
    return ""
  }

  const normalized = value.replace(/\s+/g, " ").trim()

  if (normalized.length <= maxLength) {
    return normalized
  }

  return `${normalized.slice(0, maxLength - 1)}…`
}

function toInteger(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.trunc(value)
    : fallback
}

function toBounds(raw: RawWindow): DeviceWindowBounds | null {
  if (isRecord(raw.bounds)) {
    return {
      x: toInteger(raw.bounds.x),
      y: toInteger(raw.bounds.y),
      width: toInteger(raw.bounds.width),
      height: toInteger(raw.bounds.height),
    }
  }

  if (
    raw.x === undefined &&
    raw.y === undefined &&
    raw.width === undefined &&
    raw.height === undefined
  ) {
    return null
  }

  return {
    x: toInteger(raw.x),
    y: toInteger(raw.y),
    width: toInteger(raw.width),
    height: toInteger(raw.height),
  }
}

function normalizeWindow(raw: unknown): DeviceWindow | null {
  if (!isRecord(raw)) {
    return null
  }

  const id = typeof raw.id === "string" ? raw.id.trim() : ""
  const title = clampText(raw.title, DEVICE_WINDOW_TITLE_MAX_LENGTH)

  if (
    !id ||
    !title ||
    id.length > DEVICE_WINDOW_ID_MAX_LENGTH ||
    !WINDOW_ID_PATTERN.test(id)
  ) {
    return null
  }

  return {
    id,
    title,
    processId: Math.max(0, toInteger(raw.processId)),
    processName: clampText(
      raw.processName,
      DEVICE_WINDOW_PROCESS_NAME_MAX_LENGTH,
    ),
    bounds: toBounds(raw),
    focused: raw.focused === true,
    minimized: raw.minimized === true,
  }
}

function normalizeWindows(raw: unknown): DeviceWindow[] {
  if (!Array.isArray(raw)) {
    return []
  }

  return raw
    .map((item) => normalizeWindow(item))
    .filter((item): item is DeviceWindow => item !== null)
}

function execErrorCode(error: unknown): string | number | undefined {
  if (!isRecord(error)) {
    return undefined
  }

  const code = error.code
  return typeof code === "string" || typeof code === "number" ? code : undefined
}

function execErrorText(error: unknown): string {
  if (!isRecord(error)) {
    return ""
  }

  return [error.stderr, error.message]
    .filter((value): value is string => typeof value === "string")
    .join("\n")
}

/* -------------------------------------------------------------------------- */
/* Windows                                                                    */
/* -------------------------------------------------------------------------- */

const WINDOWS_WINDOW_API = `
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;

public class SpectralWindows {
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

  [DllImport("user32.dll")]
  public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
  [DllImport("user32.dll")]
  public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")]
  public static extern bool IsIconic(IntPtr hWnd);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
  [DllImport("user32.dll")]
  public static extern int GetWindowTextLength(IntPtr hWnd);
  [DllImport("user32.dll")]
  public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
  [DllImport("user32.dll")]
  public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
  [DllImport("user32.dll")]
  public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")]
  public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")]
  public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")]
  public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int x, int y, int cx, int cy, uint flags);
  [DllImport("user32.dll")]
  public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
  [DllImport("user32.dll")]
  public static extern void SwitchToThisWindow(IntPtr hWnd, bool fAltTab);

  [StructLayout(LayoutKind.Sequential)]
  public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }

  public class WindowInfo {
    public string id;
    public string title;
    public int processId;
    public string processName;
    public int x;
    public int y;
    public int width;
    public int height;
    public bool focused;
    public bool minimized;
  }

  public static WindowInfo[] GetWindows() {
    var list = new List<WindowInfo>();
    IntPtr foreground = GetForegroundWindow();
    EnumWindows(delegate(IntPtr hWnd, IntPtr lParam) {
      if (!IsWindowVisible(hWnd)) return true;
      int length = GetWindowTextLength(hWnd);
      if (length <= 0) return true;
      var buffer = new StringBuilder(length + 1);
      GetWindowText(hWnd, buffer, buffer.Capacity);
      uint processId;
      GetWindowThreadProcessId(hWnd, out processId);
      RECT rect;
      GetWindowRect(hWnd, out rect);
      list.Add(new WindowInfo {
        id = hWnd.ToInt64().ToString(),
        title = buffer.ToString(),
        processId = (int)processId,
        processName = "",
        x = rect.Left,
        y = rect.Top,
        width = rect.Right - rect.Left,
        height = rect.Bottom - rect.Top,
        focused = hWnd == foreground,
        minimized = IsIconic(hWnd)
      });
      return true;
    }, IntPtr.Zero);
    return list.ToArray();
  }

  public static bool Focus(long handle) {
    IntPtr hWnd = new IntPtr(handle);
    if (IsIconic(hWnd)) {
      ShowWindow(hWnd, 9);
    } else if (!IsWindowVisible(hWnd)) {
      ShowWindow(hWnd, 5);
    }

    if (SetForegroundWindow(hWnd) && GetForegroundWindow() == hWnd) {
      return true;
    }

    // O Windows bloqueia roubo de foco de processos em segundo plano. Simular
    // um toque de ALT libera a chamada seguinte de SetForegroundWindow.
    keybd_event(0x12, 0, 0, UIntPtr.Zero);
    keybd_event(0x12, 0, 2, UIntPtr.Zero);

    const uint flags = 0x0001 | 0x0002 | 0x0040;

    SetWindowPos(hWnd, new IntPtr(-1), 0, 0, 0, 0, flags);
    SetWindowPos(hWnd, new IntPtr(-2), 0, 0, 0, 0, flags);

    SetForegroundWindow(hWnd);
    SwitchToThisWindow(hWnd, true);

    return GetForegroundWindow() == hWnd;
  }

  public static bool IsFocused(long handle) {
    return GetForegroundWindow() == new IntPtr(handle);
  }

  public static int ProcessId(long handle) {
    uint processId;
    GetWindowThreadProcessId(new IntPtr(handle), out processId);
    return (int)processId;
  }
}
'@
`

const WINDOWS_LIST_SCRIPT = `${WINDOWS_WINDOW_API}
$items = [SpectralWindows]::GetWindows()
$processNames = @{}
Get-Process -ErrorAction SilentlyContinue | ForEach-Object { $processNames[$_.Id] = $_.ProcessName }
foreach ($item in $items) {
  if ($processNames.ContainsKey($item.processId)) { $item.processName = $processNames[$item.processId] }
}
$items | Select-Object id,title,processId,processName,x,y,width,height,focused,minimized | ConvertTo-Json -Compress -Depth 4
`

const WINDOWS_FOCUS_SCRIPT = `${WINDOWS_WINDOW_API}
$handle = [long]$env:SPECTRAL_WINDOW_ID
$focused = [SpectralWindows]::Focus($handle)
if (-not $focused) {
  try {
    $processId = [SpectralWindows]::ProcessId($handle)
    $shell = New-Object -ComObject WScript.Shell
    [void]$shell.AppActivate($processId)
    Start-Sleep -Milliseconds 200
    $focused = [SpectralWindows]::IsFocused($handle)
  } catch {
    $focused = $false
  }
}
if (-not $focused) { exit 3 }
`

function parseJsonWindows(stdout: string): DeviceWindow[] {
  const trimmed = stdout.trim()

  if (!trimmed) {
    return []
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(trimmed)
  } catch {
    throw new DeviceWindowError(
      "invalid_driver_output",
      "O driver não conseguiu interpretar a lista de janelas do sistema.",
    )
  }

  return normalizeWindows(Array.isArray(parsed) ? parsed : [parsed])
}

async function listWindowsWindows(): Promise<DeviceWindow[]> {
  try {
    const { stdout } = await execFileAsync(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        WINDOWS_LIST_SCRIPT,
      ],
      {
        timeout: WINDOW_EXEC_TIMEOUT_MS,
        windowsHide: true,
        maxBuffer: WINDOW_MAX_BUFFER_BYTES,
      },
    )

    return parseJsonWindows(stdout)
  } catch (error) {
    throw windowExecError(error, "listar as janelas")
  }
}

async function focusWindowsWindow(windowId: string): Promise<void> {
  try {
    await execFileAsync(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        WINDOWS_FOCUS_SCRIPT,
      ],
      {
        timeout: WINDOW_EXEC_TIMEOUT_MS,
        windowsHide: true,
        maxBuffer: WINDOW_MAX_BUFFER_BYTES,
        env: { ...process.env, SPECTRAL_WINDOW_ID: windowId },
      },
    )
  } catch (error) {
    if (execErrorCode(error) === 3) {
      throw new DeviceWindowError(
        "focus_denied",
        "O Windows bloqueou o foco nesta janela. Tente clicar nela manualmente.",
      )
    }

    throw windowExecError(error, "focar a janela")
  }
}

/* -------------------------------------------------------------------------- */
/* macOS                                                                      */
/* -------------------------------------------------------------------------- */

const MACOS_LIST_SCRIPT = `
function run() {
  var SystemEvents = Application('System Events');
  var processes = SystemEvents.applicationProcesses.whose({ visible: true })();
  var result = [];
  var failures = 0;

  for (var i = 0; i < processes.length; i++) {
    var process = processes[i];
    var pid = 0;
    var name = '';
    var frontmost = false;

    try { pid = process.unixId(); } catch (error) { continue; }
    try { name = process.name(); } catch (error) {}
    try { frontmost = process.frontmost(); } catch (error) {}

    var windows = [];

    try {
      windows = process.windows();
    } catch (error) {
      failures++;
      continue;
    }

    for (var j = 0; j < windows.length; j++) {
      var window = windows[j];
      var title = '';

      try { title = window.name() || ''; } catch (error) { continue; }
      if (!title) { continue; }

      var x = 0;
      var y = 0;
      var width = 0;
      var height = 0;

      try { var position = window.position(); x = position[0]; y = position[1]; } catch (error) {}
      try { var size = window.size(); width = size[0]; height = size[1]; } catch (error) {}

      result.push({
        id: pid + ':' + j,
        title: title,
        processId: pid,
        processName: name,
        x: x,
        y: y,
        width: width,
        height: height,
        focused: frontmost,
        minimized: false
      });
    }
  }

  if (result.length === 0 && failures > 0) {
    throw new Error('permission_denied');
  }

  return JSON.stringify(result);
}
`

const MACOS_FOCUS_SCRIPT = (windowId: string) => `
function run() {
  var parts = '${windowId}'.split(':');
  var pid = parseInt(parts[0], 10);
  var index = parseInt(parts[1], 10);

  if (!isFinite(pid)) { return 'window_not_found'; }

  var SystemEvents = Application('System Events');
  var processes = SystemEvents.applicationProcesses.whose({ unixId: pid })();

  if (!processes.length) { return 'window_not_found'; }

  var process = processes[0];
  process.frontmost = true;

  try {
    var windows = process.windows();
    var target = windows[index];

    if (target) {
      try { target.attributes.byName('AXRaise').value = true; } catch (error) {}
    }
  } catch (error) {}

  return 'ok';
}
`

function macosError(error: unknown): DeviceWindowError {
  const text = execErrorText(error)

  if (/permission_denied|assistive access|-1719|-1728|-25211/i.test(text)) {
    return new DeviceWindowError(
      "permission_denied",
      "O macOS exige permissão de Acessibilidade para listar e focar janelas. Autorize o driver em Ajustes do Sistema → Privacidade e Segurança → Acessibilidade.",
    )
  }

  return new DeviceWindowError(
    "command_failed",
    "Não foi possível acessar as janelas do macOS.",
  )
}

async function listWindowsMacos(): Promise<DeviceWindow[]> {
  let stdout: string

  try {
    const result = await execFileAsync(
      "osascript",
      ["-l", "JavaScript", "-e", MACOS_LIST_SCRIPT],
      {
        timeout: WINDOW_EXEC_TIMEOUT_MS,
        maxBuffer: WINDOW_MAX_BUFFER_BYTES,
      },
    )

    stdout = result.stdout
  } catch (error) {
    throw macosError(error)
  }

  return parseJsonWindows(stdout)
}

async function focusMacosWindow(windowId: string): Promise<void> {
  let stdout: string

  try {
    const result = await execFileAsync(
      "osascript",
      ["-l", "JavaScript", "-e", MACOS_FOCUS_SCRIPT(windowId)],
      {
        timeout: WINDOW_EXEC_TIMEOUT_MS,
        maxBuffer: WINDOW_MAX_BUFFER_BYTES,
      },
    )

    stdout = result.stdout
  } catch (error) {
    throw macosError(error)
  }

  if (stdout.trim() === "window_not_found") {
    throw new DeviceWindowError(
      "window_not_found",
      "A janela não está mais disponível no dispositivo.",
    )
  }
}

/* -------------------------------------------------------------------------- */
/* Linux                                                                      */
/* -------------------------------------------------------------------------- */

function isWayland(): boolean {
  return (
    process.platform === "linux" &&
    (process.env.XDG_SESSION_TYPE === "wayland" ||
      Boolean(process.env.WAYLAND_DISPLAY))
  )
}

function normalizeX11Id(value: string): string {
  const trimmed = value.trim()
  const parsed = trimmed.startsWith("0x") || trimmed.startsWith("0X")
    ? Number.parseInt(trimmed.slice(2), 16)
    : Number.parseInt(trimmed, 10)

  return Number.isFinite(parsed) ? `0x${parsed.toString(16)}` : trimmed
}

async function readLinuxProcessName(pid: number): Promise<string> {
  if (!Number.isFinite(pid) || pid <= 0) {
    return ""
  }

  try {
    const value = await readFile(`/proc/${pid}/comm`, "utf8")
    return value.trim()
  } catch {
    return ""
  }
}

async function getLinuxActiveWindowId(): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("xdotool", ["getactivewindow"], {
      timeout: WINDOW_EXEC_TIMEOUT_MS,
      maxBuffer: WINDOW_MAX_BUFFER_BYTES,
    })

    const value = stdout.trim()
    return value ? normalizeX11Id(value) : null
  } catch {
    // xdotool é opcional; tenta xprop abaixo.
  }

  try {
    const { stdout } = await execFileAsync(
      "xprop",
      ["-root", "_NET_ACTIVE_WINDOW"],
      {
        timeout: WINDOW_EXEC_TIMEOUT_MS,
        maxBuffer: WINDOW_MAX_BUFFER_BYTES,
      },
    )

    const match = stdout.match(/(0x[0-9a-fA-F]+)/)
    return match?.[1] ? normalizeX11Id(match[1]) : null
  } catch {
    return null
  }
}

async function listWindowsLinux(): Promise<DeviceWindow[]> {
  if (isWayland()) {
    throw new DeviceWindowError(
      "unsupported_environment",
      "A listagem de janelas no Linux exige uma sessão X11. No Wayland o sistema não permite enumerar janelas globalmente.",
    )
  }

  let stdout: string

  try {
    const result = await execFileAsync("wmctrl", ["-l", "-p", "-G"], {
      timeout: WINDOW_EXEC_TIMEOUT_MS,
      maxBuffer: WINDOW_MAX_BUFFER_BYTES,
    })

    stdout = result.stdout
  } catch (error) {
    if (execErrorCode(error) === "ENOENT") {
      throw new DeviceWindowError(
        "dependency_missing",
        "O comando wmctrl não está instalado. Instale com `sudo apt install wmctrl` para listar janelas no Linux.",
      )
    }

    throw new DeviceWindowError(
      "command_failed",
      "Não foi possível listar as janelas do Linux.",
    )
  }

  const activeId = await getLinuxActiveWindowId()
  const linePattern =
    /^(0x[0-9a-fA-F]+)\s+(-?\d+)\s+(\d+)\s+(-?\d+)\s+(-?\d+)\s+(\d+)\s+(\d+)\s+(\S+)\s+(.*)$/

  const windows = await Promise.all(
    stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map(async (line) => {
        const match = linePattern.exec(line)

        if (!match) {
          return null
        }

        const [, id, , pidText, x, y, width, height, , title] = match

        if (
          !id ||
          !pidText ||
          !x ||
          !y ||
          !width ||
          !height ||
          title === undefined
        ) {
          return null
        }

        const processId = Number.parseInt(pidText, 10)

        return {
          id: normalizeX11Id(id),
          title,
          processId,
          processName: await readLinuxProcessName(processId),
          x: Number.parseInt(x, 10),
          y: Number.parseInt(y, 10),
          width: Number.parseInt(width, 10),
          height: Number.parseInt(height, 10),
          focused: activeId !== null && normalizeX11Id(id) === activeId,
          minimized: false,
        }
      }),
  )

  return normalizeWindows(windows.filter(Boolean))
}

async function focusLinuxWindow(windowId: string): Promise<void> {
  if (isWayland()) {
    throw new DeviceWindowError(
      "unsupported_environment",
      "Focar janelas no Linux exige uma sessão X11. No Wayland o sistema não permite controlar janelas globalmente.",
    )
  }

  try {
    await execFileAsync("wmctrl", ["-ia", windowId], {
      timeout: WINDOW_EXEC_TIMEOUT_MS,
      maxBuffer: WINDOW_MAX_BUFFER_BYTES,
    })
  } catch (error) {
    if (execErrorCode(error) === "ENOENT") {
      throw new DeviceWindowError(
        "dependency_missing",
        "O comando wmctrl não está instalado. Instale com `sudo apt install wmctrl` para focar janelas no Linux.",
      )
    }

    throw new DeviceWindowError(
      "focus_denied",
      "Não foi possível focar a janela no Linux.",
    )
  }
}

/* -------------------------------------------------------------------------- */
/* Platform dispatch                                                          */
/* -------------------------------------------------------------------------- */

function windowExecError(error: unknown, action: string): DeviceWindowError {
  if (execErrorCode(error) === "ENOENT") {
    return new DeviceWindowError(
      "dependency_missing",
      `Não foi possível ${action}: dependência do sistema não encontrada.`,
    )
  }

  return new DeviceWindowError(
    "command_failed",
    `Não foi possível ${action} no dispositivo.`,
  )
}

async function listPlatformWindows(): Promise<DeviceWindow[]> {
  switch (process.platform) {
    case "win32":
      return listWindowsWindows()
    case "darwin":
      return listWindowsMacos()
    case "linux":
      return listWindowsLinux()
    default:
      throw new DeviceWindowError(
        "unsupported_platform",
        "Listar janelas não é suportado nesta plataforma.",
      )
  }
}

async function focusPlatformWindow(windowId: string): Promise<void> {
  switch (process.platform) {
    case "win32":
      await focusWindowsWindow(windowId)
      return
    case "darwin":
      await focusMacosWindow(windowId)
      return
    case "linux":
      await focusLinuxWindow(windowId)
      return
    default:
      throw new DeviceWindowError(
        "unsupported_platform",
        "Focar janelas não é suportado nesta plataforma.",
      )
  }
}

export async function listWindows(
  input: DeviceCommandInputMap["list-windows"],
): Promise<DeviceWindow[]> {
  const windows = await listPlatformWindows()
  const seen = new Set<string>()
  const result: DeviceWindow[] = []

  for (const window of windows) {
    if (seen.has(window.id)) {
      continue
    }

    if (!input.includeMinimized && window.minimized) {
      continue
    }

    seen.add(window.id)
    result.push(window)

    if (result.length >= input.limit) {
      break
    }
  }

  return result
}

export async function focusWindow(windowId: string): Promise<DeviceWindow> {
  const windows = await listPlatformWindows()
  const target = windows.find((window) => window.id === windowId)

  if (!target) {
    throw new DeviceWindowError(
      "window_not_found",
      "A janela não está mais disponível no dispositivo.",
    )
  }

  await focusPlatformWindow(windowId)

  return { ...target, focused: true }
}
