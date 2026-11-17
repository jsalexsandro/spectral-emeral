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
  mockStartJob.mockClear()
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
        label: "winget install: uv",
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

  it("packageId livre inicia job sem detecção de já instalado", async () => {
    mockRead.mockResolvedValue(null)

    const { setupToolchain } = await importFresh()

    const result = await setupToolchain(
      { packageId: "7zip.7zip" },
      "C:\\pasta",
    )

    expect(result.toolchain.action).toBe("install")
    expect(result.toolchain.packageId).toBe("7zip.7zip")
    expect(result.toolchain.jobId).toBe("job-1")
    expect(mockStartJob).toHaveBeenCalledWith(
      {
        script: expect.stringContaining("winget install --exact --id 7zip.7zip"),
        shell: "powershell",
        label: "winget install: 7zip.7zip",
        maxRuntimeMs: 15 * 60_000,
      },
      "C:\\pasta",
    )
  })

  it("packageId livre com scope machine não exige elevação no driver", async () => {
    mockGetOs.mockReturnValue({ elevated: false, platform: "win32" })
    mockRead.mockResolvedValue(null)

    const { setupToolchain } = await importFresh()

    const result = await setupToolchain(
      { packageId: "Docker.DockerDesktop", scope: "machine" },
      "C:\\pasta",
    )

    expect(result.toolchain.action).toBe("install")
    expect(result.toolchain.packageId).toBe("Docker.DockerDesktop")
    expect(mockStartJob).toHaveBeenCalledWith(
      {
        script: expect.stringContaining("winget install --exact --id Docker.DockerDesktop"),
        shell: "powershell",
        label: "winget install: Docker.DockerDesktop",
        maxRuntimeMs: 15 * 60_000,
      },
      "C:\\pasta",
    )
    // scope machine não adiciona --scope (padrão do winget)
    const callScript = mockStartJob.mock.calls[0]![0].script
    expect(callScript).not.toContain("--scope user")
  })

  it("desinstala pacote livre (uninstall)", async () => {
    mockRead.mockResolvedValue(null)

    const { setupToolchain } = await importFresh()

    const result = await setupToolchain(
      { packageId: "7zip.7zip", action: "uninstall" },
      "C:\\pasta",
    )

    expect(result.toolchain.action).toBe("uninstalled")
    expect(result.toolchain.packageId).toBe("7zip.7zip")
    expect(result.toolchain.jobId).toBe("job-1")
    expect(mockStartJob).toHaveBeenCalledWith(
      {
        script: expect.stringContaining("winget uninstall --exact --id 7zip.7zip"),
        shell: "powershell",
        label: "winget uninstall: 7zip.7zip",
        maxRuntimeMs: 15 * 60_000,
      },
      "C:\\pasta",
    )
  })

  it("desinstala do catálogo fechado (uninstall)", async () => {
    mockRead.mockResolvedValue(null)

    const { setupToolchain } = await importFresh()

    const result = await setupToolchain(
      { toolchain: "node", action: "uninstall" },
      "C:\\projeto",
    )

    expect(result.toolchain.action).toBe("uninstalled")
    expect(result.toolchain.packageId).toBe("OpenJS.NodeJS.LTS")
    expect(mockStartJob).toHaveBeenCalledWith(
      {
        script: expect.stringContaining("winget uninstall --exact --id OpenJS.NodeJS.LTS"),
        shell: "powershell",
        label: "winget uninstall: Node.js LTS",
        maxRuntimeMs: 15 * 60_000,
      },
      "C:\\projeto",
    )
  })

  it("atualiza pacote do catálogo fechado (upgrade)", async () => {
    mockRead.mockResolvedValue("18.0.0")

    const { setupToolchain } = await importFresh()

    const result = await setupToolchain(
      { toolchain: "node", action: "upgrade", version: "20.0.0" },
      "C:\\projeto",
    )

    expect(result.toolchain.action).toBe("upgraded")
    expect(result.toolchain.packageId).toBe("OpenJS.NodeJS.LTS")
    expect(result.toolchain.jobId).toBe("job-1")
    expect(mockStartJob).toHaveBeenCalledWith(
      {
        script: expect.stringMatching(
          /winget upgrade --exact --id OpenJS.NodeJS.LTS.*--version 20\.0\.0/,
        ),
        shell: "powershell",
        label: "winget upgrade: Node.js LTS",
        maxRuntimeMs: 15 * 60_000,
      },
      "C:\\projeto",
    )
  })

  it("upgrade sem versão instalada falha com not_installed", async () => {
    mockRead.mockResolvedValue(null)

    const { setupToolchain } = await importFresh()

    await expect(
      setupToolchain(
        { toolchain: "node", action: "upgrade", version: "20.0.0" },
        "C:\\pasta",
      ),
    ).rejects.toMatchObject({ code: "not_installed" })
  })

  it("upgrade com versão já instalada retorna already_installed", async () => {
    mockRead.mockResolvedValue("20.0.0")

    const { setupToolchain } = await importFresh()

    const result = await setupToolchain(
      { toolchain: "node", action: "upgrade", version: "20.0.0" },
      "C:\\projeto",
    )

    expect(result.toolchain.action).toBe("already_installed")
    expect(result.toolchain.version).toBe("20.0.0")
    expect(result.jobId).toBeNull()
    expect(mockStartJob).not.toHaveBeenCalled()
  })

  it("instala versão específica (install com version)", async () => {
    mockRead.mockResolvedValue(null)

    const { setupToolchain } = await importFresh()

    const result = await setupToolchain(
      { toolchain: "node", version: "20.0.0" },
      "C:\\projeto",
    )

    expect(result.toolchain.action).toBe("install")
    expect(result.toolchain.packageId).toBe("OpenJS.NodeJS.LTS")
    expect(mockStartJob).toHaveBeenCalledWith(
      {
        script: expect.stringMatching(
          /winget install --exact --id OpenJS.NodeJS.LTS.*--version 20\.0\.0/,
        ),
        shell: "powershell",
        label: "winget install: Node.js LTS",
        maxRuntimeMs: 15 * 60_000,
      },
      "C:\\projeto",
    )
  })

  it("recusa action inválido", async () => {
    const { setupToolchain } = await importFresh()

    await expect(
      // @ts-ignore - testando entrada inválida
      setupToolchain({ packageId: "7zip.7zip", action: "remover" as any }, "C:\\pasta"),
    ).rejects.toMatchObject({ code: "invalid_action" })
  })

  it("recusa setup-toolchain sem toolchain nem packageId", async () => {
    const { setupToolchain } = await importFresh()

    await expect(
      // @ts-ignore - testando entrada inválida
      setupToolchain({}, "C:\\pasta"),
    ).rejects.toMatchObject({ code: "invalid_toolchain" })
  })
})

describe("isToolchainInstalling", () => {
  it("começa false", async () => {
    const { isToolchainInstalling } = await importFresh()

    expect(isToolchainInstalling()).toBe(false)
  })
})
