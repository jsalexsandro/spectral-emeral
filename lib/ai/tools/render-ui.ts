import { tool } from "ai"
import { z } from "zod"
import {
  UI_CATALOG_VERSION,
  renderUiInputSchema,
  uiCatalogSummary,
} from "@/lib/ai/ui/catalog"

const description = [
  "Renderiza um componente visual estruturado dentro da conversa.",
  "Prefira esta ferramenta quando dados tabulares, métricas, etapas, fontes ou um destaque visual comunicarem melhor do que texto corrido.",
  "O campo `props` deve ser sempre um objeto JSON, nunca uma string.",
  "Componentes permitidos:",
  uiCatalogSummary,
  "Regras: chame no máximo duas vezes por resposta e prefira uma única chamada; depois do último `renderUi`, finalize com texto curto; nunca repita a mesma chamada para corrigir um erro; não repita no texto os mesmos dados exibidos no componente; para listas de modelos ou provedores, obtenha os dados com a tool de catálogo antes de renderizar; use `sourceList` somente com URLs reais já consultadas; nunca invente dados apenas para preencher o componente.",
].join("\n")

function tryParseJson(value: string): unknown {
  const trimmed = value.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)

  try {
    return JSON.parse(fenced?.[1] ?? trimmed)
  } catch {
    return value
  }
}

export function normalizeRenderUiToolInput(value: unknown): unknown {
  const input = typeof value === "string" ? tryParseJson(value) : value

  if (
    input &&
    typeof input === "object" &&
    "props" in input &&
    typeof input.props === "string"
  ) {
    return {
      ...input,
      props: tryParseJson(input.props),
    }
  }

  return input
}

export const renderUiToolInputSchema = z.preprocess(
  normalizeRenderUiToolInput,
  renderUiInputSchema,
)

export const renderUiTool = tool({
  description,
  inputSchema: renderUiToolInputSchema,
  execute: async (input) => ({
    uiVersion: UI_CATALOG_VERSION,
    component: input.component,
    props: input.props,
  }),
})
