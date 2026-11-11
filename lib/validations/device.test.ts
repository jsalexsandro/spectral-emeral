import { describe, expect, it } from "vitest"
import { renameDeviceSchema } from "./device"

describe("renameDeviceSchema", () => {
  it("accepts clearing the default folder", () => {
    const parsed = renameDeviceSchema.safeParse({
      defaultWorkingDirectory: null,
    })

    expect(parsed.success).toBe(true)
    expect(parsed.success && parsed.data.defaultWorkingDirectory).toBeNull()
  })

  it("accepts the destructive confirmation preference", () => {
    const parsed = renameDeviceSchema.safeParse({ confirmDestructive: false })

    expect(parsed.success).toBe(true)
    expect(parsed.success && parsed.data.confirmDestructive).toBe(false)
  })

  it("rejects non-boolean confirmation values", () => {
    const parsed = renameDeviceSchema.safeParse({
      confirmDestructive: "full",
    })

    expect(parsed.success).toBe(false)
  })

  it("rejects an empty update", () => {
    expect(renameDeviceSchema.safeParse({}).success).toBe(false)
  })
})
