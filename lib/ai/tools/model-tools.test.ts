import { describe, expect, it } from "vitest"
import { getModelKey } from "@/lib/ai/models"
import { type ProviderId } from "@/lib/ai/providers"
import {
  MODEL_LIST_BY_PROVIDER_TOOL_NAME,
  MODEL_LIST_ENABLED_TOOL_NAME,
  MODEL_SET_ENABLED_TOOL_NAME,
  buildModelToolEntries,
  createModelTools,
  modelListByProviderInputSchema,
  modelListEnabledInputSchema,
  modelSetEnabledInputSchema,
  resolveModelSetEnabledTarget,
  selectQuickEnabledModels,
  toModelProviderInfo,
} from "./model-tools"

const disabledGroq = {
  provider: "groq" as const,
  modelId: "openai/gpt-oss-20b",
  enabled: false,
}

describe("model tools", () => {
  it("lists the catalog of a provider with quick-use status", () => {
    const models = buildModelToolEntries("groq", true, [])

    expect(models).toHaveLength(1)
    expect(models[0]).toMatchObject({
      key: "groq:openai/gpt-oss-20b",
      provider: "groq",
      providerName: "Groq",
      quickEnabled: true,
    })
  })

  it("marks a model as disabled when the provider is not configured", () => {
    expect(buildModelToolEntries("groq", false, [])[0].quickEnabled).toBe(false)
  })

  it("marks a model as disabled when the quick-use preference is off", () => {
    expect(
      buildModelToolEntries("groq", true, [disabledGroq])[0].quickEnabled,
    ).toBe(false)
  })

  it("treats models without an explicit preference as enabled", () => {
    const models = selectQuickEnabledModels(["groq"], [])

    expect(models.map(getModelKey)).toEqual(["groq:openai/gpt-oss-20b"])
  })

  it("removes explicitly disabled models", () => {
    expect(selectQuickEnabledModels(["groq"], [disabledGroq])).toEqual([])
  })

  it("returns no enabled models when no provider is configured", () => {
    expect(selectQuickEnabledModels([], [])).toEqual([])
  })

  it("filters enabled models by provider", () => {
    const models = selectQuickEnabledModels(
      ["openai", "groq"],
      [],
      "groq",
    )

    expect(models.map((model) => model.provider)).toEqual(["groq"])
  })

  it("builds provider metadata for model responses", () => {
    expect(toModelProviderInfo("groq", true)).toMatchObject({
      id: "groq",
      name: "Groq",
      configured: true,
    })
  })

  it("validates the provider inputs", () => {
    expect(
      modelListByProviderInputSchema.safeParse({ provider: "groq" }).success,
    ).toBe(true)
    expect(
      modelListByProviderInputSchema.safeParse({ provider: "unknown" }).success,
    ).toBe(false)
    expect(modelListEnabledInputSchema.safeParse({}).success).toBe(true)
    expect(
      modelListEnabledInputSchema.safeParse({ provider: "groq" }).success,
    ).toBe(true)
  })

  it("validates set enabled input", () => {
    expect(
      modelSetEnabledInputSchema.safeParse({
        provider: "groq",
        modelId: "openai/gpt-oss-20b",
        enabled: true,
      }).success,
    ).toBe(true)
    expect(
      modelSetEnabledInputSchema.safeParse({
        provider: "groq",
        modelId: "openai/gpt-oss-20b",
        enabled: false,
      }).success,
    ).toBe(true)
    expect(
      modelSetEnabledInputSchema.safeParse({
        provider: "groq",
        modelId: "",
        enabled: true,
      }).success,
    ).toBe(false)
    expect(
      modelSetEnabledInputSchema.safeParse({
        provider: "groq",
        modelId: "openai/gpt-oss-20b",
      }).success,
    ).toBe(false)
  })

  it("resolves set enabled target", () => {
    const configured = ["groq" as ProviderId]

    expect(
      resolveModelSetEnabledTarget(
        "groq",
        "openai/gpt-oss-20b",
        configured,
      ).ok,
    ).toBe(true)

    const unknownModel = resolveModelSetEnabledTarget(
      "groq",
      "inexistente",
      configured,
    )
    expect(unknownModel.ok).toBe(false)
    if (!unknownModel.ok) {
      expect(unknownModel.error).toBe("unknown_model")
    }

    const notConfigured = resolveModelSetEnabledTarget(
      "groq",
      "openai/gpt-oss-20b",
      [],
    )
    expect(notConfigured.ok).toBe(false)
    if (!notConfigured.ok) {
      expect(notConfigured.error).toBe("provider_not_configured")
      expect(notConfigured.provider?.configured).toBe(false)
    }
  })

  it("registers the model tools", () => {
    const tools = createModelTools("user-1")

    expect(Object.keys(tools).sort()).toEqual(
      [
        MODEL_LIST_BY_PROVIDER_TOOL_NAME,
        MODEL_LIST_ENABLED_TOOL_NAME,
        MODEL_SET_ENABLED_TOOL_NAME,
      ].sort(),
    )

    for (const chatTool of Object.values(tools)) {
      expect(typeof chatTool.execute).toBe("function")
    }
  })
})
