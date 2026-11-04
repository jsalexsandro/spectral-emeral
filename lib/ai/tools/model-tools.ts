import { tool } from "ai"
import { z } from "zod"
import {
  getModel,
  getModelKey,
  getModelsByProvider,
  providerIdSchema,
  type AIModel,
  type ModelPricing,
  type ModelRateLimits,
  type ModelStatus,
} from "@/lib/ai/models"
import {
  getQuickModels,
  isInstantModelEnabled,
  type InstantModelPreference,
} from "@/lib/ai/instant-models"
import { aiProviders, type ProviderId } from "@/lib/ai/providers"
import {
  listConfiguredProviders,
  listInstantModelRecords,
  upsertInstantModelRecord,
  type InstantModelRecord,
} from "./catalog-data"

export const MODEL_LIST_BY_PROVIDER_TOOL_NAME = "model-list-by-provider"
export const MODEL_LIST_ENABLED_TOOL_NAME = "model-list-enabled"
export const MODEL_SET_ENABLED_TOOL_NAME = "model-set-enabled"

export type ModelToolEntry = {
  key: string
  id: string
  provider: ProviderId
  providerName: string
  name: string
  description: string
  releasedAt: string
  contextWindow: number
  maxOutputTokens: number | null
  pricing: ModelPricing
  rateLimits: ModelRateLimits | null
  status: ModelStatus
  quickEnabled: boolean
}

export type ModelProviderInfo = {
  id: ProviderId
  name: string
  description: string
  configured: boolean
}

export const modelListByProviderInputSchema = z.object({
  provider: providerIdSchema.describe(
    "Id do provedor, como openai, anthropic, google, openrouter ou groq.",
  ),
})

export const modelListEnabledInputSchema = z.object({
  provider: providerIdSchema
    .optional()
    .describe(
      "Filtra por um provedor específico. Omita para listar modelos ativados de todos os provedores configurados.",
    ),
})

export const modelSetEnabledInputSchema = z.object({
  provider: providerIdSchema.describe(
    "Id do provedor, como openai, anthropic, google, openrouter ou groq.",
  ),
  modelId: z
    .string()
    .trim()
    .min(1)
    .describe("Id exato do modelo, como openai/gpt-oss-20b."),
  enabled: z
    .boolean()
    .describe(
      "Use true para ativar o modelo na seleção rápida e false para desativar.",
    ),
})

const listError = "Não foi possível consultar os modelos."
const updateError = "Não foi possível salvar a preferência do modelo."

const listByProviderDescription = [
  "Lista todos os modelos do catálogo para um provedor específico.",
  "Retorna chave provider:model, nome, descrição, data de lançamento, contexto, saída máxima, preço, limites de referência, status e se o modelo está ativado para uso rápido.",
  "Funciona mesmo se o provedor ainda não estiver configurado; nesse caso, provider.configured é false e quickEnabled é false.",
  "Use quando o usuário perguntar quais modelos existem ou pode usar em um provedor.",
].join("\n")

const listEnabledDescription = [
  "Lista apenas os modelos de IA ativados para uso rápido pelo usuário.",
  "Sem provider, lista os modelos ativados de todos os provedores configurados; com provider, filtra por ele.",
  "Segue a regra da interface: modelo sem preferência salva conta como ativado e apenas enabled=false fica de fora.",
  'Use quando o usuário pedir "liste todos os modelos disponíveis para uso" ou perguntar quais modelos estão ativados.',
  "Só considera provedores configurados. Nunca retorna chaves de API.",
].join("\n")

const setEnabledDescription = [
  "Ativa ou desativa um modelo na seleção rápida do chat.",
  "Use enabled=true para ativar e enabled=false para desativar.",
  "Só grava para modelos de provedores que o usuário já configurou com uma chave BYOK.",
  "Se o usuário citar apenas o nome do modelo, consulte o catálogo do provedor antes para obter o modelId exato.",
  "Não altera o modelo selecionado na conversa atual e nunca retorna chaves de API.",
].join("\n")

function getProviderName(provider: ProviderId): string {
  return aiProviders.find((item) => item.id === provider)?.name ?? provider
}

export function toModelProviderInfo(
  provider: ProviderId,
  configured: boolean,
): ModelProviderInfo | null {
  const info = aiProviders.find((item) => item.id === provider)

  if (!info) {
    return null
  }

  return {
    id: info.id,
    name: info.name,
    description: info.description,
    configured,
  }
}

export type ModelSetEnabledResolution =
  | {
      ok: true
      model: AIModel
      provider: ModelProviderInfo
    }
  | {
      ok: false
      error: "unknown_provider" | "unknown_model" | "provider_not_configured"
      provider?: ModelProviderInfo
    }

