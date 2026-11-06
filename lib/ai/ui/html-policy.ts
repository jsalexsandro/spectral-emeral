import { z } from "zod"
import { appActionSchema, type AppAction } from "@/lib/ai/actions/catalog"

export const HTML_UI_VERSION = 2

export const RENDER_HTML_TOOL_NAME = "renderHtml" as const

export const MAX_HTML_LENGTH = 20_000

export const MAX_SCRIPT_LENGTH = 12_000

export const HTML_UI_ACTION_ATTRIBUTE = "data-spectral-action" as const

export const MAX_ACTION_ATTRIBUTE_LENGTH = 2_000

export const HTML_UI_TAGS = [
  "a",
  "blockquote",
  "br",
  "button",
  "code",
  "details",
  "div",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "hr",
  "input",
  "label",
  "li",
  "ol",
  "option",
  "p",
  "pre",
  "progress",
  "select",
  "span",
  "strong",
  "summary",
  "table",
  "tbody",
  "td",
  "textarea",
  "th",
  "thead",
  "tr",
  "ul",
] as const

export type HtmlUiTag = (typeof HTML_UI_TAGS)[number]

export const HTML_UI_ATTRIBUTES = [
  "class",
  "title",
  "role",
  "aria-label",
  "aria-labelledby",
  "aria-describedby",
  "aria-hidden",
  "aria-live",
  "aria-current",
  "aria-expanded",
  "aria-controls",
  "href",
  "target",
  "rel",
  "type",
  "disabled",
  "colspan",
  "rowspan",
  "scope",
  "start",
  "value",
  "checked",
  "selected",
  "placeholder",
  "min",
  "max",
  "step",
  "rows",
  "cols",
  "multiple",
  "readonly",
  "required",
  "maxlength",
  "minlength",
  "inputmode",
  "open",
  HTML_UI_ACTION_ATTRIBUTE,
] as const

export const HTML_UI_INPUT_TYPES = [
  "checkbox",
  "date",
  "number",
  "radio",
  "range",
  "search",
  "text",
  "time",
] as const

export const HTML_UI_INPUT_TYPE_SET = new Set<string>(HTML_UI_INPUT_TYPES)

/** Atributos extras liberados apenas dentro do iframe de widgets v2. */
export const HTML_UI_WIDGET_ATTRIBUTES = [
  ...HTML_UI_ATTRIBUTES,
  "id",
  "for",
  "name",
] as const

export const HTML_UI_URI_SCHEMES = ["http:", "https:", "mailto:"] as const

function range(prefix: string, from: number, to: number) {
  return Array.from({ length: to - from + 1 }, (_, index) => {
    return `${prefix}-${from + index}`
  })
}

const layoutClasses = [
  "block",
  "inline-block",
  "flex",
  "inline-flex",
  "grid",
  "hidden",
  "flex-row",
  "flex-col",
  "flex-wrap",
  "flex-nowrap",
  "items-start",
  "items-center",
  "items-end",
  "items-stretch",
  "items-baseline",
  "justify-start",
  "justify-center",
  "justify-end",
  "justify-between",
  "justify-around",
  "justify-evenly",
  ...range("gap", 1, 6),
  "gap-2.5",
  ...range("grid-cols", 1, 4),
  ...range("col-span", 1, 4),
  "w-full",
  "h-full",
  "min-w-0",
  "max-w-full",
  "shrink-0",
  "grow",
  "overflow-hidden",
  "overflow-x-auto",
  "overflow-y-auto",
  "relative",
  "sr-only",
]

const spacingClasses = [
  ...range("p", 1, 6),
  ...range("px", 1, 6),
  ...range("py", 1, 6),
  ...range("pt", 1, 6),
  ...range("pb", 1, 6),
  ...range("pl", 1, 6),
  ...range("pr", 1, 6),
  "py-1.5",
  "px-2.5",
  "pb-2.5",
  ...range("m", 0, 6),
  "mx-auto",
  ...range("mt", 1, 6),
  ...range("mb", 1, 6),
  ...range("space-y", 1, 6),
]

const typographyClasses = [
  "text-xs",
  "text-sm",
  "text-base",
  "text-lg",
  "text-xl",
  "text-2xl",
  "font-normal",
  "font-medium",
  "font-semibold",
  "font-bold",
  "font-mono",
  "leading-tight",
  "leading-normal",
  "leading-relaxed",
  "text-left",
  "text-center",
  "text-right",
  "truncate",
  "break-words",
  "break-all",
  "whitespace-pre-wrap",
  "whitespace-nowrap",
  "tabular-nums",
  "uppercase",
  "tracking-wide",
  "italic",
  "underline",
  "list-disc",
  "list-decimal",
  "list-inside",
]

