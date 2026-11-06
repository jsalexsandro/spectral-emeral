import { z } from "zod"
import { getModel, parseModelKey } from "@/lib/ai/models"

export const chatIdSchema = z
  .string()
  .trim()
  .min(8, "Chat inválido")
  .max(64, "Chat inválido")
  .regex(/^[A-Za-z0-9_-]+$/, "Chat inválido")

export const chatModelSchema = z
  .string()
  .trim()
  .min(1, "Informe o modelo")
  .refine((value) => {
    const parsed = parseModelKey(value)
    return Boolean(parsed && getModel(parsed.provider, parsed.modelId))
  }, "Modelo desconhecido")

export const sendChatMessageSchema = z.object({
  chatId: chatIdSchema,
  model: chatModelSchema,
  messages: z.array(z.unknown()).min(1, "Envie ao menos uma mensagem"),
  theme: z.enum(["light", "dark", "system"]).optional(),
  resolvedTheme: z.enum(["light", "dark"]).optional(),
})

export type SendChatMessageInput = z.infer<typeof sendChatMessageSchema>
