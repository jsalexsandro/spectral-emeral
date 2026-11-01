import { describe, expect, it } from "vitest"
import {
  ACTION_CATALOG_VERSION,
  aiActionSchema,
  appActionSchema,
  isAllowedAppPath,
  runActionOutputSchema,
  toastActionSchema,
} from "./catalog"

describe("action catalog", () => {
  it("keeps the catalog version at 1", () => {
    expect(ACTION_CATALOG_VERSION).toBe(1)
  })

  it("allows sendMessage only for host actions", () => {
    const action = { type: "sendMessage", text: "Confirmar" }

    expect(appActionSchema.safeParse(action).success).toBe(true)
    expect(aiActionSchema.safeParse(action).success).toBe(false)
  })

  it("applies the default toast variant", () => {
    const parsed = toastActionSchema.parse({
      type: "toast",
      title: "Pronto",
    })

    expect(parsed.variant).toBe("default")
  })

  it("accepts only allowlisted navigation paths", () => {
    expect(isAllowedAppPath("/app")).toBe(true)
    expect(isAllowedAppPath("/providers/select-model")).toBe(true)
    expect(isAllowedAppPath("/provider/openai/models")).toBe(true)
    expect(isAllowedAppPath("/provider/google/models")).toBe(true)
    expect(isAllowedAppPath("/provider/invalid/models")).toBe(false)
    expect(isAllowedAppPath("https://example.com/app")).toBe(false)
    expect(isAllowedAppPath("//evil.example/app")).toBe(false)
    expect(isAllowedAppPath("/provider/openai/models?x=1")).toBe(false)
  })

  it("rejects invalid settings sections", () => {
    expect(
      appActionSchema.safeParse({
        type: "openSettings",
        section: "byok",
      }).success,
    ).toBe(true)

    expect(
      appActionSchema.safeParse({
        type: "openSettings",
        section: "billing",
      }).success,
    ).toBe(false)
  })

  it("validates the server acknowledgement payload", () => {
    expect(
      runActionOutputSchema.safeParse({
        ok: true,
        action: { type: "setTheme", theme: "dark" },
      }).success,
    ).toBe(true)

    expect(
      runActionOutputSchema.safeParse({
        ok: true,
        action: { type: "sendMessage", text: "oi" },
      }).success,
    ).toBe(false)
  })
})