const colorClasses = [
  "bg-background",
  "bg-card",
  "bg-muted",
  "bg-secondary",
  "bg-accent",
  "bg-primary",
  "bg-destructive",
  "bg-transparent",
  "bg-primary/5",
  "bg-primary/10",
  "bg-destructive/5",
  "bg-destructive/10",
  "bg-muted/40",
  "bg-card/50",
  "text-foreground",
  "text-muted-foreground",
  "text-primary",
  "text-primary-foreground",
  "text-secondary-foreground",
  "text-card-foreground",
  "text-destructive",
  "text-accent-foreground",
  "text-background",
  "text-primary/80",
  "border-border",
  "border-input",
  "border-primary",
  "border-destructive",
  "border-transparent",
  "border-primary/20",
  "border-destructive/30",
  "hover:bg-primary/80",
  "hover:bg-primary/90",
  "hover:bg-muted",
  "hover:bg-secondary/80",
  "hover:text-foreground",
  "hover:text-primary/80",
  "ring-1",
  "ring-border",
  "ring-primary/20",
]

const borderClasses = [
  "border",
  "border-0",
  "border-t",
  "border-b",
  "border-l",
  "border-r",
  "border-collapse",
  "rounded-sm",
  "rounded-md",
  "rounded-lg",
  "rounded-xl",
  "rounded-2xl",
  "rounded-full",
  "divide-y",
  "divide-border",
  "shadow-soft",
]

const buttonClasses = [
  "inline-flex",
  "items-center",
  "justify-center",
  "rounded-md",
  "bg-primary",
  "text-primary-foreground",
  "px-3",
  "py-2",
  "text-sm",
  "font-medium",
  "transition-colors",
  "cursor-pointer",
  "disabled:opacity-50",
  "hover:bg-primary/90",
]

const tableClasses = [
  "w-full",
  "border-collapse",
  "text-left",
  "text-sm",
  "border-b",
  "border-border",
  "py-2",
  "px-3",
  "font-medium",
  "text-muted-foreground",
  "overflow-x-auto",
  "whitespace-nowrap",
]

const linkClasses = [
  "text-primary",
  "underline",
  "hover:text-primary/80",
  "break-all",
]

const miscClasses = ["select-none", "transition-colors", "cursor-pointer"]

export const HTML_UI_CLASSES = Array.from(
  new Set([
    ...layoutClasses,
    ...spacingClasses,
    ...typographyClasses,
    ...colorClasses,
    ...borderClasses,
    ...buttonClasses,
    ...tableClasses,
    ...linkClasses,
    ...miscClasses,
  ]),
).sort()

export const HTML_UI_CLASS_SET = new Set(HTML_UI_CLASSES)

const fencedHtmlPattern = /^```(?:html)?\s*([\s\S]*?)\s*```$/i

export function normalizeHtmlInput(value: unknown): unknown {
  if (typeof value !== "string") {
    return value
  }

  const trimmed = value.trim()
  const fenced = trimmed.match(fencedHtmlPattern)

  return (fenced?.[1] ?? trimmed).trim()
}

const fencedScriptPattern = /^```(?:js|javascript)?\s*([\s\S]*?)\s*```$/i

export function normalizeScriptInput(value: unknown): unknown {
  if (typeof value !== "string") {
    return value
  }

  const trimmed = value.trim()

  if (!trimmed) {
    return undefined
  }

  const fenced = trimmed.match(fencedScriptPattern)

  return (fenced?.[1] ?? trimmed).trim()
}

const scriptSchema = z.preprocess(
  normalizeScriptInput,
  z.string().trim().min(1).max(MAX_SCRIPT_LENGTH).optional(),
)

export const renderHtmlToolInputSchema = z.preprocess(
  (value) => {
    if (typeof value === "string") {
      return { html: normalizeHtmlInput(value) }
    }

    if (
      value &&
      typeof value === "object" &&
      "html" in value
    ) {
      return {
        ...value,
        html: normalizeHtmlInput((value as { html: unknown }).html),
      }
    }

    return value
  },
  z.object({
    html: z.string().trim().min(1).max(MAX_HTML_LENGTH),
    script: scriptSchema,
  }),
)

export const renderHtmlOutputSchema = z.object({
  uiVersion: z.number().int().positive(),
  html: z.string().min(1).max(MAX_HTML_LENGTH),
  script: z.string().min(1).max(MAX_SCRIPT_LENGTH).optional(),
})

export function isAllowedHtmlUri(value: string): boolean {
  try {
    const url = new URL(value)

    return (HTML_UI_URI_SCHEMES as readonly string[]).includes(url.protocol)
  } catch {
    return false
  }
}

export function parseHtmlAction(value: string | null): AppAction | null {
  if (!value || value.length > MAX_ACTION_ATTRIBUTE_LENGTH) {
    return null
  }

  try {
    const parsed = appActionSchema.safeParse(JSON.parse(value))

    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

export function sanitizeHtmlClassList(value: string): string {
  return value
    .split(/\s+/)
    .filter((className) => HTML_UI_CLASS_SET.has(className))
    .join(" ")
}
