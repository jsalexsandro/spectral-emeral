import type { UIMessage } from "ai"
import { and, eq } from "drizzle-orm"
import { db } from "@/db"
import { chatMessages, chats } from "@/db/schema"
import type { ProviderId } from "./providers"

const MAX_TITLE_LENGTH = 60

export function getMessageText(message: UIMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim()
}

export function getChatTitle(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim()

  if (!normalized) {
    return "Nova conversa"
  }

  if (normalized.length <= MAX_TITLE_LENGTH) {
    return normalized
  }

  return `${normalized.slice(0, MAX_TITLE_LENGTH).trimEnd()}…`
}

type EnsureChatInput = {
  userId: string
  chatId: string
  title: string
  provider: ProviderId
  modelId: string
}

export async function ensureOwnedChat({
  userId,
  chatId,
  title,
  provider,
  modelId,
}: EnsureChatInput): Promise<boolean> {
  const [existing] = await db
    .select({ userId: chats.userId })
    .from(chats)
    .where(eq(chats.id, chatId))
    .limit(1)

  if (existing && existing.userId !== userId) {
    return false
  }

  await db
    .insert(chats)
    .values({
      id: chatId,
      userId,
      title,
      provider,
      model: modelId,
    })
    .onConflictDoUpdate({
      target: chats.id,
      set: {
        provider,
        model: modelId,
        updatedAt: new Date(),
      },
    })

  return true
}

type SaveMessageInput = {
  id: string
  chatId: string
  role: "user" | "assistant" | "system"
  content: string
  parts: UIMessage["parts"]
  provider?: ProviderId | null
  modelId?: string | null
  promptVersion?: number | null
  inputTokens?: number | null
  outputTokens?: number | null
}

export async function saveChatMessage({
  id,
  chatId,
  role,
  content,
  parts,
  provider = null,
  modelId = null,
  promptVersion = null,
  inputTokens = null,
  outputTokens = null,
}: SaveMessageInput): Promise<void> {
  await db
    .insert(chatMessages)
    .values({
      id,
      chatId,
      role,
      content,
      parts,
      provider,
      model: modelId,
      promptVersion,
      inputTokens,
      outputTokens,
    })
    .onConflictDoNothing({ target: chatMessages.id })
}

export async function updateChatModel({
  chatId,
  provider,
  modelId,
}: {
  chatId: string
  provider: ProviderId
  modelId: string
}): Promise<void> {
  await db
    .update(chats)
    .set({ provider, model: modelId })
    .where(eq(chats.id, chatId))
}

export async function touchChat(chatId: string): Promise<void> {
  await db
    .update(chats)
    .set({ updatedAt: new Date() })
    .where(eq(chats.id, chatId))
}

export async function deleteOwnedChat(
  userId: string,
  chatId: string,
): Promise<boolean> {
  const deleted = await db
    .delete(chats)
    .where(and(eq(chats.id, chatId), eq(chats.userId, userId)))
    .returning({ id: chats.id })

  return deleted.length > 0
}
