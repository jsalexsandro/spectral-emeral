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

  it("accepts execution level and notes together", () => {
    const parsed = renameDeviceSchema.safeParse({
      executionLevel: "trusted",
      notes: "usar pnpm; não mexer em D:\\Clientes",
    })

    expect(parsed.success).toBe(true)
    expect(parsed.success && parsed.data.executionLevel).toBe("trusted")
  })

  it("rejects unknown execution levels", () => {
    const parsed = renameDeviceSchema.safeParse({ executionLevel: "root" })

    expect(parsed.success).toBe(false)
  })

  it("rejects an empty update", () => {
    expect(renameDeviceSchema.safeParse({}).success).toBe(false)
  })

  it("rejects oversized notes", () => {
    const parsed = renameDeviceSchema.safeParse({
      notes: "a".repeat(8_001),
    })

    expect(parsed.success).toBe(false)
  })
})
