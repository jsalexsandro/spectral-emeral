import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { mkdtemp, writeFile, unlink } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"

const execFileAsync = promisify(execFile)
const MAX_ERROR_LENGTH = 900

export class DeviceSystemError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = "DeviceSystemError"
    this.code = code
  }
}

function errorMessage(error: unknown): string {
  const message =
    error instanceof Error && error.message
      ? error.message
      : "Falha ao executar a ação de sistema no dispositivo."

  return message.slice(0, MAX_ERROR_LENGTH)
}

function windowsOnly(action: string): DeviceSystemError {
  return new DeviceSystemError(
    "unsupported_platform",
    `${action} não é suportado nesta plataforma.`,
  )
}

/* -------------------------------------------------------------------------- */
/* get-system-status                                                          */
/* -------------------------------------------------------------------------- */

export type DeviceSystemStatusResult = {
  volume: number | null
  muted: boolean | null
  brightness: number | null
  battery: {
    percent: number | null
    charging: boolean | null
    acConnected: boolean | null
  } | null
}

export async function getSystemStatus(): Promise<DeviceSystemStatusResult> {
  if (process.platform !== "win32") {
    throw windowsOnly("get-system-status")
  }

  let volume: number | null = null
  let muted: boolean | null = null
  try {
    const v = await getVolumeCs()
    volume = v.volume
    muted = v.muted
  } catch {
    // Volume indisponível: segue com brilho e bateria.
  }

  const brightness = await getBrightness()
  const battery = await getBattery()

  return { volume, muted, brightness, battery }
}

/* -------------------------------------------------------------------------- */
/* set-volume                                                                 */
/* -------------------------------------------------------------------------- */

export type DeviceSetVolumeResult = { volume: number; muted: boolean }

export async function setVolume(input: {
  level?: number
  mute?: boolean
}): Promise<DeviceSetVolumeResult> {
  if (process.platform !== "win32") {
    throw windowsOnly("set-volume")
  }

  const { level, mute } = input

  if (level !== undefined) {
    if (level < 0 || level > 100) {
      throw new DeviceSystemError(
        "invalid_volume_level",
        `Nível de volume inválido: ${level}. Deve estar entre 0 e 100.`,
      )
    }
    await runAudioCs("set-level", level.toString())
  }

  if (mute !== undefined) {
    await runAudioCs("set-mute", mute ? "1" : "0")
  }

  const { volume, muted } = await getVolumeCs()
  return { volume: volume ?? 0, muted: muted ?? false }
}

/* -------------------------------------------------------------------------- */
/* set-brightness                                                             */
/* -------------------------------------------------------------------------- */

export type DeviceSetBrightnessResult = { brightness: number | null }

export async function setBrightness(
  level: number,
): Promise<DeviceSetBrightnessResult> {
  if (process.platform !== "win32") {
    throw windowsOnly("set-brightness")
  }

  if (level < 0 || level > 100) {
    throw new DeviceSystemError(
      "invalid_brightness_level",
      `Nível de brilho inválido: ${level}. Deve estar entre 0 e 100.`,
    )
  }

  await setBrightnessLevel(level)
  const brightness = await getBrightness()
  return { brightness }
}

/* -------------------------------------------------------------------------- */
/* lock-screen                                                                */
/* -------------------------------------------------------------------------- */

export type DeviceLockScreenResult = { locked: boolean }

export async function lockScreen(): Promise<DeviceLockScreenResult> {
  if (process.platform !== "win32") {
    throw windowsOnly("lock-screen")
  }

  await execFileAsync("rundll32.exe", ["user32.dll,LockWorkStation"])

  return { locked: true }
}

/* -------------------------------------------------------------------------- */
/* power                                                                      */
/* -------------------------------------------------------------------------- */

export type DevicePowerResult = {
  action: "sleep" | "shutdown" | "restart" | "cancel"
  delaySec: number | null
  cancelled: boolean | null
}

