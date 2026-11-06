import { z } from "zod"
import { appActionSchema } from "@/lib/ai/actions/catalog"
import { isAllowedHtmlUri } from "./html-policy"

export const WIDGET_PROTOCOL_VERSION = 1

/**
 * O widget roda em um iframe com origem opaca. `allow-same-origin` nunca deve
 * entrar aqui: sem ele o documento não acessa cookies, storage ou o DOM do app.
 */
export const WIDGET_IFRAME_SANDBOX = "allow-scripts" as const

export const WIDGET_MIN_HEIGHT = 32
export const WIDGET_MAX_HEIGHT = 2_000

export const WIDGET_MAX_ACTIONS_PER_SESSION = 40
export const WIDGET_MAX_ACTIONS_PER_WINDOW = 12
export const WIDGET_ACTION_WINDOW_MS = 10_000

const envelope = {
  protocol: z.literal(WIDGET_PROTOCOL_VERSION),
  nonce: z.string().min(1).max(128),
}

export const widgetReadyMessageSchema = z.object({
  ...envelope,
  type: z.literal("widget:ready"),
})

export const widgetResizeMessageSchema = z.object({
  ...envelope,
  type: z.literal("widget:resize"),
  height: z.number().finite().min(0).max(10_000),
})

export const widgetActionMessageSchema = z.object({
  ...envelope,
  type: z.literal("widget:action"),
  requestId: z.string().min(1).max(64),
  action: appActionSchema,
  userInitiated: z.boolean(),
})

export const widgetOpenMessageSchema = z.object({
  ...envelope,
  type: z.literal("widget:open"),
  url: z
    .string()
    .min(1)
    .max(2_048)
    .refine(isAllowedHtmlUri, "URL não permitida."),
  userInitiated: z.boolean(),
})

export const widgetMessageSchema = z.discriminatedUnion("type", [
  widgetReadyMessageSchema,
  widgetResizeMessageSchema,
  widgetActionMessageSchema,
  widgetOpenMessageSchema,
])

export const widgetThemeMessageSchema = z.object({
  ...envelope,
  type: z.literal("widget:theme"),
  theme: z.enum(["light", "dark"]),
})

export type WidgetMessage = z.infer<typeof widgetMessageSchema>
export type WidgetActionMessage = z.infer<typeof widgetActionMessageSchema>
export type WidgetOpenMessage = z.infer<typeof widgetOpenMessageSchema>
export type WidgetThemeMessage = z.infer<typeof widgetThemeMessageSchema>

export function clampWidgetHeight(height: number): number {
  if (!Number.isFinite(height)) {
    return WIDGET_MIN_HEIGHT
  }

  return Math.min(WIDGET_MAX_HEIGHT, Math.max(WIDGET_MIN_HEIGHT, Math.round(height)))
}

/**
 * Ações que mudam a conversa ou a rota exigem gesto do usuário. Sem isso um
 * script gerado pelo modelo poderia disparar `sendMessage` em loop na carga.
 */
export function requiresUserGesture(actionType: string): boolean {
  return actionType === "sendMessage" || actionType === "navigate"
}

export function buildWidgetThemeMessage(
  nonce: string,
  theme: "light" | "dark",
): WidgetThemeMessage {
  return {
    type: "widget:theme",
    protocol: WIDGET_PROTOCOL_VERSION,
    nonce,
    theme,
  }
}
