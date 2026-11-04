import { createAnthropic } from "@ai-sdk/anthropic"
import { createGoogle } from "@ai-sdk/google"
import { createGroq } from "@ai-sdk/groq"
import { createOpenAI } from "@ai-sdk/openai"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import type { LanguageModel } from "ai"
import { and, eq } from "drizzle-orm"
import { db } from "@/db"
import { aiKeys, instantModels } from "@/db/schema"
import { decryptSecret } from "@/lib/crypto"
import { getModel } from "./models"
import type { ProviderId } from "./providers"

type ChatModelError = "unknown_model" | "model_disabled" | "missing_api_key"

type ChatModelResult =
  | {
      ok: true
      provider: ProviderId
      modelId: string
      model: LanguageModel
    }
  | {
      ok: false
      error: ChatModelError
    }

export async function resolveChatModel(
  userId: string,
  provider: ProviderId,
  modelId: string,
): Promise<ChatModelResult> {
  if (!getModel(provider, modelId)) {
    return { ok: false, error: "unknown_model" }
  }

  const [preference, key] = await Promise.all([
    db
      .select({ enabled: instantModels.enabled })
      .from(instantModels)
      .where(
        and(
          eq(instantModels.userId, userId),
          eq(instantModels.provider, provider),
          eq(instantModels.modelId, modelId),
        ),
      )
      .limit(1)
      .then((rows) => rows[0]),
    db
      .select({ apiKey: aiKeys.apiKey })
      .from(aiKeys)
      .where(
        and(eq(aiKeys.userId, userId), eq(aiKeys.provider, provider)),
      )
      .limit(1)
      .then((rows) => rows[0]),
  ])

  if (preference && !preference.enabled) {
    return { ok: false, error: "model_disabled" }
  }

  if (!key) {
    return { ok: false, error: "missing_api_key" }
  }

  const apiKey = decryptSecret(key.apiKey)

  switch (provider) {
    case "openai":
      return {
        ok: true,
        provider,
        modelId,
        model: createOpenAI({ apiKey })(modelId),
      }
    case "anthropic":
      return {
        ok: true,
        provider,
        modelId,
        model: createAnthropic({ apiKey })(modelId),
      }
    case "google":
      return {
        ok: true,
        provider,
        modelId,
        model: createGoogle({ apiKey })(modelId),
      }
    case "openrouter":
      return {
        ok: true,
        provider,
        modelId,
        model: createOpenRouter({ apiKey }).chat(modelId),
      }
    case "groq":
      return {
        ok: true,
        provider,
        modelId,
        model: createGroq({ apiKey })(modelId),
      }
  }
}
