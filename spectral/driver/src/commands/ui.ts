import { execFile } from "node:child_process"
import { promisify } from "node:util"
import {
  DEVICE_UI_ACTIONS,
  type DeviceCommandInputMap,
  type DeviceMousePoint,
  type DeviceUiAction,
  type DeviceUiActionResult,
  type DeviceUiElement,
  type DeviceUiElementPathItem,
  type DeviceUiInspection,
  type DeviceWindowBounds,
} from "../../../shared/device-commands.js"

const execFileAsync = promisify(execFile)

const UI_EXEC_TIMEOUT_MS = 15_000
const UI_ACTION_TIMEOUT_MS = 10_000
const UI_MAX_BUFFER_BYTES = 4 * 1024 * 1024
const UI_NAME_MAX_LENGTH = 200
const UI_ROLE_MAX_LENGTH = 40
const UI_AUTOMATION_ID_MAX_LENGTH = 120
const UI_PATH_ITEM_MAX_LENGTH = 80
const UI_HINT_MAX_LENGTH = 300
const UI_PATH_MAX_DEPTH = 4
const UI_RUNTIME_ID_PATTERN = /^[0-9]+(?:\.[0-9]+)*$/
const UI_ACTION_SET = new Set<string>(DEVICE_UI_ACTIONS)

type InspectInput = DeviceCommandInputMap["inspect-ui"]
type UiActionInput = DeviceCommandInputMap["ui-action"]

export type { DeviceUiActionResult, DeviceUiInspection } from "../../../shared/device-commands.js"

export class DeviceUiError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = "DeviceUiError"
    this.code = code
  }
}

type Raw = Record<string, unknown>

