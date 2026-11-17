import { describe, expect, it } from "vitest"
import { SYSTEM_PROMPT_VERSION, systemPromptChangelog } from "./registry.js"

describe("prompt registry", () => {
  it("versão atual é 43", () => {
    expect(SYSTEM_PROMPT_VERSION).toBe(43)
  })

  it("changelog termina na v43 com run-snippet sem lista fechada", () => {
    const ultimo = systemPromptChangelog[systemPromptChangelog.length - 1]

    expect(ultimo.version).toBe(43)
    expect(ultimo.summary.toLowerCase()).toContain("run-snippet")
    expect(ultimo.summary.toLowerCase()).toContain("sem lista fechada")
  })
})
