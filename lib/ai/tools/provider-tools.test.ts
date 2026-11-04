import { describe, expect, it } from "vitest"
import { aiProviders } from "@/lib/ai/providers"
import {
  PROVIDER_LIST_ALL_TOOL_NAME,
  PROVIDER_LIST_CONFIGURED_TOOL_NAME,
  buildProviderToolEntries,
  createProviderTools,
  selectConfiguredProviderEntries,
} from "./provider-tools"

const configuredAt = new Date("2026-11-04T12:00:00.000Z")

const configuredProviders = [
  { provider: "groq" as const, updatedAt: configuredAt },
]

describe("provider tools", () => {
  it("lists all supported providers with configuration metadata", () => {
    const providers = buildProviderToolEntries(configuredProviders)

    expect(providers).toHaveLength(aiProviders.length)
    expect(providers.find((provider) => provider.id === "groq")).toMatchObject({
      configured: true,
      modelCount: 1,
      updatedAt: configuredAt.toISOString(),
    })
    expect(providers.find((provider) => provider.id === "openai")).toMatchObject({
      configured: false,
      updatedAt: null,
    })
  })

  it("keeps only configured providers", () => {
    const providers = selectConfiguredProviderEntries(
      buildProviderToolEntries(configuredProviders),
    )

    expect(providers.map((provider) => provider.id)).toEqual(["groq"])
  })

  it("does not expose key material", () => {
    for (const provider of buildProviderToolEntries(configuredProviders)) {
      expect(provider).not.toHaveProperty("apiKey")
      expect(provider).not.toHaveProperty("maskedKey")
    }
  })

  it("registers the provider listing tools", () => {
    const tools = createProviderTools("user-1")

    expect(Object.keys(tools).sort()).toEqual(
      [PROVIDER_LIST_ALL_TOOL_NAME, PROVIDER_LIST_CONFIGURED_TOOL_NAME].sort(),
    )

    for (const chatTool of Object.values(tools)) {
      expect(typeof chatTool.execute).toBe("function")
    }
  })
})