function isRecord(value: unknown): value is Raw {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function toInteger(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.trunc(value)
    : fallback
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

function readBoolean(value: unknown): boolean {
  return value === true
}

function readNullableBoolean(value: unknown): boolean | null {
  if (value === true) {
    return true
  }

  if (value === false) {
    return false
  }

  return null
}

function normalizeBounds(value: unknown): DeviceWindowBounds | null {
  if (!isRecord(value)) {
    return null
  }

  const width = Math.max(0, toInteger(value.width))
  const height = Math.max(0, toInteger(value.height))

  if (width === 0 || height === 0) {
    return null
  }

  return {
    x: toInteger(value.x),
    y: toInteger(value.y),
    width,
    height,
  }
}

function normalizeCenter(value: unknown): DeviceMousePoint | null {
  if (!isRecord(value)) {
    return null
  }

  return { x: toInteger(value.x), y: toInteger(value.y) }
}

function normalizePath(value: unknown): DeviceUiElementPathItem[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter(isRecord)
    .slice(-UI_PATH_MAX_DEPTH)
    .map((item) => ({
      name: clampText(item.name, UI_PATH_ITEM_MAX_LENGTH),
      role: clampText(item.role, UI_ROLE_MAX_LENGTH),
    }))
}

function normalizeActions(value: unknown): DeviceUiAction[] {
  if (!Array.isArray(value)) {
    return []
  }

  const seen = new Set<DeviceUiAction>()

  for (const item of value) {
    if (typeof item === "string" && UI_ACTION_SET.has(item)) {
      seen.add(item as DeviceUiAction)
    }
  }

  return [...seen]
}

function normalizeRuntimeId(value: unknown): string | null {
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()
  return UI_RUNTIME_ID_PATTERN.test(trimmed) ? trimmed : null
}

function normalizeElement(value: unknown): DeviceUiElement | null {
  if (!isRecord(value)) {
    return null
  }

  const name = clampText(value.name, UI_NAME_MAX_LENGTH)
  const role = clampText(value.role, UI_ROLE_MAX_LENGTH)
  const automationId = clampText(
    value.automationId,
    UI_AUTOMATION_ID_MAX_LENGTH,
  )

  if (!name && !role && !automationId) {
    return null
  }

  const bounds = normalizeBounds(value.bounds)
  const center = normalizeCenter(value.center) ?? centerFromBounds(bounds)
  const actions = normalizeActions(value.actions)

  return {
    runtimeId: normalizeRuntimeId(value.runtimeId),
    name,
    role,
    value: typeof value.value === "string" ? clampText(value.value, 200) : null,
    bounds,
    center,
    enabled: readBoolean(value.enabled),
    focused: readBoolean(value.focused),
    selected: readNullableBoolean(value.selected),
    expanded: readNullableBoolean(value.expanded),
    offscreen: readBoolean(value.offscreen),
    actionable: actions.length > 0 || readBoolean(value.actionable),
    actions,
    automationId,
    path: normalizePath(value.path),
  }
}

function centerFromBounds(
  bounds: DeviceWindowBounds | null,
): DeviceMousePoint | null {
  if (!bounds) {
    return null
  }

  return {
    x: bounds.x + Math.floor(bounds.width / 2),
    y: bounds.y + Math.floor(bounds.height / 2),
  }
}

function parseJsonOutput(stdout: string, label: string): unknown {
  const trimmed = stdout.replace(/^\uFEFF/, "").trim()

  if (!trimmed) {
    throw new DeviceUiError(
      "ui_inspection_failed",
      `O driver não recebeu dados ao ${label}.`,
    )
  }

  try {
    return JSON.parse(trimmed)
  } catch {
    throw new DeviceUiError(
      "ui_inspection_failed",
      `O driver não conseguiu interpretar a resposta ao ${label}.`,
    )
  }
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
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300)
}

function toUiError(error: unknown, label: string): DeviceUiError {
  if (error instanceof DeviceUiError) {
    return error
  }

  const detail = execErrorText(error)
  const suffix = detail ? ` ${detail}` : ""

  switch (execErrorCode(error)) {
    case 4:
      return new DeviceUiError(
        "window_not_found",
        "A janela não está mais disponível no dispositivo.",
      )
    case 5:
      return new DeviceUiError(
        "element_not_found",
        "O elemento não existe mais ou não está acessível. Inspecione a interface novamente.",
      )
    case 6:
      return new DeviceUiError(
        "pattern_not_supported",
        "O elemento não suporta a ação solicitada. Escolha uma ação compatível com o elemento.",
      )
    case 7:
      return new DeviceUiError(
        "action_failed",
        `O elemento não concluiu a ação.${suffix}`,
      )
    case 8:
      return new DeviceUiError(
        "password_field_blocked",
        "O controle é um campo de senha: o driver não lê nem escreve esse tipo de valor. Peça ao usuário para digitar a senha manualmente.",
      )
    case 2:
      return new DeviceUiError("invalid_ui_action", "Ação de UI inválida.")
    default:
      return new DeviceUiError(
        "ui_inspection_failed",
        `Não foi possível ${label}.${suffix}`,
      )
  }
}

/* -------------------------------------------------------------------------- */
/* Windows                                                                    */
/* -------------------------------------------------------------------------- */

const WINDOWS_UI_API = `
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

public class SpectralUiNative {
  [DllImport("user32.dll")]
  public static extern bool IsWindow(IntPtr hWnd);
  [DllImport("user32.dll")]
  public static extern bool SetProcessDpiAwarenessContext(IntPtr value);
  [DllImport("user32.dll")]
  public static extern bool SetProcessDPIAware();

  public static void EnableDpiAwareness() {
    try { if (SetProcessDpiAwarenessContext(new IntPtr(-4))) return; } catch {}
    try { SetProcessDPIAware(); } catch {}
  }
}
'@

[void][SpectralUiNative]::EnableDpiAwareness()

function Get-UiText($value, $max) {
  if ($null -eq $value) { return '' }
  $text = [string]$value
  $text = ($text -replace '\\s+', ' ').Trim()
  if ($text.Length -gt $max) {
    return $text.Substring(0, $max - 1) + '...'
  }
  return $text
}

function Get-UiRole($element) {
  try {
    return ($element.Current.ControlType.ProgrammaticName -replace '^ControlType\\.', '')
  } catch {
    return ''
  }
}

function Get-UiRuntimeId($element) {
  try {
    $ids = $element.GetRuntimeId()
    if ($null -eq $ids -or $ids.Length -eq 0) { return $null }
    return ($ids -join '.')
  } catch {
    return $null
  }
}

function Get-UiPattern($element, $pattern) {
  try {
    return $element.GetCurrentPattern($pattern)
  } catch {
    return $null
  }
}

function Get-UiBounds($element) {
  try {
    $rect = $element.Current.BoundingRectangle
  } catch {
    return $null
  }
  if ($rect.IsEmpty) { return $null }
  $width = [int][Math]::Round($rect.Width)
  $height = [int][Math]::Round($rect.Height)
  if ($width -le 0 -or $height -le 0) { return $null }
  return [ordered]@{
    x = [int][Math]::Round($rect.X)
    y = [int][Math]::Round($rect.Y)
    width = $width
    height = $height
  }
}

function Get-UiActions($element) {
  $actions = New-Object System.Collections.Generic.List[string]
  if ($null -ne (Get-UiPattern $element ([System.Windows.Automation.InvokePattern]::Pattern))) { $actions.Add('invoke') }
  if ($null -ne (Get-UiPattern $element ([System.Windows.Automation.SelectionItemPattern]::Pattern))) { $actions.Add('select') }
  if ($null -ne (Get-UiPattern $element ([System.Windows.Automation.TogglePattern]::Pattern))) { $actions.Add('toggle') }
  if ($null -ne (Get-UiPattern $element ([System.Windows.Automation.ExpandCollapsePattern]::Pattern))) {
    $actions.Add('expand')
    $actions.Add('collapse')
  }
  try {
    if ($element.Current.IsKeyboardFocusable) { $actions.Add('focus') }
  } catch {}
  $value = Get-UiPattern $element ([System.Windows.Automation.ValuePattern]::Pattern)
  if ($null -ne $value) {
    $readOnly = $false
    $isPassword = $false
    try { $readOnly = [bool]$value.Current.IsReadOnly } catch {}
    try { $isPassword = [bool]$value.Current.IsPassword } catch {}
    if (-not $readOnly -and -not $isPassword) { $actions.Add('setValue') }
  }
  return ,$actions.ToArray()
}

function Get-UiSelected($element) {
  $selection = Get-UiPattern $element ([System.Windows.Automation.SelectionItemPattern]::Pattern)
  if ($null -ne $selection) {
    try { return [bool]$selection.Current.IsSelected } catch {}
  }
  $toggle = Get-UiPattern $element ([System.Windows.Automation.TogglePattern]::Pattern)
  if ($null -ne $toggle) {
    try { return ([string]$toggle.Current.ToggleState -eq 'On') } catch {}
  }
  return $null
}

function Get-UiExpanded($element) {
  $expand = Get-UiPattern $element ([System.Windows.Automation.ExpandCollapsePattern]::Pattern)
  if ($null -eq $expand) { return $null }
  try {
    $state = [string]$expand.Current.ExpandCollapseState
    if ($state -eq 'Expanded') { return $true }
    if ($state -eq 'Collapsed') { return $false }
    return $null
  } catch {
    return $null
  }
}

function Get-UiPath($element) {
  $items = New-Object System.Collections.Generic.List[object]
  $walker = [System.Windows.Automation.TreeWalker]::RawViewWalker
  $current = $element
  $guard = 0
  while ($null -ne $current -and $guard -lt 5) {
    $parent = $null
    try { $parent = $walker.GetParent($current) } catch { $parent = $null }
    if ($null -eq $parent) { break }
    if ([object]::ReferenceEquals($parent, [System.Windows.Automation.AutomationElement]::RootElement)) { break }
    $items.Insert(0, [ordered]@{ name = (Get-UiText $parent.Current.Name 80); role = (Get-UiRole $parent) })
    $current = $parent
    $guard++
  }
  return ,$items.ToArray()
}

function Get-UiSnapshot($element) {
  $name = ''
  $automationId = ''
  $enabled = $false
  $focused = $false
  $offscreen = $true
  try { $name = Get-UiText $element.Current.Name 200 } catch {}
  try { $automationId = Get-UiText $element.Current.AutomationId 120 } catch {}
  try { $enabled = [bool]$element.Current.IsEnabled } catch {}
  try { $focused = [bool]$element.Current.HasKeyboardFocus } catch {}
  try { $offscreen = [bool]$element.Current.IsOffscreen } catch {}
  $bounds = Get-UiBounds $element
  $center = $null
  if ($null -ne $bounds) {
    $center = [ordered]@{
      x = [int]($bounds.x + [Math]::Floor($bounds.width / 2))
      y = [int]($bounds.y + [Math]::Floor($bounds.height / 2))
    }
  }
  $value = $null
  $valuePattern = Get-UiPattern $element ([System.Windows.Automation.ValuePattern]::Pattern)
  if ($null -ne $valuePattern) {
    try {
      $isPassword = [bool]$valuePattern.Current.IsPassword
      if (-not $isPassword) { $value = Get-UiText $valuePattern.Current.Value 200 }
    } catch {}
  }
  $actions = Get-UiActions $element
  return [ordered]@{
    runtimeId = (Get-UiRuntimeId $element)
    name = $name
    role = (Get-UiRole $element)
    value = $value
    bounds = $bounds
    center = $center
    enabled = $enabled
    focused = $focused
    selected = (Get-UiSelected $element)
    expanded = (Get-UiExpanded $element)
    offscreen = $offscreen
    actionable = ($actions.Count -gt 0)
    actions = $actions
    automationId = $automationId
    path = (Get-UiPath $element)
  }
}
`

const WINDOWS_INSPECT_UI_SCRIPT = `${WINDOWS_UI_API}
$handle = [long]$env:SPECTRAL_UI_WINDOW_ID
if (-not [SpectralUiNative]::IsWindow([IntPtr]$handle)) { exit 4 }
$root = [System.Windows.Automation.AutomationElement]::FromHandle([IntPtr]$handle)
if ($null -eq $root) { exit 4 }

$find = $env:SPECTRAL_UI_FIND
$role = $env:SPECTRAL_UI_ROLE
$maxResults = [int]$env:SPECTRAL_UI_MAX_RESULTS
$maxDepth = [int]$env:SPECTRAL_UI_DEPTH
$includeOffscreen = ($env:SPECTRAL_UI_INCLUDE_OFFSCREEN -eq '1')
$maxNodes = 4000

$script:found = New-Object System.Collections.Generic.List[object]
$script:scanned = 0
$script:truncated = $false
$walker = [System.Windows.Automation.TreeWalker]::RawViewWalker

function Test-UiMatch($element) {
  if (-not $includeOffscreen) {
    try { if ($element.Current.IsOffscreen) { return $false } } catch { return $false }
  }
  if ($role) {
    if ((Get-UiRole $element) -ne $role) { return $false }
  }
  $name = ''
  $automationId = ''
  try { $name = [string]$element.Current.Name } catch {}
  try { $automationId = [string]$element.Current.AutomationId } catch {}
  if ($name.Trim().Length -eq 0 -and $automationId.Trim().Length -eq 0) { return $false }
  if ($find) {
    $matched = $name.IndexOf($find, [System.StringComparison]::OrdinalIgnoreCase)
    if ($matched -lt 0) {
      $matched = $automationId.IndexOf($find, [System.StringComparison]::OrdinalIgnoreCase)
    }
    if ($matched -lt 0) { return $false }
  }
  return $true
}

function Visit-UiElement($element, $level) {
  if ($script:found.Count -ge $maxResults -or $script:scanned -ge $maxNodes) {
    $script:truncated = $true
    return
  }
  $script:scanned++
  if (Test-UiMatch $element) {
    try {
      $script:found.Add((Get-UiSnapshot $element))
    } catch {}
    if ($script:found.Count -ge $maxResults) {
      $script:truncated = $true
      return
    }
  }
  if ($level -ge $maxDepth) { return }
  try { $child = $walker.GetFirstChild($element) } catch { $child = $null }
  while ($null -ne $child) {
    Visit-UiElement $child ($level + 1)
    if ($script:found.Count -ge $maxResults -or $script:scanned -ge $maxNodes) {
      $script:truncated = $true
      break
    }
    try { $child = $walker.GetNextSibling($child) } catch { $child = $null }
  }
}

$windowTitle = ''
try { $windowTitle = Get-UiText $root.Current.Name 300 } catch {}

$waitMs = [int]$env:SPECTRAL_UI_WAIT_MS
$deadline = [DateTime]::UtcNow.AddMilliseconds($waitMs)
$waitedMs = 0

while ($true) {
  $script:found = New-Object System.Collections.Generic.List[object]
  $script:scanned = 0
  $script:truncated = $false
  try { $child = $walker.GetFirstChild($root) } catch { $child = $null }
  while ($null -ne $child) {
    Visit-UiElement $child 1
    if ($script:found.Count -ge $maxResults -or $script:scanned -ge $maxNodes) {
      $script:truncated = $true
      break
    }
    try { $child = $walker.GetNextSibling($child) } catch { $child = $null }
  }
  if ($script:found.Count -gt 0) { break }
  if ([DateTime]::UtcNow -ge $deadline) { break }
  Start-Sleep -Milliseconds 150
  $waitedMs += 150
}

[ordered]@{
  windowTitle = $windowTitle
  elements = @($script:found.ToArray())
  scanned = $script:scanned
  waitedMs = $waitedMs
  truncated = $script:truncated
} | ConvertTo-Json -Depth 10 -Compress
`

const WINDOWS_UI_ACTION_SCRIPT = `${WINDOWS_UI_API}
$handle = [long]$env:SPECTRAL_UI_WINDOW_ID
if (-not [SpectralUiNative]::IsWindow([IntPtr]$handle)) { exit 4 }
$root = [System.Windows.Automation.AutomationElement]::FromHandle([IntPtr]$handle)
if ($null -eq $root) { exit 4 }

$action = $env:SPECTRAL_UI_ACTION
$runtimeId = $env:SPECTRAL_UI_RUNTIME_ID
$parts = $runtimeId.Split('.')
$targetIds = New-Object int[] $parts.Length
for ($i = 0; $i -lt $parts.Length; $i++) {
  $targetIds[$i] = [int]$parts[$i]
}

$walker = [System.Windows.Automation.TreeWalker]::RawViewWalker
$script:scanned = 0
$maxNodes = 8000

function Test-UiRuntimeId($element) {
  try {
    $ids = $element.GetRuntimeId()
    if ($null -eq $ids -or $ids.Length -ne $targetIds.Length) { return $false }
    for ($i = 0; $i -lt $ids.Length; $i++) {
      if ($ids[$i] -ne $targetIds[$i]) { return $false }
    }
    return $true
  } catch {
    return $false
  }
}

function Find-UiElement($element) {
  if ($script:scanned -ge $maxNodes) { return $null }
  $script:scanned++
  if (Test-UiRuntimeId $element) { return $element }
  try { $child = $walker.GetFirstChild($element) } catch { $child = $null }
  while ($null -ne $child) {
    $found = Find-UiElement $child
    if ($null -ne $found) { return $found }
    try { $child = $walker.GetNextSibling($child) } catch { $child = $null }
  }
  return $null
}

$target = $null
$waitMs = [int]$env:SPECTRAL_UI_WAIT_MS
$deadline = [DateTime]::UtcNow.AddMilliseconds($waitMs)
$waitedMs = 0

while ($true) {
  $script:scanned = 0
  try { $child = $walker.GetFirstChild($root) } catch { $child = $null }
  while ($null -ne $child -and $null -eq $target) {
    $target = Find-UiElement $child
    if ($null -ne $target) { break }
    try { $child = $walker.GetNextSibling($child) } catch { $child = $null }
  }
  if ($null -ne $target) { break }
  if ([DateTime]::UtcNow -ge $deadline) { break }
  Start-Sleep -Milliseconds 150
  $waitedMs += 150
}
if ($null -eq $target) { exit 5 }

$before = Get-UiSnapshot $target

function Require-UiPattern($element, $pattern) {
  try {
    return $element.GetCurrentPattern($pattern)
  } catch {
    exit 6
  }
}

try {
  if ($action -eq 'invoke') {
    $pattern = Require-UiPattern $target ([System.Windows.Automation.InvokePattern]::Pattern)
    $pattern.Invoke()
  } elseif ($action -eq 'select') {
    $pattern = Require-UiPattern $target ([System.Windows.Automation.SelectionItemPattern]::Pattern)
    $pattern.Select()
  } elseif ($action -eq 'toggle') {
    $pattern = Require-UiPattern $target ([System.Windows.Automation.TogglePattern]::Pattern)
    $pattern.Toggle()
  } elseif ($action -eq 'expand') {
    $pattern = Require-UiPattern $target ([System.Windows.Automation.ExpandCollapsePattern]::Pattern)
    $pattern.Expand()
  } elseif ($action -eq 'collapse') {
    $pattern = Require-UiPattern $target ([System.Windows.Automation.ExpandCollapsePattern]::Pattern)
    $pattern.Collapse()
  } elseif ($action -eq 'focus') {
    $target.SetFocus()
  } elseif ($action -eq 'setValue') {
    $pattern = Require-UiPattern $target ([System.Windows.Automation.ValuePattern]::Pattern)
    $isPassword = $false
    try { $isPassword = [bool]$pattern.Current.IsPassword } catch {}
    if ($isPassword) { exit 8 }
    $value = $env:SPECTRAL_UI_VALUE
    if ($null -eq $value) { $value = '' }
    $pattern.SetValue([string]$value)
  } else {
    exit 2
  }
} catch {
  if ($_.Exception -is [System.InvalidOperationException]) { exit 6 }
  exit 7
}

Start-Sleep -Milliseconds 180

$after = $before
try { $after = Get-UiSnapshot $target } catch {}

$hint = $null
if ($action -eq 'focus') {
  $selection = Get-UiPattern $target ([System.Windows.Automation.SelectionItemPattern]::Pattern)
  if ($null -ne $selection) {
    $hint = 'Elemento selecionável: use a ação select para ativá-lo; focus apenas move o foco de teclado.'
  }
}

$windowTitle = ''
try { $windowTitle = Get-UiText $root.Current.Name 300 } catch {}

[ordered]@{
  windowTitle = $windowTitle
  action = $action
  element = $after
  waitedMs = $waitedMs
  hint = $hint
} | ConvertTo-Json -Depth 10 -Compress
`

async function inspectWindowsUi(
  input: InspectInput,
): Promise<DeviceUiInspection> {
  let stdout: string

  try {
    const result = await execFileAsync(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        WINDOWS_INSPECT_UI_SCRIPT,
      ],
      {
        timeout: UI_EXEC_TIMEOUT_MS + input.waitMs,
        windowsHide: true,
        maxBuffer: UI_MAX_BUFFER_BYTES,
        env: {
          ...process.env,
          SPECTRAL_UI_WINDOW_ID: input.windowId,
          SPECTRAL_UI_FIND: input.find ?? "",
          SPECTRAL_UI_ROLE: input.role ?? "",
          SPECTRAL_UI_MAX_RESULTS: String(input.maxResults),
          SPECTRAL_UI_DEPTH: String(input.depth),
          SPECTRAL_UI_INCLUDE_OFFSCREEN: input.includeOffscreen ? "1" : "0",
          SPECTRAL_UI_WAIT_MS: String(input.waitMs),
        },
      },
    )

    stdout = result.stdout
  } catch (error) {
    throw toUiError(error, "inspecionar a interface da janela")
  }

  const raw = parseJsonOutput(stdout, "inspecionar a interface")
  const root = isRecord(raw) ? raw : {}
  const elements = Array.isArray(root.elements)
    ? root.elements
        .map((item) => normalizeElement(item))
        .filter((item): item is DeviceUiElement => item !== null)
    : []

  return {
    windowId: input.windowId,
    windowTitle: clampText(root.windowTitle, 300),
    elements,
    scanned: Math.max(0, toInteger(root.scanned)),
    waitedMs: Math.max(0, toInteger(root.waitedMs)),
    truncated: readBoolean(root.truncated),
  }
}

