import { describe, expect, it } from "vitest"
import {
  parseDeviceCommand,
  deviceCommandTimeoutMs,
  DEVICE_TOOLCHAIN_IDS,
  isInlineScriptCommand,
  isRuntimeInstallCommand,
} from "./device-commands.js"

describe("parseDeviceCommand — setup-toolchain", () => {
  it("aceita um id válido do catálogo", () => {
    const cmd = parseDeviceCommand("setup-toolchain", { toolchain: "node" })

    expect(cmd).toEqual({ command: "setup-toolchain", input: { toolchain: "node" } })
  })

  for (const id of DEVICE_TOOLCHAIN_IDS) {
    it(`aceita ${id}`, () => {
      const cmd = parseDeviceCommand("setup-toolchain", { toolchain: id })

      expect(cmd.input.toolchain).toBe(id)
    })
  }

  it("recusa id fora do catálogo", () => {
    let erro: unknown = null

    try {
      parseDeviceCommand("setup-toolchain", { toolchain: "not-a-runtime" })
    } catch (e) {
      erro = e
    }

    expect(erro).toMatchObject({ code: "invalid_toolchain" })
  })

  it("recusa id vazio", () => {
    let erro: unknown = null

    try {
      parseDeviceCommand("setup-toolchain", { toolchain: "" })
    } catch (e) {
      erro = e
    }

    expect(erro).toMatchObject({ code: "invalid_toolchain" })
  })

  it("é case sensitive (maiúsculas recusadas)", () => {
    let erro: unknown = null

    try {
      parseDeviceCommand("setup-toolchain", { toolchain: "NODE" })
    } catch (e) {
      erro = e
    }

    expect(erro).toMatchObject({ code: "invalid_toolchain" })
  })

  it("aceita packageId livre (qualquer pacote winget)", () => {
    const cmd = parseDeviceCommand("setup-toolchain", {
      packageId: "7zip.7zip",
    })

    expect(cmd).toEqual({
      command: "setup-toolchain",
      input: { packageId: "7zip.7zip" },
    })
  })

  it("aceita packageId livre com scope machine", () => {
    const cmd = parseDeviceCommand("setup-toolchain", {
      packageId: "Docker.DockerDesktop",
      scope: "machine",
    })

    expect(cmd).toEqual({
      command: "setup-toolchain",
      input: { packageId: "Docker.DockerDesktop", scope: "machine" },
    })
  })

  it("recusa input sem toolchain nem packageId", () => {
    let erro: unknown = null

    try {
      parseDeviceCommand("setup-toolchain", {})
    } catch (e) {
      erro = e
    }

    expect(erro).toMatchObject({ code: "invalid_toolchain" })
  })

  it("recusa packageId vazio", () => {
    let erro: unknown = null

    try {
      parseDeviceCommand("setup-toolchain", { packageId: "" })
    } catch (e) {
      erro = e
    }

    expect(erro).toMatchObject({ code: "invalid_package_id" })
  })

  it("aceita version com toolchain do catálogo", () => {
    const cmd = parseDeviceCommand("setup-toolchain", {
      toolchain: "node",
      version: "20.0.0",
    })

    expect(cmd).toEqual({
      command: "setup-toolchain",
      input: { toolchain: "node", version: "20.0.0" },
    })
  })

  it("aceita version com packageId livre", () => {
    const cmd = parseDeviceCommand("setup-toolchain", {
      packageId: "7zip.7zip",
      version: "24.1.0",
    })

    expect(cmd).toEqual({
      command: "setup-toolchain",
      input: { packageId: "7zip.7zip", version: "24.1.0" },
    })
  })

  it("aceita action upgrade com toolchain do catálogo", () => {
    const cmd = parseDeviceCommand("setup-toolchain", {
      toolchain: "python",
      action: "upgrade",
    })

    expect(cmd).toEqual({
      command: "setup-toolchain",
      input: { toolchain: "python", action: "upgrade" },
    })
  })

  it("aceita action upgrade com version", () => {
    const cmd = parseDeviceCommand("setup-toolchain", {
      toolchain: "node",
      action: "upgrade",
      version: "22.0.0",
    })

    expect(cmd).toEqual({
      command: "setup-toolchain",
      input: { toolchain: "node", action: "upgrade", version: "22.0.0" },
    })
  })

  it("recusa version vazia", () => {
    let erro: unknown = null

    try {
      parseDeviceCommand("setup-toolchain", { toolchain: "node", version: "" })
    } catch (e) {
      erro = e
    }

    expect(erro).toMatchObject({ code: "invalid_version" })
  })
})

