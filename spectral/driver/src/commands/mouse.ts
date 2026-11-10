import { execFile } from "node:child_process"
import { promisify } from "node:util"
import type {
  DeviceCommandInputMap,
  DeviceMouseButton,
  DeviceMouseScrollDirection,
} from "../../../shared/device-commands.js"

const execFileAsync = promisify(execFile)

const MOUSE_TIMEOUT_MS = 10_000
const MOUSE_MAX_BUFFER_BYTES = 1024 * 1024

export class DeviceMouseError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = "DeviceMouseError"
    this.code = code
  }
}

type MoveInput = DeviceCommandInputMap["move-mouse"]
type ClickInput = DeviceCommandInputMap["click"]
type ScrollInput = DeviceCommandInputMap["scroll"]
type DragInput = DeviceCommandInputMap["drag"]

function isWayland(): boolean {
  return (
    process.env.XDG_SESSION_TYPE === "wayland" ||
    Boolean(process.env.WAYLAND_DISPLAY)
  )
}

function errorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code)
    : undefined
}

function errorText(error: unknown): string {
  if (typeof error !== "object" || error === null) {
    return ""
  }

  const stderr = (error as { stderr?: unknown }).stderr

  if (typeof stderr === "string" && stderr.trim()) {
    return stderr.trim().slice(0, 500)
  }

  const message = (error as { message?: unknown }).message

  return typeof message === "string" ? message.trim().slice(0, 500) : ""
}

/* -------------------------------------------------------------------------- */
/* Windows                                                                    */
/* -------------------------------------------------------------------------- */

const WINDOWS_MOUSE_SCRIPT = `
$ErrorActionPreference = 'Stop'

Add-Type @"
using System;
using System.Runtime.InteropServices;

public static class SpectralMouse {
  [DllImport("user32.dll", SetLastError = true)]
  public static extern bool SetCursorPos(int x, int y);

  [DllImport("user32.dll", SetLastError = true)]
  public static extern void mouse_event(uint flags, int dx, int dy, int data, UIntPtr extraInfo);

  [DllImport("user32.dll")]
  public static extern bool SetProcessDPIAware();

  [DllImport("user32.dll")]
  public static extern bool SetProcessDpiAwarenessContext(IntPtr value);

  public static void EnableDpiAwareness() {
    try {
      if (SetProcessDpiAwarenessContext(new IntPtr(-4))) return;
    } catch {}
    try { SetProcessDPIAware(); } catch {}
  }
}
"@

[void][SpectralMouse]::EnableDpiAwareness()

$LEFT_DOWN = 0x0002
$LEFT_UP = 0x0004
$RIGHT_DOWN = 0x0008
$RIGHT_UP = 0x0010
$MIDDLE_DOWN = 0x0020
$MIDDLE_UP = 0x0040
$WHEEL = 0x0800
$HWHEEL = 0x1000

function Move-To([int]$x, [int]$y) {
  if (-not [SpectralMouse]::SetCursorPos($x, $y)) {
    throw "Não foi possível mover o cursor para $x,$y."
  }
}

function Send-Mouse([uint32]$flags, [int]$data = 0) {
  [SpectralMouse]::mouse_event($flags, 0, 0, $data, [UIntPtr]::Zero)
}

function Get-ButtonFlags([string]$button) {
  if ($button -eq 'right') {
    return @($RIGHT_DOWN, $RIGHT_UP)
  }

  if ($button -eq 'middle') {
    return @($MIDDLE_DOWN, $MIDDLE_UP)
  }

  return @($LEFT_DOWN, $LEFT_UP)
}

$action = $env:SPECTRAL_MOUSE_ACTION

if ($env:SPECTRAL_MOUSE_X) {
  Move-To ([int]$env:SPECTRAL_MOUSE_X) ([int]$env:SPECTRAL_MOUSE_Y)
}

switch ($action) {
  'move' {
    break
  }
  'click' {
    $flags = Get-ButtonFlags $env:SPECTRAL_MOUSE_BUTTON
    $count = [int]$env:SPECTRAL_MOUSE_COUNT

    for ($i = 0; $i -lt $count; $i++) {
      Send-Mouse $flags[0]
      Send-Mouse $flags[1]

      if ($i -lt $count - 1) {
        Start-Sleep -Milliseconds 80
      }
    }
  }
  'scroll' {
    $amount = [int]$env:SPECTRAL_MOUSE_AMOUNT
    $direction = $env:SPECTRAL_MOUSE_DIRECTION
    $flags = $WHEEL
    $delta = 120

    if ($direction -eq 'down') {
      $delta = -120
    } elseif ($direction -eq 'left') {
      $flags = $HWHEEL
      $delta = -120
    } elseif ($direction -eq 'right') {
      $flags = $HWHEEL
      $delta = 120
    }

    for ($i = 0; $i -lt $amount; $i++) {
      Send-Mouse $flags $delta
      Start-Sleep -Milliseconds 20
    }
  }
  'drag' {
    $flags = Get-ButtonFlags $env:SPECTRAL_MOUSE_BUTTON
    $fromX = [int]$env:SPECTRAL_MOUSE_FROM_X
    $fromY = [int]$env:SPECTRAL_MOUSE_FROM_Y
    $toX = [int]$env:SPECTRAL_MOUSE_TO_X
    $toY = [int]$env:SPECTRAL_MOUSE_TO_Y
    $duration = [int]$env:SPECTRAL_MOUSE_DURATION_MS

    Move-To $fromX $fromY
    Send-Mouse $flags[0]

    $steps = [Math]::Max(10, [Math]::Ceiling($duration / 20))
    $delay = [Math]::Max(1, [Math]::Floor($duration / $steps))

    for ($i = 1; $i -le $steps; $i++) {
      $ratio = $i / $steps
      $x = [int][Math]::Round($fromX + ($toX - $fromX) * $ratio)
      $y = [int][Math]::Round($fromY + ($toY - $fromY) * $ratio)
      Move-To $x $y

      if ($i -lt $steps) {
        Start-Sleep -Milliseconds $delay
      }
    }

    Send-Mouse $flags[1]
  }
  default {
    throw "Ação de mouse desconhecida: $action."
  }
}
`

