import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { DEVICE_TOOLCHAIN_IDS } from "../../../shared/device-commands.js"

const mockLocate = vi.fn()
const mockRead = vi.fn()
const mockGetOs = vi.fn()
const mockStartJob = vi.fn()

vi.mock("./shell.js", () => ({
  locateCommand: mockLocate,
  readVersion: mockRead,
}))
vi.mock("./system.js", () => ({
  getOsInfo: mockGetOs,
}))
vi.mock("./jobs.js", () => ({
  startJob: mockStartJob,
}))

const originalPlatform = process.platform

beforeEach(() => {
  vi.resetModules()
  vi.spyOn(process, "platform", "get").mockReturnValue(originalPlatform)
  mockLocate.mockResolvedValue("C:\\Windows\\System32\\winget.exe")
  mockRead.mockResolvedValue(null)
  mockGetOs.mockReturnValue({
    elevated: true,
    platform: "win32",
    architecture: "x64",
  })
  mockStartJob.mockResolvedValue({ id: "job-1" })
})

afterEach(() => {
  vi.restoreAllMocks()
  Object.defineProperty(process, "platform", {
    value: originalPlatform,
    configurable: true,
  })
})

async function importFresh() {
  return await import("./toolchain.js")
}

describe("resolveToolchain", () => {
  it("todo id do catálogo fechado tem entrada", async () => {
    const { resolveToolchain } = await importFresh()

    for (const id of DEVICE_TOOLCHAIN_IDS) {
      const entry = resolveToolchain(id)

      expect(entry.id).toBe(id)
      expect(entry.packageId.length).toBeGreaterThan(0)
      expect(entry.detect.length).toBeGreaterThan(0)
      expect(["user", "machine"]).toContain(entry.scope)
    }
  })

  it("recusa id fora do catálogo", async () => {
    const { resolveToolchain } = await importFresh()

    let erro: unknown = null

    try {
      resolveToolchain("not-a-runtime" as typeof DEVICE_TOOLCHAIN_IDS[number])
    } catch (e) {
      erro = e
    }

    expect(erro).toMatchObject({ code: "invalid_toolchain" })
  })
})

describe("setupToolchain", () => {
  it("rejeita fora do Windows", async () => {
    Object.defineProperty(process, "platform", {
      value: "darwin",
      configurable: true,
    })

    const { setupToolchain } = await importFresh()

    await expect(
      setupToolchain({ toolchain: "node" }, "C:\\pasta"),
    ).rejects.toMatchObject({ code: "unsupported_platform" })
  })

  it("erro winget_missing quando winget não existe", async () => {
    mockLocate.mockResolvedValue(null)

    const { setupToolchain } = await importFresh()

    await expect(
      setupToolchain({ toolchain: "node" }, "C:\\pasta"),
    ).rejects.toMatchObject({ code: "winget_missing" })
  })

  it("já instalado retorna already_installed sem job", async () => {
    mockRead.mockResolvedValue("v26.13.1")

    const { setupToolchain } = await importFresh()

    const result = await setupToolchain({ toolchain: "node" }, "C:\\pasta")

    expect(result.toolchain.action).toBe("already_installed")
    expect(result.toolchain.version).toBe("v26.13.1")
    expect(result.jobId).toBeNull()
    expect(mockStartJob).not.toHaveBeenCalled()
  })

  it("inicia job com label e teto de 15 min", async () => {
    mockRead.mockResolvedValue(null)

    const { setupToolchain } = await importFresh()

    const result = await setupToolchain({ toolchain: "uv" }, "C:\\projeto")

    expect(result.toolchain.action).toBe("install")
    expect(result.toolchain.jobId).toBe("job-1")
    expect(result.jobId).toBe("job-1")
    expect(mockStartJob).toHaveBeenCalledWith(
      {
        script: expect.stringContaining(
          "winget install --exact --id astral-sh.uv",
        ),
        shell: "powershell",
        label: "winget: uv",
        maxRuntimeMs: 15 * 60_000,
      },
      "C:\\projeto",
    )
  })

  it("machine sem elevação falha com elevation_required", async () => {
    mockGetOs.mockReturnValue({ elevated: false, platform: "win32" })

    const { setupToolchain } = await importFresh()

    await expect(
      setupToolchain({ toolchain: "git" }, "C:\\pasta"),
    ).rejects.toMatchObject({ code: "elevation_required" })
  })

  it("user não exige elevação", async () => {
    mockGetOs.mockReturnValue({ elevated: false, platform: "win32" })
    mockRead.mockResolvedValue(null)

    const { setupToolchain } = await importFresh()

    await setupToolchain({ toolchain: "node" }, "C:\\pasta")

    expect(mockStartJob).toHaveBeenCalled()
  })
})

describe("isToolchainInstalling", () => {
  it("começa false", async () => {
    const { isToolchainInstalling } = await importFresh()

    expect(isToolchainInstalling()).toBe(false)
  })
})
