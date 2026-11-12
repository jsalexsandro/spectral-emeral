import { describe, expect, it, beforeAll, afterAll } from "vitest"
import {
  listCatalogApps,
  registerCatalogApp,
  removeCatalogApp,
  resolveCatalogApp,
  type CatalogApp,
} from "./catalog.js"

const originalHome = process.env.SPECTRAL_DRIVER_HOME
const tmpDir = `C:\\spectral-catalog-test-${Date.now()}`

describe("catalog", () => {
  beforeAll(async () => {
    process.env.SPECTRAL_DRIVER_HOME = tmpDir
    // Requisitar módulo novamente não é possível; as funções já capturam
    // loadConfig no momento da chamada, então mudar a env antes de chamar
    // basta.
  })

  afterAll(async () => {
    process.env.SPECTRAL_DRIVER_HOME = originalHome
  })

  it("round-trip: registra, resolve, lista e remove um app", async () => {
    const app = await registerCatalogApp({
      name: "Zed",
      path: "C:\\Programas\\Zed\\Zed.exe",
      args: ["."],
      cwd: "C:\\projeto",
    })

    expect(app.id).toMatch(/^zed-[0-9a-f]{6}$/)
    expect(app.name).toBe("Zed")
    expect(app.path).toBe("C:\\Programas\\Zed\\Zed.exe")
    expect(app.args).toEqual(["."])
    expect(app.cwd).toBe("C:\\projeto")
    expect(app.createdAt).toBeDefined()

    const resolved = await resolveCatalogApp(app.id)
    expect(resolved?.id).toBe(app.id)
    expect(resolved?.args).toEqual(["."])
    expect(resolved?.cwd).toBe("C:\\projeto")

    const apps = await listCatalogApps()
    expect(apps.some((a) => a.id === app.id)).toBe(true)
    expect(apps.find((a) => a.id === app.id)?.source).toBe("custom")

    const removed = await removeCatalogApp(app.id)
    expect(removed).toBe(true)

    const after = await resolveCatalogApp(app.id)
    expect(after).toBeUndefined()

    const restante = await listCatalogApps()
    expect(restante.length).toBe(0)
  })

  it("é idempotente ao cadastrar o mesmo caminho", async () => {
    const primeiro = await registerCatalogApp({
      name: "Zed",
      path: "C:\\Programas\\Zed\\Zed.exe",
    })
    const segundo = await registerCatalogApp({
      name: "Zed Atualizado",
      path: "C:\\Programas\\Zed\\Zed.exe",
      args: ["--verbose"],
    })

    expect(segundo.id).toBe(primeiro.id)
    expect(segundo.name).toBe("Zed Atualizado")
    expect(segundo.args).toEqual(["--verbose"])

    const apps = await listCatalogApps()
    expect(apps.filter((a) => a.id === primeiro.id).length).toBe(1)
  })

  it("retorna falso ao remover app inexistente", async () => {
    const removed = await removeCatalogApp("nao-existe")
    expect(removed).toBe(false)
  })

  it("descarta entradas inválidas do catálogo", async () => {
    // Registrar um app válido e depois corromper o arquivo manualmente
    await registerCatalogApp({
      name: "Valido",
      path: "C:\\x\\valido.exe",
    })

    const fs = await import("node:fs/promises")
    const path = await import("node:path")
    const file = path.join(tmpDir, "apps.json")
    await fs.writeFile(file, "lixo", "utf8")

    const apps = await listCatalogApps()
    expect(apps).toEqual([])
  })
})