type WindowsAction = {
  action: "move" | "click" | "scroll" | "drag"
  x?: number
  y?: number
  button?: DeviceMouseButton
  count?: number
  direction?: DeviceMouseScrollDirection
  amount?: number
  from?: { x: number; y: number }
  to?: { x: number; y: number }
  durationMs?: number
}

async function runWindows(action: WindowsAction): Promise<void> {
  const env: Record<string, string> = {
    ...process.env,
    SPECTRAL_MOUSE_ACTION: action.action,
  }

  if (action.x !== undefined && action.y !== undefined) {
    env.SPECTRAL_MOUSE_X = String(action.x)
    env.SPECTRAL_MOUSE_Y = String(action.y)
  }

  if (action.button) {
    env.SPECTRAL_MOUSE_BUTTON = action.button
  }

  if (action.count !== undefined) {
    env.SPECTRAL_MOUSE_COUNT = String(action.count)
  }

  if (action.direction) {
    env.SPECTRAL_MOUSE_DIRECTION = action.direction
  }

  if (action.amount !== undefined) {
    env.SPECTRAL_MOUSE_AMOUNT = String(action.amount)
  }

  if (action.from && action.to) {
    env.SPECTRAL_MOUSE_FROM_X = String(action.from.x)
    env.SPECTRAL_MOUSE_FROM_Y = String(action.from.y)
    env.SPECTRAL_MOUSE_TO_X = String(action.to.x)
    env.SPECTRAL_MOUSE_TO_Y = String(action.to.y)
  }

  if (action.durationMs !== undefined) {
    env.SPECTRAL_MOUSE_DURATION_MS = String(action.durationMs)
  }

  try {
    await execFileAsync(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        WINDOWS_MOUSE_SCRIPT,
      ],
      {
        timeout: MOUSE_TIMEOUT_MS,
        maxBuffer: MOUSE_MAX_BUFFER_BYTES,
        windowsHide: true,
        env,
      },
    )
  } catch (error) {
    throw new DeviceMouseError(
      "mouse_action_failed",
      `Não foi possível controlar o mouse no Windows: ${errorText(error) || "erro desconhecido"}.`,
    )
  }
}

/* -------------------------------------------------------------------------- */
/* macOS                                                                      */
/* -------------------------------------------------------------------------- */

