import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

const mockLocate = vi.fn()
const mockRead = vi.fn()
const mockDetectShells = vi.fn()
const mockRefreshShell = vi.fn()

vi.mock("./shell.js", () => ({
  locateCommand: mockLocate,
  readVersion: mockRead,
  detectShells: mockDetectShells,
  refreshShellCache: mockRefreshShell,
}))

const originalPlatform = process.platform
const originalProgramFiles = process.env.ProgramFiles
const originalLocalAppData = process.env.LOCALAPPDATA
const originalUserProfile = process.env.USERPROFILE

beforeEach(() => {
  vi.resetModules()
  mockLocate.mockResolvedValue("C:\\node\\node.exe")
  mockRead.mockResolvedValue("v26.13.1")
  mockDetectShells.mockResolvedValue([])
  mockRefreshShell.mockResolvedValue([])
  delete process.env.ProgramFiles
  delete process.env.LOCALAPPDATA
  delete process.env.USERPROFILE
})

afterEach(() => {
  vi.restoreAllMocks()
  process.env.ProgramFiles = originalProgramFiles
  process.env.LOCALAPPDATA = originalLocalAppData
  process.env.USERPROFILE = originalUserProfile
})

async function importFresh() {
  return await import("./system.js")
}

describe("detectRuntimes / getInstalledRuntimes", () => {
  it("reusa o cache sem refresh e redetecta com refresh: true", async () => {
    const { detectRuntimes: dr, getInstalledRuntimes: gir } = await importFresh()

    const a = await dr({ refresh: false })
    const b = await dr({ refresh: false })
    expect(a).toEqual(b)

    const c = await dr({ refresh: true })
    expect(c).toEqual(a)

    const installed = await gir()
    expect(installed.length).toBeGreaterThan(0)
    expect(installed[0]!.id).toBe("node")
  })

  it("getInstalledRuntimes não exige detecção de shell", async () => {
    mockLocate.mockResolvedValue("C:\\python\\python.exe")
    mockRead.mockResolvedValue("3.14.0")

    const { getInstalledRuntimes } = await importFresh()

    const runtimes = await getInstalledRuntimes()

    expect(runtimes.some((r) => r.id === "python")).toBe(true)
  })
})

describe("clearRuntimeCache", () => {
  it("descarta o cache para nova detecção", async () => {
    let calls = 0
    mockLocate.mockImplementation(() => {
      calls += 1
      return Promise.resolve("C:\\node\\node.exe")
    })

    const { detectRuntimes: dr, clearRuntimeCache: crc } = await importFresh()

    await dr({ refresh: false })
    const first = calls
    await dr({ refresh: false })
    expect(calls).toBe(first)

    crc()
    await dr({ refresh: false })
    expect(calls).toBeGreaterThan(first)
  })
})

describe("fallback de caminhos absolutos", () => {
  it("encontra runtime fora do PATH via caminhos conhecidos", async () => {
    const dir = await mkdtemp(join(tmpdir(), "spectral-fallback-"))
    const nodeDir = join(dir, "nodejs")
    const nodeExe = join(nodeDir, "node.exe")
    await mkdir(nodeDir, { recursive: true })
    await writeFile(nodeExe, "#!node", { encoding: "utf8" })

    process.env.ProgramFiles = dir
    process.env.LOCALAPPDATA = dir
    process.env.USERPROFILE = dir

    mockLocate.mockResolvedValue(null)
    mockRead.mockResolvedValue("v26.13.1")

    const { detectRuntimes } = await importFresh()

    const runtimes = await detectRuntimes({ refresh: true })

    expect(runtimes.some((r) => r.id === "node" && r.path === nodeExe)).toBe(true)

    await rm(dir, { recursive: true, force: true })
  })

  it("não encontra quando nem PATH nem caminho absoluto existem", async () => {
    process.env.ProgramFiles = join(tmpdir(), "nao-existe")
    mockLocate.mockResolvedValue(null)
    mockRead.mockResolvedValue(null)

    const { detectRuntimes } = await importFresh()

    const runtimes = await detectRuntimes({ refresh: true })

    expect(runtimes.some((r) => r.id === "node")).toBe(false)
  })
})

describe("getDeviceEnv refresh", () => {
  it("refresh: true limpa runtimes e shells", async () => {
    const { getDeviceEnv: gde } = await importFresh()

    await gde("C:\\pasta", { refresh: true })

    expect(mockRefreshShell).toHaveBeenCalled()
    expect(mockLocate).toHaveBeenCalled()
  })
})
