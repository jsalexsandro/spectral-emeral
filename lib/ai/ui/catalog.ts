import { z } from "zod"
import { appActionSchema, type AppAction } from "@/lib/ai/actions/catalog"
import { LEGACY_CHAT_UI_COMPONENT_NAME } from "@/lib/ai/actions/legacy"

export const UI_CATALOG_VERSION = 2

export const RENDER_UI_TOOL_NAME = "renderUi" as const

export const uiComponentNames = [
  "callout",
  "infoCard",
  "statGrid",
  "dataTable",
  "timeline",
  "sourceList",
  "panel",
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

const panelTextSchema = z.object({
  type: z.literal("text"),
  value: boundedText(1000),
  variant: z.enum(["h1", "h2", "p", "span", "muted", "caption"]).optional(),
  weight: z.enum(["normal", "medium", "semibold", "bold"]).optional(),
})

const panelButtonSchema = z.object({
  type: z.literal("button"),
  label: boundedText(60),
  variant: z.enum(["default", "outline", "secondary", "ghost"]).optional(),
  action: appActionSchema.optional(),
})

const legacyPanelButtonSchema = z.object({
  type: z.literal("button"),
  label: boundedText(60),
  variant: z.enum(["default", "outline", "secondary", "ghost"]).optional(),
  action: z.union([appActionSchema, boundedText(120)]).optional(),
})

function createPanelSchemas<B extends z.ZodTypeAny>(buttonSchema: B) {
  const leafNodeSchema = z.union([panelTextSchema, buttonSchema])
  const divLevel2Schema = z.object({
    type: z.literal("div"),
    className: optionalText(200),
    children: z.array(leafNodeSchema).min(1).max(10),
  })
  const divLevel1ChildSchema = z.union([
    panelTextSchema,
    buttonSchema,
    divLevel2Schema,
  ])
  const divLevel1Schema = z.object({
    type: z.literal("div"),
    className: optionalText(200),
    children: z.array(divLevel1ChildSchema).min(1).max(10),
  })
  const nodeSchema = z.union([panelTextSchema, buttonSchema, divLevel1Schema])
  const propsSchema = z.object({
    title: optionalText(120),
    children: z.array(nodeSchema).min(1).max(12),
  })

  return {
    buttonSchema,
    leafNodeSchema,
    divLevel2Schema,
    divLevel1ChildSchema,
    divLevel1Schema,
    nodeSchema,
    propsSchema,
  }
}

const panelSchemas = createPanelSchemas(panelButtonSchema)
const legacyPanelSchemas = createPanelSchemas(legacyPanelButtonSchema)

export const panelPropsSchema = panelSchemas.propsSchema
export const panelNodeSchema = panelSchemas.nodeSchema

export type PanelTextNode = z.infer<typeof panelTextSchema>
export type PanelButtonNode = z.infer<typeof panelButtonSchema>
export type PanelLeafNode = z.infer<typeof panelSchemas.leafNodeSchema>
export type PanelDivLevel2Node = z.infer<typeof panelSchemas.divLevel2Schema>
export type PanelDivChildNode = z.infer<typeof panelSchemas.divLevel1ChildSchema>
export type PanelDivNode = z.infer<typeof panelSchemas.divLevel1Schema>
export type PanelNode = z.infer<typeof panelSchemas.nodeSchema>
export type PanelProps = z.infer<typeof panelSchemas.propsSchema>

type LegacyPanelButtonNode = z.infer<typeof legacyPanelButtonSchema>
type LegacyPanelLeafNode = z.infer<typeof legacyPanelSchemas.leafNodeSchema>
type LegacyPanelDivChildNode = z.infer<
  typeof legacyPanelSchemas.divLevel1ChildSchema
>
type LegacyPanelNode = z.infer<typeof legacyPanelSchemas.nodeSchema>
type LegacyPanelProps = z.infer<typeof legacyPanelSchemas.propsSchema>

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
  panel:
    "Layout customizado com primitivos text, button e div. Máximo 2 níveis de div. Botões devem ter uma ação estruturada.",
}

export const uiCatalogSummary = uiComponentNames
  .map((name) => `  - \`${name}\`: ${uiComponentDescriptions[name]}`)
  .join("\n")

const baseRenderUiComponents = [
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
] as const

export const renderUiInputSchema = z.discriminatedUnion("component", [
  ...baseRenderUiComponents,
  z.object({
    component: z.literal("panel"),
    props: panelSchemas.propsSchema,
  }),
])

export const renderUiHistorySchema = z.discriminatedUnion("component", [
  ...baseRenderUiComponents,
  z.object({
    component: z.literal("panel"),
    props: panelSchemas.propsSchema,
  }),
  z.object({
    component: z.literal(LEGACY_CHAT_UI_COMPONENT_NAME),
    props: legacyPanelSchemas.propsSchema,
  }),
])

export const renderUiOutputSchema = z.intersection(
  renderUiHistorySchema,
  z.object({
    uiVersion: z.number().int(),
  }),
)

function normalizeLegacyAction(button: LegacyPanelButtonNode): AppAction | undefined {
  if (!button.action) {
    return undefined
  }

  if (typeof button.action === "string") {
    return {
      type: "sendMessage",
      text: button.label,
    }
  }

  return button.action
}

function normalizeLegacyLeaf(node: LegacyPanelLeafNode): PanelLeafNode {
  if (node.type === "button") {
    return {
      ...node,
      action: normalizeLegacyAction(node),
    }
  }

  return node
}

function normalizeLegacyChild(node: LegacyPanelDivChildNode): PanelDivChildNode {
  if (node.type === "div") {
    return {
      ...node,
      children: node.children.map(normalizeLegacyLeaf),
    }
  }

  return normalizeLegacyLeaf(node)
}

function normalizeLegacyNode(node: LegacyPanelNode): PanelNode {
  if (node.type === "div") {
    return {
      ...node,
      children: node.children.map(normalizeLegacyChild),
    }
  }

  return normalizeLegacyLeaf(node)
}

function normalizeLegacyPanelProps(props: LegacyPanelProps): PanelProps {
  return {
    ...props,
    children: props.children.map(normalizeLegacyNode),
  }
}

export function normalizeRenderUiOutput(output: RenderUiOutput): RenderUiInput {
  if (output.component === LEGACY_CHAT_UI_COMPONENT_NAME) {
    return {
      component: "panel",
      props: normalizeLegacyPanelProps(output.props),
    }
  }

  if (output.component === "panel") {
    return {
      component: "panel",
      props: output.props,
    }
  }

  return {
    component: output.component,
    props: output.props,
  } as RenderUiInput
}

export type CalloutProps = z.infer<typeof calloutPropsSchema>
export type InfoCardProps = z.infer<typeof infoCardPropsSchema>
export type StatGridProps = z.infer<typeof statGridPropsSchema>
export type DataTableProps = z.infer<typeof dataTablePropsSchema>
export type TimelineProps = z.infer<typeof timelinePropsSchema>
export type SourceListProps = z.infer<typeof sourceListPropsSchema>
export type RenderUiInput = z.infer<typeof renderUiInputSchema>
export type RenderUiOutput = z.infer<typeof renderUiOutputSchema>
