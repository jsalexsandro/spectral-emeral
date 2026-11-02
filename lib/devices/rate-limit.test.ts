import { afterEach, describe, expect, it } from "vitest"
import { checkRateLimit, resetRateLimit } from "./rate-limit"

afterEach(() => {
  resetRateLimit()
})

describe("device rate limit", () => {
  it("allows requests up to the limit", () => {
    const now = 1_000

    expect(checkRateLimit("key", 2, 1_000, now).ok).toBe(true)
    expect(checkRateLimit("key", 2, 1_000, now + 1).ok).toBe(true)
    expect(checkRateLimit("key", 2, 1_000, now + 2).ok).toBe(false)
  })

  it("resets after the window", () => {
    expect(checkRateLimit("key", 1, 1_000, 0).ok).toBe(true)
    expect(checkRateLimit("key", 1, 1_000, 500).ok).toBe(false)
    expect(checkRateLimit("key", 1, 1_000, 1_000).ok).toBe(true)
  })

  it("tracks keys independently", () => {
    expect(checkRateLimit("a", 1, 1_000, 0).ok).toBe(true)
    expect(checkRateLimit("a", 1, 1_000, 0).ok).toBe(false)
    expect(checkRateLimit("b", 1, 1_000, 0).ok).toBe(true)
  })

  it("reports retry information", () => {
    expect(checkRateLimit("key", 1, 5_000, 0).ok).toBe(true)

    const result = checkRateLimit("key", 1, 5_000, 2_500)

    expect(result.ok).toBe(false)

    if (!result.ok) {
      expect(result.retryAfterMs).toBe(2_500)
      expect(result.resetAt).toBe(5_000)
    }
  })
})
