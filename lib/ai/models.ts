import { z } from "zod"
import {
  aiProviders,
  isProviderId,
  type AIProvider,
  type ProviderId,
} from "./providers"

export const MODEL_CATALOG_VERSION = 5

export const modelStatuses = ["available", "preview", "deprecated"] as const
export type ModelStatus = (typeof modelStatuses)[number]

export const modelStatusLabels: Record<ModelStatus, string> = {
  available: "Disponível",
  preview: "Prévia",
  deprecated: "Descontinuado",
}

const providerIdSchema = z.custom<ProviderId>(
  (value) => typeof value === "string" && isProviderId(value),
  { message: "Provedor desconhecido" },
)

const modelPricingSchema = z.object({
  currency: z.literal("USD"),
  inputPerMillion: z.number().nonnegative(),
  outputPerMillion: z.number().nonnegative(),
})

const modelSchema = z.object({
  id: z.string().min(1),
  provider: providerIdSchema,
  name: z.string().min(1),
  description: z.string().min(1),
  releasedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use o formato YYYY-MM-DD")
    .refine(
      (value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)),
      "Data inválida",
    ),
  contextWindow: z.number().int().positive(),
  maxOutputTokens: z.number().int().positive().optional(),
  pricing: modelPricingSchema,
  status: z.enum(modelStatuses),
})

export type AIModel = z.infer<typeof modelSchema>
export type ModelPricing = AIModel["pricing"]

const modelCatalogSchema = z.array(modelSchema)

const modelCatalog = [
  {
    id: "gpt-4o",
    provider: "openai",
    name: "GPT-4o",
    description:
      "Modelo multimodal da OpenAI para tarefas gerais, com boa relação entre qualidade e velocidade.",
    releasedAt: "2024-05-13",
    contextWindow: 128_000,
    maxOutputTokens: 16_384,
    pricing: {
      currency: "USD",
      inputPerMillion: 2.5,
      outputPerMillion: 10,
    },
    status: "available",
  },
  {
    id: "gpt-4o-mini",
    provider: "openai",
    name: "GPT-4o mini",
    description:
      "Versão compacta e econômica do GPT-4o, indicada para tarefas de alto volume.",
    releasedAt: "2024-07-18",
    contextWindow: 128_000,
    maxOutputTokens: 16_384,
    pricing: {
      currency: "USD",
      inputPerMillion: 0.15,
      outputPerMillion: 0.6,
    },
    status: "available",
  },
  {
    id: "o3",
    provider: "openai",
    name: "o3",
    description:
      "Modelo de raciocínio da OpenAI para problemas complexos, matemática e código.",
    releasedAt: "2025-04-16",
    contextWindow: 200_000,
    maxOutputTokens: 100_000,
    pricing: {
      currency: "USD",
      inputPerMillion: 2,
      outputPerMillion: 8,
    },
    status: "available",
  },
  {
    id: "claude-sonnet-4-20250514",
    provider: "anthropic",
    name: "Claude Sonnet 4",
    description:
      "Modelo equilibrado da Anthropic para código, análise e uso geral em produção.",
    releasedAt: "2025-05-22",
    contextWindow: 200_000,
    maxOutputTokens: 64_000,
    pricing: {
      currency: "USD",
      inputPerMillion: 3,
      outputPerMillion: 15,
    },
    status: "available",
  },
  {
    id: "claude-opus-4-20250514",
    provider: "anthropic",
    name: "Claude Opus 4",
    description:
      "Modelo de alta capacidade da Anthropic para raciocínio avançado e tarefas complexas.",
    releasedAt: "2025-05-22",
    contextWindow: 200_000,
    maxOutputTokens: 32_000,
    pricing: {
      currency: "USD",
      inputPerMillion: 15,
      outputPerMillion: 75,
    },
    status: "available",
  },
  {
    id: "claude-3-5-haiku-20241022",
    provider: "anthropic",
    name: "Claude 3.5 Haiku",
    description:
      "Modelo rápido e econômico da Anthropic para respostas ágeis e cargas de trabalho maiores.",
    releasedAt: "2024-11-04",
    contextWindow: 200_000,
    maxOutputTokens: 8_192,
    pricing: {
      currency: "USD",
      inputPerMillion: 0.8,
      outputPerMillion: 4,
    },
    status: "available",
  },
  {
    id: "gemini-2.5-pro",
    provider: "google",
    name: "Gemini 2.5 Pro",
    description:
      "Modelo avançado do Google para raciocínio, contexto longo e tarefas multimodais.",
    releasedAt: "2025-06-17",
    contextWindow: 1_048_576,
    maxOutputTokens: 65_536,
    pricing: {
      currency: "USD",
      inputPerMillion: 1.25,
      outputPerMillion: 10,
    },
    status: "available",
  },
  {
    id: "gemini-3.1-flash-lite",
    provider: "google",
    name: "Gemini 3.1 Flash-Lite",
    description:
      "Modelo multimodal de baixa latência e baixo custo do Google, otimizado para tarefas de alto volume, tradução e processamento de dados.",
    releasedAt: "2026-05-07",
    contextWindow: 1_048_576,
    maxOutputTokens: 65_536,
    pricing: {
      currency: "USD",
      inputPerMillion: 0.25,
      outputPerMillion: 1.5,
    },
    status: "available",
  },
  {
    id: "gemini-2.5-flash",
    provider: "google",
    name: "Gemini 2.5 Flash",
    description:
      "Modelo rápido do Google com contexto longo, pensado para aplicações de alto volume.",
    releasedAt: "2025-06-17",
    contextWindow: 1_048_576,
    maxOutputTokens: 65_536,
    pricing: {
      currency: "USD",
      inputPerMillion: 0.3,
      outputPerMillion: 2.5,
    },
    status: "available",
  },
  {
    id: "gemini-2.0-flash",
    provider: "google",
    name: "Gemini 2.0 Flash",
    description:
      "Modelo leve e econômico do Google para respostas rápidas e tarefas do dia a dia.",
    releasedAt: "2025-02-05",
    contextWindow: 1_048_576,
    maxOutputTokens: 8_192,
    pricing: {
      currency: "USD",
      inputPerMillion: 0.1,
      outputPerMillion: 0.4,
    },
    status: "available",
  },
  {
    id: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
    provider: "openrouter",
    name: "NVIDIA: Nemotron 3 Nano Omni (free)",
    description:
      "Modelo multimodal gratuito da NVIDIA via OpenRouter, otimizado para raciocínio em texto, imagem, vídeo e áudio.",
    releasedAt: "2026-04-28",
    contextWindow: 262_144,
    pricing: {
      currency: "USD",
      inputPerMillion: 0,
      outputPerMillion: 0,
    },
    status: "available",
  },
  {
    id: "cohere/north-mini-code:free",
    provider: "openrouter",
    name: "Cohere: North Mini Code (free)",
    description:
      "Modelo gratuito da Cohere via OpenRouter, voltado para código com bom custo-benefício.",
    releasedAt: "2026-01-01",
    contextWindow: 128_000,
    pricing: {
      currency: "USD",
      inputPerMillion: 0,
      outputPerMillion: 0,
    },
    status: "available",
  },
] as const satisfies readonly AIModel[]