describe("parseDeviceCommand — get-env", () => {
  it("sem refresh envia input vazio", () => {
    const cmd = parseDeviceCommand("get-env", {})

    expect(cmd).toEqual({ command: "get-env", input: {} })
  })

  it("refresh: true é repassado", () => {
    const cmd = parseDeviceCommand("get-env", { refresh: true })

    expect(cmd).toEqual({ command: "get-env", input: { refresh: true } })
  })

  it("refresh: false é repassado", () => {
    const cmd = parseDeviceCommand("get-env", { refresh: false })

    expect(cmd).toEqual({ command: "get-env", input: { refresh: false } })
  })
})

describe("deviceCommandTimeoutMs", () => {
  it("setup-toolchain tem teto de 20 s", () => {
    const cmd = parseDeviceCommand("setup-toolchain", { toolchain: "uv" })

    expect(deviceCommandTimeoutMs(cmd)).toBe(20_000)
  })

  it("get-env não declara teto (usa default do transporte)", () => {
    const cmd = parseDeviceCommand("get-env", {})

    expect(deviceCommandTimeoutMs(cmd)).toBeUndefined()
  })
})

describe("parseDeviceCommand — run-command", () => {
  it("aceita qualquer executável por PATH", () => {
    for (const command of ["node", "git", "npm", "curl", "powershell"]) {
      const cmd = parseDeviceCommand("run-command", { command })

      expect(cmd).toMatchObject({ command: "run-command", input: { command } })
    }
  })

  it("aceita caminho absoluto do Windows com barras e espaços", () => {
    const command = "C:\\Program Files\\nodejs\\node.exe"
    const cmd = parseDeviceCommand("run-command", {
      command,
      args: ["C:\\projeto\\script.js"],
    })

    expect(cmd).toMatchObject({
      command: "run-command",
      input: { command, args: ["C:\\projeto\\script.js"] },
    })
  })

  it("continua recusando operadores de shell", () => {
    expect(() =>
      parseDeviceCommand("run-command", { command: "node && npm test" }),
    ).toThrow()
    expect(() =>
      parseDeviceCommand("run-command", {
        command: "node",
        args: ["-e \"console.log(1)\""],
      }),
    ).toThrow()
  })
})

describe("barreiras compartilhadas de execução", () => {
  it("detecta instalação de runtime sem confundir dependências do projeto", () => {
    for (const text of [
      "winget install OpenJS.NodeJS.LTS",
      "npm i -g some-cli",
      "pip install requests",
      "python -m pip install requests",
      "msiexec /i setup.msi /qn",
    ]) {
      expect(isRuntimeInstallCommand(text)).toBe(true)
    }

    for (const text of [
      "winget list",
      "npm install",
      "pnpm install --frozen-lockfile",
      "npm run build",
      "git status",
    ]) {
      expect(isRuntimeInstallCommand(text)).toBe(false)
    }
  })

  it("detecta script interpolado em linha de comando", () => {
    expect(isInlineScriptCommand("powershell.exe", ["-NoProfile", "-Command", "Write-Output 1"])).toBe(true)
    expect(isInlineScriptCommand("cmd.exe", ["/c", "dir"])).toBe(true)
    expect(isInlineScriptCommand("python", ["-c", "print(1)"])).toBe(true)
    expect(isInlineScriptCommand("C:\\Program Files\\nodejs\\node.exe", ["--eval", "1+1"])).toBe(true)
    expect(isInlineScriptCommand("node", ["-v"])).toBe(false)
    expect(isInlineScriptCommand("git", ["status"])).toBe(false)
  })
})
