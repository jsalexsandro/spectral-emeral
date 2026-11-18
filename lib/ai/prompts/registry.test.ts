import { describe, expect, it } from "vitest"
import { SYSTEM_PROMPT_VERSION, systemPromptChangelog } from "./registry.js"

describe("prompt registry", () => {
  it("versão atual é 44", () => {
    expect(SYSTEM_PROMPT_VERSION).toBe(44)
  })

  it("changelog termina na v44 com execução em camadas", () => {
    const ultimo = systemPromptChangelog[systemPromptChangelog.length - 1]

    expect(ultimo.version).toBe(44)
    expect(ultimo.summary.toLowerCase()).toContain("run-command")
    expect(ultimo.summary.toLowerCase()).toContain("device-shell")
    expect(ultimo.summary.toLowerCase()).toContain("device-job-start")
    expect(ultimo.summary.toLowerCase()).toContain("setup-toolchain")
  })
})