export async function power(input: {
  action: "sleep" | "shutdown" | "restart" | "cancel"
  delaySec?: number
}): Promise<DevicePowerResult> {
  if (process.platform !== "win32") {
    throw windowsOnly("power")
  }

  const { action, delaySec } = input

  if (action === "cancel") {
    try {
      await execFileAsync("shutdown.exe", ["/a"])
    } catch {
      // Pode não haver agendamento para cancelar; não é erro.
    }
    return { action: "cancel", delaySec: null, cancelled: true }
  }

  const delay = delaySec !== undefined ? delaySec : 60

  if (delay < 0 || delay > 600) {
    throw new DeviceSystemError(
      "invalid_power_delay",
      `delaySec inválido: ${delay}. Deve estar entre 0 e 600 segundos.`,
    )
  }

  if (action === "sleep") {
    await execFileAsync("rundll32.exe", ["powrprof.dll,SetSuspendState", "0,1,0"])
    return { action: "sleep", delaySec: null, cancelled: null }
  }

  const flag = action === "shutdown" ? "/s" : "/r"
  const args = [flag, `/t ${delay}`]
  if (delay > 0) {
    args.push("/c", "Sistema será desligado pelo Spectral.")
  }

  await execFileAsync("shutdown.exe", args)

  return { action, delaySec: delay, cancelled: null }
}

/* -------------------------------------------------------------------------- */
/* media-control                                                              */
/* -------------------------------------------------------------------------- */

export type DeviceMediaControlResult = {
  action: "play-pause" | "next" | "previous" | "stop"
}

export async function mediaControl(input: {
  action: "play-pause" | "next" | "previous" | "stop"
}): Promise<DeviceMediaControlResult> {
  if (process.platform !== "win32") {
    throw windowsOnly("media-control")
  }

  const vk = mediaVk(input.action)
  await runMediaCs(vk)

  return { action: input.action }
}

/* -------------------------------------------------------------------------- */
/* Windows internos                                                           */
/* -------------------------------------------------------------------------- */

const AUDIO_CS = [
  "using System;",
  "using System.Runtime.InteropServices;",
  "public class SpectralAudio {",
  "  [ComImport, Guid(\"BCDE0395-E52F-467C-8E3D-C4579291692E\"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]",
  "  interface IMMDeviceEnumerator { int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice ppDevice); }",
  "  [ComImport, Guid(\"A95664D2-9614-4F39-A7D5-25D9E5C8E83D\"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]",
  "  interface IMMDevice { int Activate(ref Guid iid, int clsCtx, IntPtr pActivationParams, out IAudioEndpointVolume ppInterface); }",
  "  [ComImport, Guid(\"5CDF2C82-841E-4546-9722-0CF74078229A\"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]",
  "  interface IAudioEndpointVolume {",
  "    int GetMasterVolumeLevelScalar(out float pfLevel);",
  "    int GetMute(out bool pbMute);",
  "    int SetMasterVolumeLevelScalar(float fLevel, IntPtr pguidEventContext);",
  "    int SetMute(bool bMute, IntPtr pguidEventContext);",
  "  }",
  "  [DllImport(\"ole32.dll\")]",
  "  static extern int CoCreateInstance(ref Guid rclsid, IntPtr pUnkOuter, int dwClsContext, ref Guid riid, out IntPtr ppv);",
  "  const int CLSCTX_ALL = 4;",
  "  static readonly Guid CLSID_MMDeviceEnumerator = new Guid(\"BCDE0395-E52F-467C-8E3D-C4579291692E\");",
  "  static readonly Guid IID_IAudioEndpointVolume = new Guid(\"5CDF2C82-841E-4546-9722-0CF74078229A\");",
  "  static IAudioEndpointVolume OpenVolume() {",
  "    IntPtr enumeratorPtr = IntPtr.Zero;",
  "    try {",
  "      Guid clsidEnumerador = CLSID_MMDeviceEnumerator;",
  "      Guid iidEnum = typeof(IMMDeviceEnumerator).GUID;",
  "      int hr = CoCreateInstance(ref clsidEnumerador, IntPtr.Zero, CLSCTX_ALL, ref iidEnum, out enumeratorPtr);",
  "      if (hr != 0) throw new Exception(\"CoCreateInstance falhou: 0x\" + hr.ToString(\"X8\"));",
  "      object enumerator = Marshal.GetObjectForIUnknown(enumeratorPtr);",
  "      var deviceEnumerator = (IMMDeviceEnumerator)enumerator;",
  "      IMMDevice device = null;",
  "      hr = deviceEnumerator.GetDefaultAudioEndpoint(0, 0, out device);",
  "      if (hr != 0) throw new Exception(\"GetDefaultAudioEndpoint falhou: 0x\" + hr.ToString(\"X8\"));",
  "      Guid iidVolume = IID_IAudioEndpointVolume;",
  "      IAudioEndpointVolume volume = null;",
  "      hr = device.Activate(ref iidVolume, CLSCTX_ALL, IntPtr.Zero, out volume);",
  "      if (hr != 0) throw new Exception(\"Activate falhou: 0x\" + hr.ToString(\"X8\"));",
  "      return volume;",
  "    } finally {",
  "      if (enumeratorPtr != IntPtr.Zero) Marshal.Release(enumeratorPtr);",
  "    }",
  "  }",
  "  public static string GetVolume() {",
  "    var volume = OpenVolume();",
  "    try {",
  "      float level = 0; bool mute = false;",
  "      int hr = volume.GetMasterVolumeLevelScalar(out level);",
  "      if (hr != 0) throw new Exception(\"GetMasterVolumeLevelScalar falhou: 0x\" + hr.ToString(\"X8\"));",
  "      hr = volume.GetMute(out mute);",
  "      if (hr != 0) throw new Exception(\"GetMute falhou: 0x\" + hr.ToString(\"X8\"));",
  "      return ((int)(level * 100)).ToString() + \",\" + mute.ToString().ToLower();",
  "    } finally {",
  "      Marshal.ReleaseComObject(volume);",
  "    }",
  "  }",
  "  public static void SetLevel(float level) {",
  "    var volume = OpenVolume();",
  "    try {",
  "      int hr = volume.SetMasterVolumeLevelScalar(level, IntPtr.Zero);",
  "      if (hr != 0) throw new Exception(\"SetMasterVolumeLevelScalar falhou: 0x\" + hr.ToString(\"X8\"));",
  "    } finally {",
  "      Marshal.ReleaseComObject(volume);",
  "    }",
  "  }",
  "  public static void SetMuteFlag(int mute) {",
  "    var volume = OpenVolume();",
  "    try {",
  "      int hr = volume.SetMute(mute != 0, IntPtr.Zero);",
  "      if (hr != 0) throw new Exception(\"SetMute falhou: 0x\" + hr.ToString(\"X8\"));",
  "    } finally {",
  "      Marshal.ReleaseComObject(volume);",
  "    }",
  "  }",
  "}",
].join("\n")

