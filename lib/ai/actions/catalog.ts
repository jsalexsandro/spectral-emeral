import { z } from "zod"
import { configSectionSchema } from "@/lib/config-sections"
import { isProviderId } from "@/lib/ai/providers"
import { DEVICE_APP_ID_PATTERN } from "@/spectral/shared/device-commands"

export const ACTION_CATALOG_VERSION = 3

export const RUN_ACTION_TOOL_NAME = "runAction" as const

const boundedText = (max: number) => z.string().trim().min(1).max(max)
const optionalText = (max: number) => z.string().trim().min(1).max(max).optional()

export const toastActionSchema = z.object({
  type: z.literal("toast"),
  title: boundedText(120),
  description: optionalText(500),
  variant: z
    .enum(["default", "success", "warning", "error", "info"])
    .default("default"),
  duration: z.number().int().min(1_000).max(10_000).optional(),
})

export const setThemeActionSchema = z.object({
  type: z.literal("setTheme"),
  theme: z.enum(["light", "dark", "system"]),
})

export const openSettingsActionSchema = z.object({
  type: z.literal("openSettings"),
  section: configSectionSchema.optional(),
})

export const allowedAppPaths = ["/app", "/providers/select-model"] as const

export function isAllowedAppPath(path: string): boolean {
  if ((allowedAppPaths as readonly string[]).includes(path)) {
    return true
  }

  const match = /^\/provider\/([^/?#]+)\/models$/.exec(path)

  return Boolean(match && isProviderId(match[1]))
}

export const navigateActionSchema = z.object({
  type: z.literal("navigate"),
  path: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .refine(isAllowedAppPath, "Caminho de navegação não permitido."),
})

export const copyActionSchema = z.object({
  type: z.literal("copy"),
  text: boundedText(4_000),
})

export const sendMessageActionSchema = z.object({
  type: z.literal("sendMessage"),
  text: boundedText(500),
})

/**
 * Abre um app da allowlist em um PC pareado. Fica fora de `aiActionSchema`
 * para que a IA não consiga executar a abertura por conta própria via
 * `runAction`: o comando só sai do app a partir de um clique no HTML/widget.
 */
export const openDeviceAppActionSchema = z.object({
  type: z.literal("openDeviceApp"),
  deviceId: z.string().trim().min(1).max(128),
  appId: z.string().trim().toLowerCase().regex(DEVICE_APP_ID_PATTERN),
})

export const appActionSchema = z.discriminatedUnion("type", [
  toastActionSchema,
  setThemeActionSchema,
  openSettingsActionSchema,
  navigateActionSchema,
  copyActionSchema,
  sendMessageActionSchema,
  openDeviceAppActionSchema,
])

export const aiActionSchema = z.discriminatedUnion("type", [
  toastActionSchema,
  setThemeActionSchema,
  openSettingsActionSchema,
  navigateActionSchema,
  copyActionSchema,
])

export const runActionOutputSchema = z.object({
  ok: z.literal(true),
  action: aiActionSchema,
})

export type ToastAction = z.infer<typeof toastActionSchema>
export type SetThemeAction = z.infer<typeof setThemeActionSchema>
export type OpenSettingsAction = z.infer<typeof openSettingsActionSchema>
export type NavigateAction = z.infer<typeof navigateActionSchema>
export type CopyAction = z.infer<typeof copyActionSchema>
export type SendMessageAction = z.infer<typeof sendMessageActionSchema>
export type OpenDeviceAppAction = z.infer<typeof openDeviceAppActionSchema>
export type AppAction = z.infer<typeof appActionSchema>
export type AiAction = z.infer<typeof aiActionSchema>
export type RunActionOutput = z.infer<typeof runActionOutputSchema>

export type ActionSource = "user" | "tool"

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string }

export type ActionRunner = (
  action: AppAction,
  options?: { source?: ActionSource },
) => Promise<ActionResult>
