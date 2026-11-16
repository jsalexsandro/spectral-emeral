import { describe, expect, it } from "vitest"
import {
  parseDeviceCommand,
  deviceCommandTimeoutMs,
  DEVICE_TOOLCHAIN_IDS,
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

  it("recusa input sem o campo toolchain", () => {
    let erro: unknown = null

    try {
      parseDeviceCommand("setup-toolchain", {})
    } catch (e) {
      erro = e
    }

    expect(erro).toMatchObject({ code: "invalid_toolchain" })
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
