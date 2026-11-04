import { tool } from "ai"
import { z } from "zod"
import { getModelsByProvider } from "@/lib/ai/models"
import { aiProviders, type ProviderId } from "@/lib/ai/providers"
import {
  listConfiguredProviders,
  type ConfiguredProviderRecord,
} from "./catalog-data"

export const PROVIDER_LIST_ALL_TOOL_NAME = "provider-list-all"
export const PROVIDER_LIST_CONFIGURED_TOOL_NAME = "provider-list-configured"

export type ProviderToolEntry = {
  id: ProviderId
  name: string
  description: string
  docsUrl: string
  configured: boolean
  modelCount: number
  updatedAt: string | null
}

const listError = "Não foi possível consultar os provedores."

const listAllDescription = [
  "Lista todos os provedores de IA suportados pelo Spectral.",
  "Retorna id, nome, descrição, documentação, se o provedor está configurado, quantidade de modelos e data da última configuração.",
  "Use quando o usuário perguntar quais provedores existem ou quais podem ser configurados.",
].join("\n")

const listConfiguredDescription = [
  "Lista apenas os provedores de IA que o usuário já configurou com uma chave BYOK.",
  "Retorna id, nome, descrição, documentação, quantidade de modelos e data da última configuração.",
  "Use quando o usuário perguntar quais provedores estão configurados ou prontos para uso.",
  "Nunca retorna chaves de API.",
].join("\n")

export function buildProviderToolEntries(
  configuredProviders: readonly ConfiguredProviderRecord[],
): ProviderToolEntry[] {
  const configuredByProvider = new Map(
    configuredProviders.map((row) => [row.provider, row]),
  )

  return aiProviders.map((provider) => {
    const configured = configuredByProvider.get(provider.id)

    return {
      id: provider.id,
      name: provider.name,
      description: provider.description,
      docsUrl: provider.docsUrl,
      configured: Boolean(configured),
      modelCount: getModelsByProvider(provider.id).length,
      updatedAt: configured?.updatedAt.toISOString() ?? null,
    }
  })
}

export function selectConfiguredProviderEntries(
  providers: readonly ProviderToolEntry[],
): ProviderToolEntry[] {
  return providers.filter((provider) => provider.configured)
}

export function createProviderTools(userId: string) {
  return {
    [PROVIDER_LIST_ALL_TOOL_NAME]: tool({
      description: listAllDescription,
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const providers = buildProviderToolEntries(
            await listConfiguredProviders(userId),
          )

          return {
            ok: true as const,
            total: providers.length,
            providers,
          }
        } catch {
          return { ok: false as const, error: listError }
        }
      },
    }),
    [PROVIDER_LIST_CONFIGURED_TOOL_NAME]: tool({
      description: listConfiguredDescription,
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const providers = selectConfiguredProviderEntries(
            buildProviderToolEntries(await listConfiguredProviders(userId)),
          )

          return {
            ok: true as const,
            total: providers.length,
            providers,
          }
        } catch {
          return { ok: false as const, error: listError }
        }
      },
    }),
  }
}
