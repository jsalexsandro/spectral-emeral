import { z } from "zod"

export const UI_CATALOG_VERSION = 1

export const RENDER_UI_TOOL_NAME = "renderUi" as const

export const uiComponentNames = [
  "callout",
  "infoCard",
  "statGrid",
  "dataTable",
  "timeline",
  "sourceList",
  "chatUi",
] as const

export type UiComponentName = (typeof uiComponentNames)[number]

export function isUiComponentName(value: string): value is UiComponentName {
  return (uiComponentNames as readonly string[]).includes(value)
}

const boundedText = (max: number) => z.string().trim().min(1).max(max)
const optionalText = (max: number) => z.string().trim().min(1).max(max).optional()

const httpUrlSchema = z
  .string()
  .url()
  .refine((value) => {
    try {
      const url = new URL(value)
      return url.protocol === "http:" || url.protocol === "https:"
    } catch {
      return false
    }
  }, "Use uma URL http(s)")

export const calloutPropsSchema = z.object({
  tone: z.enum(["info", "success", "warning", "danger"]).default("info"),
  title: optionalText(120),
  body: boundedText(2_000),
})

export const infoCardPropsSchema = z.object({
  title: boundedText(120),
  subtitle: optionalText(160),
  description: optionalText(1_200),
  items: z
    .array(
      z.object({
        label: boundedText(60),
        value: boundedText(200),
      }),
    )
    .max(8)
    .optional(),
})

export const statGridPropsSchema = z.object({
  title: optionalText(120),
  stats: z
    .array(
      z.object({
        label: boundedText(60),
        value: boundedText(60),
        hint: optionalText(120),
      }),
    )
    .min(2)
    .max(6),
})

const tableCellSchema = z.union([z.string().trim().max(500), z.number()])

export const dataTablePropsSchema = z.object({
  title: optionalText(120),
  columns: z.array(boundedText(60)).min(1).max(6),
  rows: z.array(z.array(tableCellSchema).min(1).max(6)).min(1).max(30),
  caption: optionalText(300),
})

export const timelinePropsSchema = z.object({
  title: optionalText(120),
  items: z
    .array(
      z.object({
        title: boundedText(120),
        description: optionalText(600),
        status: z.enum(["done", "current", "pending"]).default("pending"),
      }),
    )
    .min(1)
    .max(10),
})

export const sourceListPropsSchema = z.object({
  title: optionalText(120),
  sources: z
    .array(
      z.object({
        title: boundedText(160),
        url: httpUrlSchema,
        snippet: optionalText(400),
      }),
    )
    .min(1)
    .max(8),
})

const chatUiTextSchema = z.object({
  type: z.literal("text"),
  value: boundedText(1000),
  variant: z.enum(["h1", "h2", "p", "span", "muted", "caption"]).optional(),
  weight: z.enum(["normal", "medium", "semibold", "bold"]).optional(),
})

const chatUiButtonSchema = z.object({
  type: z.literal("button"),
  label: boundedText(60),
  variant: z.enum(["default", "outline", "secondary", "ghost"]).optional(),
  action: optionalText(120),
})

const chatUiLeafNodeSchema = z.discriminatedUnion("type", [chatUiTextSchema, chatUiButtonSchema])

const chatUiDivLevel2Schema = z.object({
  type: z.literal("div"),
  className: optionalText(200),
  children: z.array(chatUiLeafNodeSchema).min(1).max(10),
})

const chatUiDivLevel1ChildSchema = z.discriminatedUnion("type", [
  chatUiTextSchema,
  chatUiButtonSchema,
  chatUiDivLevel2Schema,
])

const chatUiDivLevel1Schema = z.object({
  type: z.literal("div"),
  className: optionalText(200),
  children: z.array(chatUiDivLevel1ChildSchema).min(1).max(10),
})

export const chatUiNodeSchema = z.discriminatedUnion("type", [
  chatUiTextSchema,
  chatUiButtonSchema,
  chatUiDivLevel1Schema,
])

export const chatUiPropsSchema = z.object({
  title: optionalText(120),
  children: z.array(chatUiNodeSchema).min(1).max(12),
})

export type ChatUiTextNode = z.infer<typeof chatUiTextSchema>
export type ChatUiButtonNode = z.infer<typeof chatUiButtonSchema>
export type ChatUiDivNode = z.infer<typeof chatUiDivLevel1Schema>
export type ChatUiNode = z.infer<typeof chatUiNodeSchema>
export type ChatUiProps = z.infer<typeof chatUiPropsSchema>

export const uiComponentDescriptions: Record<UiComponentName, string> = {
  callout:
    "Destaque curto para uma conclusão, aviso, alerta ou confirmação. Use `tone` info, success, warning ou danger.",
  infoCard:
    "Cartão com título, descrição opcional e uma lista de pares rótulo/valor. Bom para resumos e detalhes de um item.",
  statGrid:
    "Grade de 2 a 6 métricas com rótulo, valor e dica opcional. Use para números e comparações rápidas.",
  dataTable:
    "Tabela com colunas e linhas para comparações e dados estruturados. Máximo de 6 colunas e 30 linhas.",
  timeline:
    "Lista ordenada de etapas com status done, current ou pending. Use para processos, planos e sequências.",
  sourceList:
    "Lista de fontes reais com título, URL http(s) e trecho opcional. Use somente com páginas já consultadas.",
  chatUi:
    "Apenas primitivos: text, button, div. Max 2 níveis de divs (div > div). Div interno só pode ter text ou button. Use className para layout (flex, grid).",
}

export const uiCatalogSummary = uiComponentNames
  .map((name) => `  - \`${name}\`: ${uiComponentDescriptions[name]}`)
  .join("\n")

export const renderUiInputSchema = z.discriminatedUnion("component", [
  z.object({
    component: z.literal("callout"),
    props: calloutPropsSchema,
  }),
  z.object({
    component: z.literal("infoCard"),
    props: infoCardPropsSchema,
  }),
  z.object({
    component: z.literal("statGrid"),
    props: statGridPropsSchema,
  }),
  z.object({
    component: z.literal("dataTable"),
    props: dataTablePropsSchema,
  }),
  z.object({
    component: z.literal("timeline"),
    props: timelinePropsSchema,
  }),
  z.object({
    component: z.literal("sourceList"),
    props: sourceListPropsSchema,
  }),
  z.object({
    component: z.literal("chatUi"),
    props: chatUiPropsSchema,
  }),
])

export const renderUiOutputSchema = z.intersection(
  renderUiInputSchema,
  z.object({
    uiVersion: z.number().int(),
  }),
)

export type CalloutProps = z.infer<typeof calloutPropsSchema>
export type InfoCardProps = z.infer<typeof infoCardPropsSchema>
export type StatGridProps = z.infer<typeof statGridPropsSchema>
export type DataTableProps = z.infer<typeof dataTablePropsSchema>
export type TimelineProps = z.infer<typeof timelinePropsSchema>
export type SourceListProps = z.infer<typeof sourceListPropsSchema>
export type RenderUiInput = z.infer<typeof renderUiInputSchema>
export type RenderUiOutput = z.infer<typeof renderUiOutputSchema>
