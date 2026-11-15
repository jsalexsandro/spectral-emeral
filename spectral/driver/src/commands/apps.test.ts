import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { execFile } from "node:child_process"
import { isStoreAppTarget } from "../../../shared/device-commands.js"
import {
  listAvailableApps,
  resolveOpenableApp,
} from "./apps.js"

const mockExecFile = execFile as unknown as ReturnType<typeof vi.fn>

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}))

function mockDiscovery(stdout: string) {
  ;(mockExecFile as ReturnType<typeof vi.fn>).mockImplementation(
    (_file: string, _args: unknown[], _options: unknown, callback: (error: unknown | null, result: { stdout: string; stderr: string }) => void) => {
      callback(null, { stdout, stderr: "" })
    },
  )
}

beforeEach(() => {
  mockDiscovery("")
})

afterEach(() => {
  ;(mockExecFile as ReturnType<typeof vi.fn>).mockReset()
})

describe("descoberta de apps (Menu Iniciar, App Paths e Windows Store)", () => {
  it("descobre apps da Store via Get-StartApps com source store", async () => {
    const stdout = JSON.stringify([
      { name: "Spotify", target: "SpotifyAB.SpotifyMusic_zpdnekdrzrea0!Spotify", source: "store" },
      { name: "Bloco de Notas", target: "Microsoft.WindowsNotepad_8wekyb3d8bbwe!App", source: "store" },
    ])
    mockDiscovery(stdout)

    // refresh: true ignora o cache de descoberta e força nova varredura
    const apps = await listAvailableApps({ refresh: true })

    const storeApps = apps.filter((app) => app.source === "store")
    expect(storeApps.length).toBeGreaterThanOrEqual(2)
    expect(storeApps.some((app) => app.name === "Spotify")).toBe(true)
    expect(
      storeApps.some(
        (app) =>
          app.target === "SpotifyAB.SpotifyMusic_zpdnekdrzrea0!Spotify",
      ),
    ).toBe(true)
  })

  it("filtra alvos dentro de WindowsApps (shims do spotify_cli)", async () => {
    const stdout = JSON.stringify([
      {
        name: "Spotify",
        target:
          "C:\\Program Files\\WindowsApps\\SpotifyAB.SpotifyMusic_1.309.2055.0_x64__zpdnekdrzrea0\\spotify_cli.exe",
        source: "app-path",
      },
    ])
    mockDiscovery(stdout)

    const apps = await listAvailableApps({ refresh: true })

    const shim = apps.find(
      (app) => app.name === "Spotify" && app.source === "app-path",
    )
    expect(shim).toBeUndefined()
  })

  it("resolveOpenableApp resolve um app da Store pelo id descoberto", async () => {
    const stdout = JSON.stringify([
      { name: "Spotify", target: "SpotifyAB.SpotifyMusic_zpdnekdrzrea0!Spotify", source: "store" },
    ])
    mockDiscovery(stdout)

    const list = await listAvailableApps({ refresh: true })
    const spotify = list.find(
      (a) => a.name === "Spotify" && a.source === "store",
    )
    expect(spotify).toBeDefined()
    expect(spotify?.target).toBe("SpotifyAB.SpotifyMusic_zpdnekdrzrea0!Spotify")

    const resolved = await resolveOpenableApp(spotify!.id)
    expect(resolved?.name).toBe("Spotify")
    expect(resolved?.target).toBe("SpotifyAB.SpotifyMusic_zpdnekdrzrea0!Spotify")
  })

  it("isStoreAppTarget detecta AUMID e rejeita caminhos com extensao", () => {
    expect(isStoreAppTarget("SpotifyAB.SpotifyMusic_zpdnekdrzrea0!Spotify")).toBe(true)
    expect(isStoreAppTarget("C:\\Program Files\\App\\app.exe")).toBe(false)
    expect(isStoreAppTarget("notepad.exe")).toBe(false)
    expect(isStoreAppTarget("C:\\x\\atalho.lnk")).toBe(false)
  })
})