const MEDIA_CS = [
  "using System;",
  "using System.Runtime.InteropServices;",
  "public class SpectralMedia {",
  "  [DllImport(\"user32.dll\")]",
  "  public static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);",
  "  [StructLayout(LayoutKind.Sequential)]",
  "  public struct INPUT {",
  "    public uint type;",
  "    public InputUnion u;",
  "  }",
  "  [StructLayout(LayoutKind.Explicit)]",
  "  public struct InputUnion {",
  "    [FieldOffset(0)] public MOUSEINPUT mi;",
  "    [FieldOffset(0)] public KEYBDINPUT ki;",
  "    [FieldOffset(0)] public HARDWAREINPUT hi;",
  "  }",
  "  [StructLayout(LayoutKind.Sequential)]",
  "  public struct KEYBDINPUT {",
  "    public ushort wVk;",
  "    public ushort wScan;",
  "    public uint dwFlags;",
  "    public uint time;",
  "    public IntPtr dwExtraInfo;",
  "  }",
  "  [StructLayout(LayoutKind.Sequential)]",
  "  public struct MOUSEINPUT {",
  "    public int dx;",
  "    public int dy;",
  "    public uint mouseData;",
  "    public uint dwFlags;",
  "    public uint time;",
  "    public IntPtr dwExtraInfo;",
  "  }",
  "  [StructLayout(LayoutKind.Sequential)]",
  "  public struct HARDWAREINPUT {",
  "    public uint uMsg;",
  "    public ushort wParamL;",
  "    public ushort wParamH;",
  "  }",
  "  public static void PressKey(byte vk) {",
  "    var down = new INPUT { type = 1, u = new InputUnion { ki = new KEYBDINPUT { wVk = vk, dwFlags = 0 } } };",
  "    var up = new INPUT { type = 1, u = new InputUnion { ki = new KEYBDINPUT { wVk = vk, dwFlags = 0x0002 } } };",
  "    SendInput(2, new[] { down, up }, System.Runtime.InteropServices.Marshal.SizeOf(typeof(INPUT)));",
  "  }",
  "}",
].join("\n")

async function writeCsTemp(name: string, content: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "spectral-system-"))
  const path = join(dir, name)
  await writeFile(path, content, "utf8")
  return path
}

async function runCs(
  csContent: string,
  psCommand: string,
): Promise<string> {
  const csPath = await writeCsTemp("spectral.cs", csContent)

  try {
    const { stdout, stderr } = await execFileAsync("powershell.exe", [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      `Add-Type -Path "${csPath}"; ${psCommand}`,
    ])

    if (stderr && stderr.trim().length > 0 && (!stdout || stdout.trim().length === 0)) {
      throw new Error(stderr.trim())
    }

    return stdout
  } finally {
    try {
      await unlink(csPath)
    } catch {
      // ignorar
    }
  }
}