async function actOnWindowsUi(
  input: UiActionInput,
): Promise<DeviceUiActionResult> {
  let stdout: string

  try {
    const result = await execFileAsync(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        WINDOWS_UI_ACTION_SCRIPT,
      ],
      {
        timeout: UI_ACTION_TIMEOUT_MS + input.waitMs,
        windowsHide: true,
        maxBuffer: UI_MAX_BUFFER_BYTES,
        env: {
          ...process.env,
          SPECTRAL_UI_WINDOW_ID: input.windowId,
          SPECTRAL_UI_RUNTIME_ID: input.runtimeId,
          SPECTRAL_UI_ACTION: input.action,
          SPECTRAL_UI_WAIT_MS: String(input.waitMs),
          SPECTRAL_UI_VALUE: input.value ?? "",
        },
      },
    )

    stdout = result.stdout
  } catch (error) {
    throw toUiError(error, "executar a ação na interface")
  }

  const raw = parseJsonOutput(stdout, "executar a ação na interface")
  const root = isRecord(raw) ? raw : {}
  const element = normalizeElement(root.element)
  const hint = clampText(root.hint, UI_HINT_MAX_LENGTH)

  if (!element) {
    throw new DeviceUiError(
      "ui_inspection_failed",
      "O driver não recebeu os dados do elemento após a ação.",
    )
  }

  return {
    windowId: input.windowId,
    action: input.action,
    element,
    waitedMs: Math.max(0, toInteger(root.waitedMs)),
    ...(hint ? { hint } : {}),
  }
}

/* -------------------------------------------------------------------------- */
/* macOS e Linux                                                              */
/* -------------------------------------------------------------------------- */

function unsupportedPlatform(): DeviceUiError {
  return new DeviceUiError(
    "unsupported_platform",
    "Inspeção e ações de acessibilidade ainda não são suportadas nesta plataforma. Use as tools de mouse e teclado.",
  )
}

/* -------------------------------------------------------------------------- */
/* Platform dispatch                                                          */
/* -------------------------------------------------------------------------- */

export async function inspectUi(
  input: InspectInput,
): Promise<DeviceUiInspection> {
  switch (process.platform) {
    case "win32":
      return inspectWindowsUi(input)
    default:
      throw unsupportedPlatform()
  }
}

export async function performUiAction(
  input: UiActionInput,
): Promise<DeviceUiActionResult> {
  switch (process.platform) {
    case "win32":
      return actOnWindowsUi(input)
    default:
      throw unsupportedPlatform()
  }
}
