import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { connection } from "next/server"
import { desc, eq } from "drizzle-orm"
import { auth } from "@/auth"
import { db } from "@/db"
import { aiKeys, chats, instantModels, users } from "@/db/schema"
import { getAvailableModels, type InstantModelPreference } from "@/lib/ai/instant-models"
import { getModel } from "@/lib/ai/models"
import { aiProviders, isProviderId, type ProviderId } from "@/lib/ai/providers"
import { SelectModels, type ModelGroup } from "./select-models"

export const instant = false

export const metadata: Metadata = {
  title: "Selecionar modelos",
  description: "Escolha os modelos exibidos na seleção rápida do chat.",
}

export default async function SelectModelsPage() {
  await connection()
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/providers/select-model")
  }

  const [keys, preferences, userRows, latestChatRows] = await Promise.all([
    db
      .select({ provider: aiKeys.provider })
      .from(aiKeys)
      .where(eq(aiKeys.userId, session.user.id)),
    db
      .select({
        provider: instantModels.provider,
        modelId: instantModels.modelId,
        enabled: instantModels.enabled,
      })
      .from(instantModels)
      .where(eq(instantModels.userId, session.user.id)),
    db
      .select({ allowModelFallbackOnFailure: users.allowModelFallbackOnFailure })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1),
    db
      .select({ provider: chats.provider, model: chats.model })
      .from(chats)
      .where(eq(chats.userId, session.user.id))
      .orderBy(desc(chats.updatedAt))
      .limit(1),
  ])

  const configuredProviders = Array.from(
    new Set(
      keys
        .map((key) => key.provider)
        .filter((provider): provider is ProviderId => isProviderId(provider)),
    ),
  )

  const instantPreferences = preferences.flatMap((preference) => {
    if (
      !isProviderId(preference.provider) ||
      !getModel(preference.provider, preference.modelId)
    ) {
      return []
    }

    return [
      {
        provider: preference.provider,
        modelId: preference.modelId,
        enabled: preference.enabled,
      } satisfies InstantModelPreference,
    ]
  })

  const latestChat = latestChatRows[0]
  const activeModelKey =
    latestChat?.provider && latestChat?.model
      ? `${latestChat.provider}:${latestChat.model}`
      : null

  const availableModels = getAvailableModels(configuredProviders)
  const groups: ModelGroup[] = aiProviders
    .map((provider) => ({
      provider,
      models: availableModels.filter((model) => model.provider === provider.id),
    }))
    .filter((group) => group.models.length > 0)

  return (
    <SelectModels
      groups={groups}
      preferences={instantPreferences}
      allowModelFallbackOnFailure={
        userRows[0]?.allowModelFallbackOnFailure ?? false
      }
      activeModelKey={activeModelKey}
    />
  )
}