const MACOS_MOUSE_SCRIPT = `
ObjC.import('Foundation')
ObjC.import('CoreGraphics')
ObjC.import('ApplicationServices')

function readEnv(name) {
  var value = $.NSProcessInfo.processInfo.environment.objectForKey(name)
  return value.isNil() ? undefined : ObjC.unwrap(value)
}

function fail(code, message) {
  var error = new Error(message)
  error.code = code
  throw error
}

if (
  typeof $.CGPreflightPostEventAccess === 'function' &&
  !$.CGPreflightPostEventAccess()
) {
  fail(
    'permission_denied',
    'O macOS exige permissão de Acessibilidade para controlar o mouse.'
  )
} else if (
  typeof $.AXIsProcessTrusted === 'function' &&
  !$.AXIsProcessTrusted()
) {
  fail(
    'permission_denied',
    'O macOS exige permissão de Acessibilidade para controlar o mouse.'
  )
}

function point(x, y) {
  return $.CGPointMake(x, y)
}

function post(event) {
  $.CGEventPost($.kCGHIDEventTap, event)
}

function moveTo(x, y) {
  post($.CGEventCreateMouseEvent(null, $.kCGEventMouseMoved, point(x, y), $.kCGMouseButtonLeft))
}

function buttonInfo(button) {
  if (button === 'right') {
    return {
      down: $.kCGEventRightMouseDown,
      up: $.kCGEventRightMouseUp,
      drag: $.kCGEventRightMouseDragged,
      button: $.kCGMouseButtonRight,
    }
  }

  if (button === 'middle') {
    return {
      down: $.kCGEventOtherMouseDown,
      up: $.kCGEventOtherMouseUp,
      drag: $.kCGEventOtherMouseDragged,
      button: $.kCGMouseButtonCenter,
    }
  }

  return {
    down: $.kCGEventLeftMouseDown,
    up: $.kCGEventLeftMouseUp,
    drag: $.kCGEventLeftMouseDragged,
    button: $.kCGMouseButtonLeft,
  }
}

function clickEvent(type, x, y, button, count) {
  var event = $.CGEventCreateMouseEvent(null, type, point(x, y), button)
  $.CGEventSetIntegerValueField(event, $.kCGMouseEventClickState, count)
  post(event)
}

var action = readEnv('SPECTRAL_MOUSE_ACTION')

if (readEnv('SPECTRAL_MOUSE_X') !== undefined) {
  moveTo(
    Number(readEnv('SPECTRAL_MOUSE_X')),
    Number(readEnv('SPECTRAL_MOUSE_Y'))
  )
}

if (action === 'move') {
  $.exit(0)
}

if (action === 'click') {
  var info = buttonInfo(readEnv('SPECTRAL_MOUSE_BUTTON'))
  var count = Number(readEnv('SPECTRAL_MOUSE_COUNT'))
  var x = Number(readEnv('SPECTRAL_MOUSE_X') || 0)
  var y = Number(readEnv('SPECTRAL_MOUSE_Y') || 0)

  if (readEnv('SPECTRAL_MOUSE_X') === undefined) {
    var current = $.CGEventGetLocation($.CGEventCreate(null))
    x = current.x
    y = current.y
  }

  for (var i = 0; i < count; i++) {
    clickEvent(info.down, x, y, info.button, i + 1)
    clickEvent(info.up, x, y, info.button, i + 1)

    if (i < count - 1) {
      $.NSThread.sleepForTimeInterval(0.08)
    }
  }

  $.exit(0)
}

if (action === 'scroll') {
  var direction = readEnv('SPECTRAL_MOUSE_DIRECTION')
  var amount = Number(readEnv('SPECTRAL_MOUSE_AMOUNT'))
  var vertical = 0
  var horizontal = 0

  if (direction === 'up') {
    vertical = amount
  } else if (direction === 'down') {
    vertical = -amount
  } else if (direction === 'left') {
    horizontal = -amount
  } else if (direction === 'right') {
    horizontal = amount
  }

  var scroll = $.CGEventCreate(null)
  $.CGEventSetIntegerValueField(scroll, $.kCGScrollWheelEventDeltaAxis1, vertical)
  $.CGEventSetIntegerValueField(scroll, $.kCGScrollWheelEventDeltaAxis2, horizontal)
  $.CGEventSetIntegerValueField(scroll, $.kCGScrollWheelEventIsContinuous, 0)
  post(scroll)
  $.exit(0)
}

if (action === 'drag') {
  var dragInfo = buttonInfo(readEnv('SPECTRAL_MOUSE_BUTTON'))
  var fromX = Number(readEnv('SPECTRAL_MOUSE_FROM_X'))
  var fromY = Number(readEnv('SPECTRAL_MOUSE_FROM_Y'))
  var toX = Number(readEnv('SPECTRAL_MOUSE_TO_X'))
  var toY = Number(readEnv('SPECTRAL_MOUSE_TO_Y'))
  var duration = Number(readEnv('SPECTRAL_MOUSE_DURATION_MS'))

  moveTo(fromX, fromY)
  clickEvent(dragInfo.down, fromX, fromY, dragInfo.button, 1)

  var steps = Math.max(10, Math.ceil(duration / 20))
  var delay = Math.max(0.001, duration / steps / 1000)

  for (var step = 1; step <= steps; step++) {
    var ratio = step / steps
    var x = Math.round(fromX + (toX - fromX) * ratio)
    var y = Math.round(fromY + (toY - fromY) * ratio)
    var dragEvent = $.CGEventCreateMouseEvent(
      null,
      dragInfo.drag,
      point(x, y),
      dragInfo.button
    )
    $.CGEventSetIntegerValueField(dragEvent, $.kCGMouseEventClickState, 1)
    post(dragEvent)
    $.NSThread.sleepForTimeInterval(delay)
  }

  clickEvent(dragInfo.up, toX, toY, dragInfo.button, 1)
  $.exit(0)
}

fail('mouse_action_failed', 'Ação de mouse desconhecida: ' + action)
`

