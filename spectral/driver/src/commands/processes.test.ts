import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { execFile } from "node:child_process"
import { type DeviceProcessInfo } from "../../../shared/device-commands.js"
import {
  collectDriverAncestorPids,
  collectDescendantPids,
  isProtectedProcess,
  killProcess,
  listProcesses,
} from "./processes.js"

const mockExecFile = execFile as unknown as ReturnType<typeof vi.fn>

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}))

function mockExec(
  resolpor: (
    file: string,
    args: unknown[],
  ) => { stdout: string; stderr: string } | Error,
) {
  ;(mockExecFile as ReturnType<typeof vi.fn>).mockImplementation(
    (_file: string, args: unknown[], _options: unknown, callback: (error: unknown | null, result: { stdout: string; stderr: string }) => void) => {
      const resultado = resolpor(_file, args)

      if (resultado instanceof Error) {
        callback(resultado, { stdout: "", stderr: "" })
      } else {
        callback(null, resultado)
      }
    },
  )
}

const platformSpy = vi.spyOn(process, "platform", "get")

beforeEach(() => {
  mockExec(() => ({ stdout: "", stderr: "" }))
  platformSpy.mockReturnValue("win32")
})

afterEach(() => {
  ;(mockExecFile as ReturnType<typeof vi.fn>).mockReset()
  platformSpy.mockRestore()
})

const processo = (overrides: Partial<DeviceProcessInfo> = {}): DeviceProcessInfo => ({
  pid: 1234,
  parentPid: 1,
  name: "notepad.exe",
  command: "C:\\Windows\\notepad.exe",
  memoryBytes: 10_000_000,
  startedAt: "2026-11-15T10:00:00Z",
  sessionId: 1,
  ...overrides,
})

const jsonProcesso = (p: DeviceProcessInfo) => ({
  ProcessId: p.pid,
  ParentProcessId: p.parentPid,
  Name: p.name,
  CommandLine: p.command,
  WorkingSetSize: p.memoryBytes,
  CreationDate: p.startedAt ? p.startedAt.replace(/-/g, "").replace(/:/g, "").slice(0, 14) + ".000000+000" : null,
  SessionId: p.sessionId,
})

describe("listProcesses", () => {
  it("retorna vazio em plataforma não-Windows", async () => {
    platformSpy.mockReturnValue("darwin")

    const result = await listProcesses()

    expect(result).toEqual([])
    expect(mockExecFile).not.toHaveBeenCalled()
  })

  it("parseia array de processos do PowerShell", async () => {
    mockExec(() => ({
      stdout: JSON.stringify([jsonProcesso(processo()), jsonProcesso(processo({ pid: 5678, name: "chrome.exe", memoryBytes: 200_000_000 }))]),
      stderr: "",
    }))

    const result = await listProcesses()

    expect(result).toHaveLength(2)
    expect(result[0]!.pid).toBe(5678)
    expect(result[0]!.name).toBe("chrome.exe")
    expect(result[1]!.pid).toBe(1234)
    expect(result[1]!.name).toBe("notepad.exe")
  })

  it("parseia objeto único quando o PowerShell devolve um só processo", async () => {
    mockExec(() => ({
      stdout: JSON.stringify(jsonProcesso(processo({ command: null, memoryBytes: null, startedAt: null }))),
      stderr: "",
    }))

    const result = await listProcesses()

    expect(result).toHaveLength(1)
    expect(result[0]!.command).toBeNull()
    expect(result[0]!.memoryBytes).toBeNull()
    expect(result[0]!.startedAt).toBeNull()
  })

  it("filtra por query no nome e comando", async () => {
    mockExec(() => ({
      stdout: JSON.stringify([
        jsonProcesso(processo({ pid: 1, name: "notepad.exe", command: "notepad.exe" })),
        jsonProcesso(processo({ pid: 2, name: "chrome.exe", command: "chrome.exe --profile" })),
      ]),
      stderr: "",
    }))

    const porNome = await listProcesses("chrome")
    expect(porNome).toHaveLength(1)
    expect(porNome[0]!.name).toBe("chrome.exe")

    const porComando = await listProcesses("profile")
    expect(porComando).toHaveLength(1)
    expect(porComando[0]!.pid).toBe(2)

    const naoEncontrado = await listProcesses("inexistente")
    expect(naoEncontrado).toHaveLength(0)
  })

  it("respeita o limite", async () => {
    mockExec(() => ({
      stdout: JSON.stringify([
        jsonProcesso(processo({ pid: 1, name: "a.exe" })),
        jsonProcesso(processo({ pid: 2, name: "b.exe" })),
        jsonProcesso(processo({ pid: 3, name: "c.exe" })),
      ]),
      stderr: "",
    }))

    const result = await listProcesses(undefined, 2)

    expect(result).toHaveLength(2)
  })
})

describe("isProtectedProcess", () => {
  it("protege pids <= 4", () => {
    expect(isProtectedProcess(4, "system", new Set<number>())).toBe(true)
    expect(isProtectedProcess(0, "idle", new Set<number>())).toBe(true)
  })

  it("protege o driver e ancestrais", () => {
    const ancestrais = new Set([process.pid, 999])
    expect(isProtectedProcess(process.pid, "node.exe", ancestrais)).toBe(true)
    expect(isProtectedProcess(999, "tsx.exe", ancestrais)).toBe(true)
    expect(isProtectedProcess(1234, "notepad.exe", ancestrais)).toBe(false)
  })

  it("protege nomes críticos do Windows", () => {
    const ancestrais = new Set<number>()
    for (const nome of ["csrss", "wininit", "winlogon", "services", "lsass", "dwm", "svchost"]) {
      expect(isProtectedProcess(5000, nome, ancestrais), nome).toBe(true)
    }
    expect(isProtectedProcess(5000, "notepad.exe", ancestrais)).toBe(false)
  })
})

