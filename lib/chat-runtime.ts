import { Chat } from "@ai-sdk/react"
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
  type ChatOnFinishCallback,
  type UIMessage,
} from "ai"
import { chatMessageMetadataSchema, type ChatUIMessage } from "@/lib/ai/chat-message"

export type ChatFinishEvent = Parameters<ChatOnFinishCallback<UIMessage>>[0]

type ChatRuntime = {
  chat: Chat<ChatUIMessage>
  model: string | null
}

type FinishHandler = (chatId: string, event: ChatFinishEvent) => void

/**
 * Instâncias de `Chat` vivem fora do React para que o stream continue
 * rodando quando a conversa sai da tela. No servidor nada é armazenado:
 * cada requisição cria uma instância descartável, evitando vazar mensagens
 * entre usuários.
 */
const runtimes = new Map<string, ChatRuntime>()
const isBrowser = typeof window !== "undefined"

let finishHandler: FinishHandler = () => {}

export function setChatFinishHandler(handler: FinishHandler): void {
  finishHandler = handler
}

export function getOrCreateChat(
  chatId: string,
  messages: UIMessage[],
  model: string | null,
): Chat<ChatUIMessage> {
  if (isBrowser) {
    const existing = runtimes.get(chatId)

    if (existing) {
      return existing.chat
    }
  }

  const chat = new Chat<ChatUIMessage>({
    id: chatId,
    messages: messages as ChatUIMessage[],
    messageMetadataSchema: chatMessageMetadataSchema,
    transport: new DefaultChatTransport<ChatUIMessage>({ api: "/api/chat" }),
    // Sem isso, responder a um pedido de aprovação não reenvia as mensagens
    // e o agente fica parado esperando para sempre.
    sendAutomaticallyWhen:
      lastAssistantMessageIsCompleteWithApprovalResponses,
    onFinish: (event) => {
      finishHandler(chatId, event)
    },
  })

  if (isBrowser) {
    runtimes.set(chatId, { chat, model })
  }

  return chat
}

export function hasChatRuntime(chatId: string): boolean {
  return runtimes.has(chatId)
}

export function getChatMessages(chatId: string): UIMessage[] {
  return runtimes.get(chatId)?.chat.messages ?? []
}

export function getChatModel(chatId: string): string | null {
  return runtimes.get(chatId)?.model ?? null
}

export function rememberChatModel(chatId: string, model: string): void {
  const runtime = runtimes.get(chatId)

  if (runtime) {
    runtime.model = model
  }
}

export function disposeChatRuntime(chatId: string): void {
  const runtime = runtimes.get(chatId)

  if (!runtime) {
    return
  }

  runtimes.delete(chatId)
  void runtime.chat.dispose()
}