type MacosAction = {
  action: "move" | "click" | "scroll" | "drag"
  x?: number
  y?: number
  button?: DeviceMouseButton
  count?: number
  direction?: DeviceMouseScrollDirection
  amount?: number
  from?: { x: number; y: number }
  to?: { x: number; y: number }
  durationMs?: number
}

async function runMacos(action: MacosAction): Promise<void> {
  const env: Record<string, string> = {
    ...process.env,
    SPECTRAL_MOUSE_ACTION: action.action,
  }

  if (action.x !== undefined && action.y !== undefined) {
    env.SPECTRAL_MOUSE_X = String(action.x)
    env.SPECTRAL_MOUSE_Y = String(action.y)
  }

  if (action.button) {
    env.SPECTRAL_MOUSE_BUTTON = action.button
  }

  if (action.count !== undefined) {
    env.SPECTRAL_MOUSE_COUNT = String(action.count)
  }

  if (action.direction) {
    env.SPECTRAL_MOUSE_DIRECTION = action.direction
  }

  if (action.amount !== undefined) {
    env.SPECTRAL_MOUSE_AMOUNT = String(action.amount)
  }

  if (action.from && action.to) {
    env.SPECTRAL_MOUSE_FROM_X = String(action.from.x)
    env.SPECTRAL_MOUSE_FROM_Y = String(action.from.y)
    env.SPECTRAL_MOUSE_TO_X = String(action.to.x)
    env.SPECTRAL_MOUSE_TO_Y = String(action.to.y)
  }

  if (action.durationMs !== undefined) {
    env.SPECTRAL_MOUSE_DURATION_MS = String(action.durationMs)
  }

  try {
    await execFileAsync(
      "osascript",
      ["-l", "JavaScript", "-e", MACOS_MOUSE_SCRIPT],
      {
        timeout: MOUSE_TIMEOUT_MS,
        maxBuffer: MOUSE_MAX_BUFFER_BYTES,
        env,
      },
    )
  } catch (error) {
    const text = errorText(error)

    if (text.includes("permission_denied") || /assistive|accessibility/i.test(text)) {
      throw new DeviceMouseError(
        "permission_denied",
        "O macOS exige permissão de Acessibilidade para controlar o mouse.",
      )
    }

    throw new DeviceMouseError(
      "mouse_action_failed",
      `Não foi possível controlar o mouse no macOS: ${text || "erro desconhecido"}.`,
    )
  }
}

/* -------------------------------------------------------------------------- */
/* Linux                                                                      */
/* -------------------------------------------------------------------------- */

const XDOTOOL_BUTTONS: Record<DeviceMouseButton, string> = {
  left: "1",
  middle: "2",
  right: "3",
}

const XDOTOOL_SCROLL_BUTTONS: Record<DeviceMouseScrollDirection, string> = {
  up: "4",
  down: "5",
  left: "6",
  right: "7",
}

