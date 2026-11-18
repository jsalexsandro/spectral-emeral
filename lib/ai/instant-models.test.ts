import { describe, expect, it } from "vitest"
import { getFallbackCandidateModels } from "./instant-models"

describe("getFallbackCandidateModels", () => {
  it("exclui o modelo primário e prioriza outros provedores", () => {
    const candidates = getFallbackCandidateModels(
      ["openai", "anthropic", "google"],
      [],
      { provider: "openai", modelId: "gpt-4o" },
      3,
    )

    expect(candidates).toHaveLength(3)
    expect(candidates[0]?.provider).toBe("anthropic")
    expect(candidates[1]?.provider).toBe("google")
    expect(candidates[2]?.provider).toBe("openai")
    expect(candidates[2]?.modelId).not.toBe("gpt-4o")
  })

  it("respeita modelos desativados", () => {
    const candidates = getFallbackCandidateModels(
      ["openai", "anthropic"],
      [
        {
          provider: "openai",
          modelId: "gpt-4o-mini",
          enabled: false,
        },
        {
          provider: "openai",
          modelId: "o3",
          enabled: false,
        },
      ],
      { provider: "openai", modelId: "gpt-4o" },
      3,
    )

    expect(candidates.map((candidate) => candidate.provider)).toEqual([
      "anthropic",
      "anthropic",
      "anthropic",
    ])
  })

  it("retorna vazio quando não há modelo rápido elegível", () => {
    expect(
      getFallbackCandidateModels(
        ["openai"],
        [
          {
            provider: "openai",
            modelId: "gpt-4o-mini",
            enabled: false,
          },
          {
            provider: "openai",
            modelId: "o3",
            enabled: false,
          },
        ],
        { provider: "openai", modelId: "gpt-4o" },
      ),
    ).toEqual([])
  })
})