describe("collectDescendantPids", () => {
  it("coleta descendentes pela arvore de parentPid", () => {
    const processos: DeviceProcessInfo[] = [
      processo({ pid: 100, parentPid: 0 }),
      processo({ pid: 101, parentPid: 100 }),
      processo({ pid: 102, parentPid: 100 }),
      processo({ pid: 103, parentPid: 101 }),
      processo({ pid: 104, parentPid: 999 }),
    ]

    const result = collectDescendantPids(100, processos)

    expect(result.sort((a, b) => a - b)).toEqual([101, 102, 103])
  })
})

describe("killProcess", () => {
  const processos = [
    processo({ pid: 1234, name: "notepad.exe" }),
    processo({ pid: 5678, name: "chrome.exe", parentPid: 1234 }),
    processo({ pid: 4, name: "system" }),
    processo({ pid: process.pid, name: "node.exe" }),
  ]

  const listaJson = processos.map(jsonProcesso)

  it("mata processo e confirma que sumiu", async () => {
    let taskKillChamado = false

    mockExec((_file, args) => {
      const argv = args as string[]

      if (_file === "taskkill.exe") {
        taskKillChamado = true
        return { stdout: "Sucesso", stderr: "" }
      }

      // Verificacao de morte: processo sumiu
      return { stdout: "[]", stderr: "" }
    })

    const result = await killProcess(1234, { force: false, tree: false }, processos, new Set<number>())

    expect(result.killed).toBe(true)
    expect(taskKillChamado).toBe(true)
  })

  it("aplica /T e /F quando force e tree", async () => {
    let argumentosTaskKill: string[] | null = null

    mockExec((_file, args) => {
      const argv = args as string[]

      if (_file === "taskkill.exe") {
        argumentosTaskKill = argv
        return { stdout: "Sucesso", stderr: "" }
      }

      return { stdout: "[]", stderr: "" }
    })

    await killProcess(5678, { force: true, tree: true }, processos, new Set<number>())

    expect(argumentosTaskKill).toEqual(["/PID", "5678", "/T", "/F"])
  })

  it("retorna process_not_found quando pid nao existe", async () => {
    mockExec(() => ({ stdout: "", stderr: "" }))

    await expect(killProcess(9999, { force: false, tree: false }, processos, new Set<number>()))
      .rejects.toMatchObject({ code: "process_not_found" })
  })

  it("retorna protected_process para pid <= 4", async () => {
    mockExec(() => ({ stdout: "", stderr: "" }))

    await expect(killProcess(4, { force: false, tree: false }, processos, new Set<number>()))
      .rejects.toMatchObject({ code: "protected_process" })
  })

  it("retorna protected_process para o driver", async () => {
    mockExec(() => ({ stdout: "", stderr: "" }))

    await expect(killProcess(process.pid, { force: false, tree: false }, processos, new Set([process.pid])))
      .rejects.toMatchObject({ code: "protected_process" })
  })

  it("retorna protected_process para nome crítico", async () => {
    mockExec(() => ({ stdout: "", stderr: "" }))

    await expect(killProcess(5000, { force: false, tree: false }, [{ ...processo({ pid: 5000, name: "csrss.exe" }) }], new Set<number>()))
      .rejects.toMatchObject({ code: "protected_process" })
  })

  it("recusa tree com descendente protegido", async () => {
    const arvore = [
      ...processos,
      processo({ pid: 100, name: "svchost.exe", parentPid: 5678 }),
    ]
    mockExec(() => ({ stdout: "", stderr: "" }))

    await expect(killProcess(5678, { force: false, tree: true }, arvore, new Set<number>()))
      .rejects.toMatchObject({ code: "protected_process" })
  })

  it("retorna process_kill_failed quando taskkill falha", async () => {
    mockExec((_file, args) => {
      const argv = args as string[]

      if (_file === "taskkill.exe") {
        return new Error("taskkill falhou")
      }

      return { stdout: JSON.stringify(listaJson), stderr: "" }
    })

    await expect(killProcess(1234, { force: false, tree: false }, processos, new Set<number>()))
      .rejects.toMatchObject({ code: "process_kill_failed" })
  })

  it("retorna process_kill_failed quando processo continua vivo", async () => {
    mockExec((_file, args) => {
      const argv = args as string[]

      if (_file === "taskkill.exe") {
        return { stdout: "Sucesso", stderr: "" }
      }

      // Verificacao de morte: processo ainda esta vivo (formato cru do PowerShell)
      return { stdout: JSON.stringify([jsonProcesso(processo({ pid: 1234 }))]), stderr: "" }
    })

    await expect(killProcess(1234, { force: false, tree: false }, processos, new Set<number>()))
      .rejects.toMatchObject({ code: "process_kill_failed" })
  })
})

describe("collectDriverAncestorPids", () => {
  it("inclui o proprio driver e sobe pela arvore", async () => {
    mockExec(() => ({
      stdout: JSON.stringify([
        jsonProcesso(processo({ pid: process.pid, parentPid: 111, name: "node.exe" })),
        jsonProcesso(processo({ pid: 111, parentPid: 0, name: "tsx.exe" })),
      ]),
      stderr: "",
    }))

    const result = await collectDriverAncestorPids()

    expect(result.has(process.pid)).toBe(true)
    expect(result.has(111)).toBe(true)
  })
})