async function getVolumeCs(): Promise<{ volume: number | null; muted: boolean | null }> {
  try {
    const stdout = await runCs(AUDIO_CS, "[SpectralAudio]::GetVolume()")
    const trimmed = stdout.trim()
    const parts = trimmed.split(",")
    if (parts.length !== 2) {
      throw new DeviceSystemError(
        "volume_failed",
        `Não foi possível ler o volume do sistema: ${trimmed}`,
      )
    }

    const volume = parseInt(parts[0]!, 10)
    const muted = parts[1]! === "true"
    return { volume, muted }
  } catch (error) {
    if (error instanceof DeviceSystemError) {
      throw error
    }
    const message = errorMessage(error)
    if (message.includes("0x80040154") || message.includes("CLSID")) {
      return { volume: null, muted: null }
    }
    throw new DeviceSystemError("volume_failed", message)
  }
}

async function runAudioCs(
  command: "set-level" | "set-mute",
  arg: string,
): Promise<void> {
  const call =
    command === "set-level"
      ? `[SpectralAudio]::SetLevel(${arg})`
      : `[SpectralAudio]::SetMuteFlag(${arg})`

  try {
    await runCs(AUDIO_CS, call)
  } catch (error) {
    const message = errorMessage(error)
    if (message.includes("0x80040154") || message.includes("CLSID")) {
      throw new DeviceSystemError(
        "volume_unsupported",
        "Controle de volume não está disponível neste dispositivo (endpoint de áudio não encontrado).",
      )
    }
    throw new DeviceSystemError("volume_failed", message)
  }
}

async function getBrightness(): Promise<number | null> {
  const script =
    "Get-CimInstance -Namespace root/wmi -ClassName WmiMonitorBrightness | Select-Object -First 1 -ExpandProperty CurrentBrightness"

  try {
    const { stdout } = await execFileAsync("powershell.exe", [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      script,
    ])

    const trimmed = stdout.trim()
    if (!trimmed || trimmed.toLowerCase() === "null") {
      return null
    }

    const value = parseInt(trimmed, 10)
    return Number.isFinite(value) ? value : null
  } catch {
    return null
  }
}

async function setBrightnessLevel(level: number): Promise<void> {
  const script =
    `$level = ${level}; Get-CimInstance -Namespace root/wmi -ClassName WmiMonitorBrightnessMethods | ForEach-Object { $_.WmiSetBrightness(0, $level) }`

  try {
    await execFileAsync("powershell.exe", [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      script,
    ])
  } catch (error) {
    const message = errorMessage(error)
    throw new DeviceSystemError("brightness_failed", message)
  }
}

async function getBattery(): Promise<{
  percent: number | null
  charging: boolean | null
  acConnected: boolean | null
} | null> {
  const script =
    "Get-CimInstance Win32_Battery | Select-Object -First 1 EstimatedChargeRemaining, BatteryStatus, ACStatus | ConvertTo-Json -Compress"

  try {
    const { stdout } = await execFileAsync("powershell.exe", [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      script,
    ])

    const trimmed = stdout.trim()
    if (!trimmed || trimmed === "null") {
      return null
    }

    const parsed = JSON.parse(trimmed)
    const estimatedChargeRemaining = parsed.EstimatedChargeRemaining
    const batteryStatus = parsed.BatteryStatus
    const acStatus = parsed.ACStatus

    const percent =
      typeof estimatedChargeRemaining === "number" ? estimatedChargeRemaining : null
    const charging = batteryStatus === 2 || batteryStatus === 4
    const acConnected = acStatus === 2

    return { percent, charging, acConnected }
  } catch {
    return null
  }
}

const MEDIA_VK: Record<string, number> = {
  "play-pause": 0xB3,
  next: 0xB0,
  previous: 0xB1,
  stop: 0xB2,
}

function mediaVk(action: string): number {
  const vk = MEDIA_VK[action]
  if (vk === undefined) {
    throw new DeviceSystemError("invalid_media_action", `Ação de mídia desconhecida: ${action}`)
  }
  return vk
}

async function runMediaCs(vk: number): Promise<void> {
  try {
    await runCs(MEDIA_CS, `[SpectralMedia]::PressKey(${vk})`)
  } catch (error) {
    throw new DeviceSystemError("media_failed", errorMessage(error))
  }
}
