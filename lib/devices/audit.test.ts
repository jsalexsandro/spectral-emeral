import { describe, expect, it } from "vitest"
import { sanitizeAuditCommand } from "./audit"

describe("sanitizeAuditCommand", () => {
  it("returns null when there is no command", () => {
    expect(sanitizeAuditCommand(undefined)).toBeNull()
    expect(sanitizeAuditCommand("")).toBeNull()
  })

  it("collapses whitespace and trims", () => {
    expect(sanitizeAuditCommand("  git   status\n\n --short ")).toBe(
      "git status --short",
    )
  })

  it("redacts common secret shapes", () => {
    expect(
      sanitizeAuditCommand("app --password=hunter2 --token abc123"),
    ).toBe("app --password=[redacted] --token [redacted]")
    expect(sanitizeAuditCommand("set API_KEY=secret-value")).toBe(
      "set API_KEY=[redacted]",
    )
    expect(sanitizeAuditCommand("curl -H 'Authorization: Bearer abc.def'")).toBe(
      "curl -H 'Authorization: Bearer [redacted]'",
    )
  })

  it("truncates long commands", () => {
    const sanitized = sanitizeAuditCommand("a".repeat(900))

    expect(sanitized).not.toBeNull()
    expect(sanitized!.endsWith("…")).toBe(true)
    expect(sanitized!.length).toBe(501)
  })
})
