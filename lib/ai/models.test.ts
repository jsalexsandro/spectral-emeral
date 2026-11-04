import { describe, expect, it } from "vitest"
import { getAvailableModels } from "./instant-models"
import {
  MODEL_CATALOG_VERSION,
  aiModels,
  getModel,
  getModelsByProvider,
} from "./models"

describe("model catalog", () => {
  it("keeps the catalog version at 6", () => {
    expect(MODEL_CATALOG_VERSION).toBe(6)
  })

  it("registers the Groq GPT-OSS 20B model", () => {
    const model = getModel("groq", "openai/gpt-oss-20b")

    expect(model).toMatchObject({
      id: "openai/gpt-oss-20b",
      provider: "groq",
      name: "GPT-OSS 20B",
      contextWindow: 131_072,
      maxOutputTokens: 65_536,
      status: "available",
      pricing: {
        currency: "USD",
        inputPerMillion: 0.075,
        outputPerMillion: 0.3,
      },
      rateLimits: {
        requestsPerMinute: 30,
        requestsPerDay: 1_000,
        tokensPerMinute: 8_000,
        tokensPerDay: 200_000,
      },
    })
    expect(getModelsByProvider("groq")).toHaveLength(1)
  })

  it("keeps provider/model pairs unique", () => {
    const keys = aiModels.map((model) => `${model.provider}:${model.id}`)

    expect(new Set(keys).size).toBe(keys.length)
  })

  it("exposes Groq models only after the provider is configured", () => {
    expect(getAvailableModels(["groq"])).toEqual([
      expect.objectContaining({
        id: "openai/gpt-oss-20b",
        provider: "groq",
      }),
    ])
    expect(
      getAvailableModels(["openai"]).some((model) => model.provider === "groq"),
    ).toBe(false)
  })
})