async function runXdotool(args: string[]): Promise<void> {
  try {
    await execFileAsync("xdotool", args, {
      timeout: MOUSE_TIMEOUT_MS,
      maxBuffer: MOUSE_MAX_BUFFER_BYTES,
      windowsHide: true,
    })
  } catch (error) {
    if (errorCode(error) === "ENOENT") {
      throw new DeviceMouseError(
        "dependency_missing",
        "O controle de mouse no Linux X11 exige o pacote xdotool. Instale xdotool para habilitar.",
      )
    }

    const text = errorText(error)

    if (/cannot open display|unable to open display/i.test(text)) {
      throw new DeviceMouseError(
        "unsupported_environment",
        "Não há sessão gráfica X11 disponível para controlar o mouse.",
      )
    }

    throw new DeviceMouseError(
      "mouse_action_failed",
      `Não foi possível controlar o mouse no Linux: ${text || "erro desconhecido"}.`,
    )
  }
}

function assertLinuxDisplay(): void {
  if (isWayland()) {
    throw new DeviceMouseError(
      "unsupported_environment",
      "O controle de mouse não é suportado no Wayland nesta versão.",
    )
  }

  if (!process.env.DISPLAY) {
    throw new DeviceMouseError(
      "unsupported_environment",
      "Não há sessão gráfica disponível para controlar o mouse.",
    )
  }
}

async function runLinux(action: WindowsAction): Promise<void> {
  assertLinuxDisplay()

  if (action.action === "move") {
    await runXdotool([
      "mousemove",
      String(action.x ?? 0),
      String(action.y ?? 0),
    ])
    return
  }

  if (action.action === "click") {
    if (action.x !== undefined && action.y !== undefined) {
      await runXdotool(["mousemove", String(action.x), String(action.y)])
    }

    await runXdotool([
      "click",
      "--repeat",
      String(action.count ?? 1),
      "--delay",
      "80",
      XDOTOOL_BUTTONS[action.button ?? "left"],
    ])
    return
  }

  if (action.action === "scroll") {
    if (action.x !== undefined && action.y !== undefined) {
      await runXdotool(["mousemove", String(action.x), String(action.y)])
    }

    await runXdotool([
      "click",
      "--repeat",
      String(action.amount ?? 1),
      "--delay",
      "20",
      XDOTOOL_SCROLL_BUTTONS[action.direction ?? "down"],
    ])
    return
  }

  const from = action.from ?? { x: 0, y: 0 }
  const to = action.to ?? { x: 0, y: 0 }
  const button = XDOTOOL_BUTTONS[action.button ?? "left"]
  const duration = action.durationMs ?? 500
  const steps = Math.max(10, Math.ceil(duration / 20))
  const delay = Math.max(0.001, duration / steps / 1000).toFixed(3)
  const args = ["mousemove", String(from.x), String(from.y), "mousedown", button]

  for (let step = 1; step <= steps; step++) {
    const ratio = step / steps
    const x = Math.round(from.x + (to.x - from.x) * ratio)
    const y = Math.round(from.y + (to.y - from.y) * ratio)
    args.push("mousemove", String(x), String(y), "sleep", delay)
  }

  args.push("mouseup", button)
  await runXdotool(args)
}

/* -------------------------------------------------------------------------- */
/* API pública                                                                */
/* -------------------------------------------------------------------------- */

async function run(
  platform: NodeJS.Platform,
  action: WindowsAction,
): Promise<void> {
  try {
    if (platform === "win32") {
      await runWindows(action)
      return
    }

    if (platform === "darwin") {
      await runMacos(action)
      return
    }

    if (platform === "linux") {
      await runLinux(action)
      return
    }

    throw new DeviceMouseError(
      "unsupported_environment",
      "O controle de mouse não é suportado nesta plataforma.",
    )
  } catch (error) {
    if (error instanceof DeviceMouseError) {
      throw error
    }

    throw new DeviceMouseError(
      "mouse_action_failed",
      `Não foi possível controlar o mouse: ${errorText(error) || "erro desconhecido"}.`,
    )
  }
}

export function moveMouse(input: MoveInput): Promise<void> {
  return run(process.platform, {
    action: "move",
    x: input.x,
    y: input.y,
  })
}

export function clickMouse(input: ClickInput): Promise<void> {
  return run(process.platform, {
    action: "click",
    x: input.x,
    y: input.y,
    button: input.button,
    count: input.count,
  })
}

export function scrollMouse(input: ScrollInput): Promise<void> {
  return run(process.platform, {
    action: "scroll",
    x: input.x,
    y: input.y,
    direction: input.direction,
    amount: input.amount,
  })
}

export function dragMouse(input: DragInput): Promise<void> {
  return run(process.platform, {
    action: "drag",
    from: input.from,
    to: input.to,
    button: input.button,
    durationMs: input.durationMs,
  })
}