export const aiModels: readonly AIModel[] =
  modelCatalogSchema.parse(modelCatalog)

const seenModels = new Set<string>()

for (const model of aiModels) {
  const key = `${model.provider}:${model.id}`

  if (seenModels.has(key)) {
    throw new Error(`Modelo duplicado no catálogo: ${key}`)
  }

  seenModels.add(key)
}

export type ProviderModelCatalog = AIProvider & {
  models: readonly AIModel[]
}

export function getModelsByProvider(provider: ProviderId): readonly AIModel[] {
  return aiModels.filter((model) => model.provider === provider)
}

export function getModel(
  provider: ProviderId,
  modelId: string,
): AIModel | undefined {
  return aiModels.find(
    (model) => model.provider === provider && model.id === modelId,
  )
}

export function getModelKey(model: Pick<AIModel, "provider" | "id">): string {
  return `${model.provider}:${model.id}`
}

export function parseModelKey(
  value: string,
): { provider: ProviderId; modelId: string } | null {
  const separator = value.indexOf(":")

  if (separator <= 0 || separator === value.length - 1) {
    return null
  }

  const provider = value.slice(0, separator)
  const modelId = value.slice(separator + 1)

  if (!isProviderId(provider) || !modelId) {
    return null
  }

  return { provider, modelId }
}

export function getProviderModelsCatalog(): readonly ProviderModelCatalog[] {
  return aiProviders.map((provider) => ({
    ...provider,
    models: getModelsByProvider(provider.id),
  }))
}

export function getProviderModelCatalog(
  provider: ProviderId,
): ProviderModelCatalog | undefined {
  const providerInfo = aiProviders.find((item) => item.id === provider)

  if (!providerInfo) {
    return undefined
  }

  return {
    ...providerInfo,
    models: getModelsByProvider(provider),
  }
}

const compactNumberFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
})

export function formatTokenCount(tokens: number): string {
  return compactNumberFormatter.format(tokens)
}

const priceFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatPricePerMillion(value: number): string {
  return `${priceFormatter.format(value)}/M`
}

const releaseDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "medium",
  timeZone: "UTC",
})

export function formatReleaseDate(value: string): string {
  return releaseDateFormatter.format(new Date(`${value}T00:00:00Z`))
}