export function resolveModelSetEnabledTarget(
  provider: ProviderId,
  modelId: string,
  configuredProviders: readonly ProviderId[],
): ModelSetEnabledResolution {
  const providerInfo = toModelProviderInfo(
    provider,
    configuredProviders.includes(provider),
  )

  if (!providerInfo) {
    return { ok: false, error: "unknown_provider" }
  }

  const model = getModel(provider, modelId)

  if (!model) {
    return { ok: false, error: "unknown_model", provider: providerInfo }
  }

  if (!providerInfo.configured) {
    return {
      ok: false,
      error: "provider_not_configured",
      provider: providerInfo,
    }
  }

  return { ok: true, model, provider: providerInfo }
}

export function toModelToolEntry(
  model: AIModel,
  quickEnabled: boolean,
): ModelToolEntry {
  return {
    key: getModelKey(model),
    id: model.id,
    provider: model.provider,
    providerName: getProviderName(model.provider),
    name: model.name,
    description: model.description,
    releasedAt: model.releasedAt,
    contextWindow: model.contextWindow,
    maxOutputTokens: model.maxOutputTokens ?? null,
    pricing: model.pricing,
    rateLimits: model.rateLimits ?? null,
    status: model.status,
    quickEnabled,
  }
}

export function buildModelToolEntries(
  provider: ProviderId,
  configured: boolean,
  preferences: readonly InstantModelPreference[],
): ModelToolEntry[] {
  return getModelsByProvider(provider).map((model) =>
    toModelToolEntry(
      model,
      configured && isInstantModelEnabled(model, preferences),
    ),
  )
}

export function selectQuickEnabledModels(
  configuredProviders: readonly ProviderId[],
  preferences: readonly InstantModelPreference[],
  provider?: ProviderId,
): readonly AIModel[] {
  if (configuredProviders.length === 0) {
    return []
  }

  const models = getQuickModels(configuredProviders, preferences)

  return provider
    ? models.filter((model) => model.provider === provider)
    : models
}

function toInstantModelPreferences(
  records: readonly InstantModelRecord[],
): InstantModelPreference[] {
  return records.map((record) => ({
    provider: record.provider,
    modelId: record.modelId,
    enabled: record.enabled,
  }))
}

export function createModelTools(userId: string) {
  return {
    [MODEL_LIST_BY_PROVIDER_TOOL_NAME]: tool({
      description: listByProviderDescription,
      inputSchema: modelListByProviderInputSchema,
      execute: async ({ provider }) => {
        try {
          const configuredProviders = await listConfiguredProviders(userId)
          const configured = configuredProviders.some(
            (row) => row.provider === provider,
          )
          const providerInfo = toModelProviderInfo(provider, configured)

          if (!providerInfo) {
            return { ok: false as const, error: "unknown_provider" }
          }

          const preferences = toInstantModelPreferences(
            await listInstantModelRecords(userId),
          )
          const models = buildModelToolEntries(
            provider,
            configured,
            preferences,
          )

          return {
            ok: true as const,
            provider: providerInfo,
            total: models.length,
            models,
          }
        } catch {
          return { ok: false as const, error: listError }
        }
      },
    }),
    [MODEL_LIST_ENABLED_TOOL_NAME]: tool({
      description: listEnabledDescription,
      inputSchema: modelListEnabledInputSchema,
      execute: async ({ provider }) => {
        try {
          const configuredProviders = await listConfiguredProviders(userId)
          const configuredProviderIds = configuredProviders.map(
            (row) => row.provider,
          )
          const providerInfo = provider
            ? toModelProviderInfo(
                provider,
                configuredProviderIds.includes(provider),
              )
            : null

          if (provider && !providerInfo) {
            return { ok: false as const, error: "unknown_provider" }
          }

          const preferences = toInstantModelPreferences(
            await listInstantModelRecords(userId),
          )
          const models = selectQuickEnabledModels(
            configuredProviderIds,
            preferences,
            provider,
          ).map((model) => toModelToolEntry(model, true))

          return {
            ok: true as const,
            ...(providerInfo ? { provider: providerInfo } : {}),
            total: models.length,
            models,
          }
        } catch {
          return { ok: false as const, error: listError }
        }
      },
    }),
    [MODEL_SET_ENABLED_TOOL_NAME]: tool({
      description: setEnabledDescription,
      inputSchema: modelSetEnabledInputSchema,
      execute: async ({ provider, modelId, enabled }) => {
        try {
          const configuredProviders = await listConfiguredProviders(userId)
          const target = resolveModelSetEnabledTarget(
            provider,
            modelId,
            configuredProviders.map((row) => row.provider),
          )

          if (!target.ok) {
            return target
          }

          const saved = await upsertInstantModelRecord({
            userId,
            provider,
            modelId,
            enabled,
          })

          return {
            ok: true as const,
            provider: target.provider,
            model: {
              key: getModelKey(target.model),
              id: target.model.id,
              name: target.model.name,
            },
            enabled: saved.enabled,
          }
        } catch {
          return { ok: false as const, error: updateError }
        }
      },
    }),
  }
}
