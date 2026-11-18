import { describe, expect, it } from "vitest"
import { SYSTEM_PROMPT_VERSION, systemPromptChangelog } from "./registry.js"

describe("prompt registry", () => {
  it("versão atual é 45", () => {
    expect(SYSTEM_PROMPT_VERSION).toBe(45)
  })

  it("changelog termina na v45 com instalação livre no driver", () => {
    const ultimo = systemPromptChangelog[systemPromptChangelog.length - 1]

    expect(ultimo.version).toBe(45)
    expect(ultimo.summary.toLowerCase()).toContain("driver")
    expect(ultimo.summary.toLowerCase()).toContain("instalação")
    expect(ultimo.summary.toLowerCase()).toContain("confirminstall")
    expect(ultimo.summary.toLowerCase()).toContain("setup-toolchain")
  })
})
