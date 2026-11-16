import { describe, expect, it } from "vitest"
import { SYSTEM_PROMPT_VERSION, systemPromptChangelog } from "./registry.js"

describe("prompt registry", () => {
  it("versão atual é 42", () => {
    expect(SYSTEM_PROMPT_VERSION).toBe(42)
  })

  it("changelog termina na v42 com a toolchain via winget", () => {
    const ultimo = systemPromptChangelog[systemPromptChangelog.length - 1]

    expect(ultimo.version).toBe(42)
    expect(ultimo.summary.toLowerCase()).toContain("winget")
    expect(ultimo.summary.toLowerCase()).toContain("aprovacao")
  })
})
