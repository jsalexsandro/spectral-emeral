import { describe, expect, it } from "vitest"
import {
  findCustomApp,
  matchCustomApps,
  parseDeviceCustomApps,
  toCustomAppInfo,
} from "./custom-apps"

describe("device custom apps", () => {
  it("normaliza, descarta entradas inválidas e remove duplicatas", () => {
    const apps = parseDeviceCustomApps([
      { name: " Zed ", path: "C:\\Programas\\Zed\\Zed.exe" },
      { name: "Zed", path: "C:\\Programas\\Zed\\Zed.exe" },
      { name: "", path: "C:\\Apps\\x.exe" },
      { name: "Relativo", path: "app.exe" },
      { name: "Controle", path: "C:\\a\u0000b.exe" },
      "não é objeto",
    ])

    expect(apps).toEqual([
      { name: "Zed", path: "C:\\Programas\\Zed\\Zed.exe" },
    ])
  })

  it("converte para DeviceAppInfo e encontra por id", () => {
    const apps = parseDeviceCustomApps([
      { name: "Zed", path: "C:\\Programas\\Zed\\Zed.exe" },
    ])
    const info = toCustomAppInfo(apps[0]!)

    expect(info.source).toBe("custom")
    expect(info.target).toBe("C:\\Programas\\Zed\\Zed.exe")
    expect(findCustomApp(apps, info.id)?.name).toBe("Zed")
    expect(findCustomApp(apps, "nao-existe")).toBeUndefined()
  })

  it("filtra por nome, id ou caminho sem acento", () => {
    const apps = parseDeviceCustomApps([
      { name: "Zed", path: "C:\\Programas\\Zed\\Zed.exe" },
      { name: "Ação", path: "C:\\Programas\\Acao\\Acao.exe" },
    ])

    expect(matchCustomApps(apps, "zed", 10)).toHaveLength(1)
    expect(matchCustomApps(apps, "acao", 10)[0]?.name).toBe("Ação")
    expect(matchCustomApps(apps, "Programas\\Zed", 10)).toHaveLength(1)
    expect(matchCustomApps(apps, "", 10)).toHaveLength(2)
    expect(matchCustomApps(apps, "", 1)).toHaveLength(1)
  })
})
