import { aiModels, getModelKey, type AIModel } from "./models"
import type { ProviderId } from "./providers"

export type InstantModelPreference = {
  provider: ProviderId
  modelId: string
  enabled: boolean
}

export function isInstantModelEnabled(
  model: Pick<AIModel, "provider" | "id">,
  preferences: readonly InstantModelPreference[],
): boolean {
  return (
    preferences.find(
      (preference) =>
        preference.provider === model.provider &&
        preference.modelId === model.id,
    )?.enabled ?? true
  )
}

export function getAvailableModels(
  configuredProviders: readonly ProviderId[],
): readonly AIModel[] {
  if (configuredProviders.length === 0) {
    return aiModels
  }

  return aiModels.filter((model) => configuredProviders.includes(model.provider))
}

export function getQuickModels(
  configuredProviders: readonly ProviderId[],
  preferences: readonly InstantModelPreference[],
): readonly AIModel[] {
  return getAvailableModels(configuredProviders).filter((model) =>
    isInstantModelEnabled(model, preferences),
  )
}

export function resolveDefaultModelKey(
  configuredProviders: readonly ProviderId[],
  preferences: readonly InstantModelPreference[],
): string {
  if (configuredProviders.length === 0) {
    return ""
  }

  const model = getQuickModels(configuredProviders, preferences)[0]

  return model ? getModelKey(model) : ""
}

export function upsertInstantPreference(
  preferences: readonly InstantModelPreference[],
  next: InstantModelPreference,
): InstantModelPreference[] {
  const index = preferences.findIndex(
    (preference) =>
      preference.provider === next.provider &&
      preference.modelId === next.modelId,
  )

  if (index === -1) {
    return [...preferences, next]
  }

  return preferences.map((preference, currentIndex) =>
    currentIndex === index ? next : preference,
  )
}

export function getFallbackCandidateModels(
  configuredProviders: readonly ProviderId[],
  preferences: readonly InstantModelPreference[],
  primary: { provider: ProviderId; modelId: string },
  limit = 3,
): Array<{ provider: ProviderId; modelId: string }> {
  const candidates = getQuickModels(configuredProviders, preferences)
    .filter(
      (model) =>
        !(model.provider === primary.provider && model.id === primary.modelId),
    )
    .map((model) => ({ provider: model.provider, modelId: model.id }))

  // Intercala provedores para que a primeira alternativa venha de outro
  // provedor. O provedor que falhou fica por último, mas continua elegível com
  // outros modelos. A ordem do catálogo é preservada dentro de cada provedor.
  const groups = new Map<
    ProviderId,
    Array<{ provider: ProviderId; modelId: string }>
  >()

  for (const candidate of candidates) {
    const group = groups.get(candidate.provider) ?? []
    group.push(candidate)
    groups.set(candidate.provider, group)
  }

  const providers = [...groups.keys()].sort((left, right) => {
    const leftFailed = left === primary.provider ? 1 : 0
    const rightFailed = right === primary.provider ? 1 : 0

    return leftFailed - rightFailed
  })
  const rounds = Math.max(0, ...[...groups.values()].map((group) => group.length))
  const ordered: Array<{ provider: ProviderId; modelId: string }> = []

  for (let round = 0; round < rounds; round++) {
    for (const provider of providers) {
      const candidate = groups.get(provider)?.[round]

      if (candidate) {
        ordered.push(candidate)
      }
    }
  }

  return ordered.slice(0, limit)
}
