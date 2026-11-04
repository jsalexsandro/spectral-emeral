import { eq } from "drizzle-orm"
import { aiKeys, instantModels } from "@/db/schema"
import { isProviderId, type ProviderId } from "@/lib/ai/providers"

export type ConfiguredProviderRecord = {
  provider: ProviderId
  updatedAt: Date
}

export type InstantModelRecord = {
  provider: ProviderId
  modelId: string
  enabled: boolean
}

export type UpsertInstantModelRecordInput = InstantModelRecord & {
  userId: string
}

export async function listConfiguredProviders(
  userId: string,
): Promise<ConfiguredProviderRecord[]> {
  const { db } = await import("@/db")
  const rows = await db
    .select({
      provider: aiKeys.provider,
      updatedAt: aiKeys.updatedAt,
    })
    .from(aiKeys)
    .where(eq(aiKeys.userId, userId))

  return rows.flatMap((row) =>
    isProviderId(row.provider)
      ? [{ provider: row.provider, updatedAt: row.updatedAt }]
      : [],
  )
}

export async function listInstantModelRecords(
  userId: string,
): Promise<InstantModelRecord[]> {
  const { db } = await import("@/db")
  const rows = await db
    .select({
      provider: instantModels.provider,
      modelId: instantModels.modelId,
      enabled: instantModels.enabled,
    })
    .from(instantModels)
    .where(eq(instantModels.userId, userId))

  return rows.flatMap((row) =>
    isProviderId(row.provider)
      ? [
          {
            provider: row.provider,
            modelId: row.modelId,
            enabled: row.enabled,
          },
        ]
      : [],
  )
}

export async function upsertInstantModelRecord({
  userId,
  provider,
  modelId,
  enabled,
}: UpsertInstantModelRecordInput): Promise<InstantModelRecord> {
  const { db } = await import("@/db")
  const [saved] = await db
    .insert(instantModels)
    .values({
      userId,
      provider,
      modelId,
      enabled,
    })
    .onConflictDoUpdate({
      target: [
        instantModels.userId,
        instantModels.provider,
        instantModels.modelId,
      ],
      set: {
        enabled,
        updatedAt: new Date(),
      },
    })
    .returning({
      provider: instantModels.provider,
      modelId: instantModels.modelId,
      enabled: instantModels.enabled,
    })

  if (!saved || !isProviderId(saved.provider)) {
    throw new Error("invalid_instant_model")
  }

  return {
    provider: saved.provider,
    modelId: saved.modelId,
    enabled: saved.enabled,
  }
}
