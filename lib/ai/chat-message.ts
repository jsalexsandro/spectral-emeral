import type { UIMessage } from "ai"
import { z } from "zod"

export const chatMessageMetadataSchema = z.object({
  provider: z.string().optional(),
  modelId: z.string().optional(),
  fallbackFrom: z.string().nullable().optional(),
})

export type ChatMessageMetadata = z.infer<typeof chatMessageMetadataSchema>

export type ChatUIMessage = UIMessage<ChatMessageMetadata>
