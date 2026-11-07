"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import type { UIMessage } from "ai"
import { useChatNotification } from "@/components/chat/chat-notification-provider"
import {
  disposeChatRuntime,
  getChatMessages,
  getChatModel,
  hasChatRuntime,
  setChatFinishHandler,
} from "@/lib/chat-runtime"

export type ChatSummary = {
  id: string
  title: string
  provider: string | null
  model: string | null
  updatedAt: string
}

type ActiveChat = {
  chatId: string
  isDraft: boolean
  isLoading: boolean
  messages: UIMessage[]
  model: string | null
}

type ChatContextValue = {
  chatId: string
  isDraft: boolean
  isLoadingChat: boolean
  initialMessages: UIMessage[]
  initialModel: string | null
  chats: ChatSummary[]
  chatsLoading: boolean
  chatsError: boolean
  startNewChat: () => void
  openChat: (id: string) => Promise<void>
  refreshChats: () => Promise<void>
  markChatPersisted: (chatId: string) => void
  deleteChat: (id: string) => Promise<boolean>
  renameChat: (id: string, title: string) => Promise<void>
}

const ChatContext = createContext<ChatContextValue | null>(null)

function createChatId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }

  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`
}

function createDraftChat(): ActiveChat {
  return {
    chatId: createChatId(),
    isDraft: true,
    isLoading: false,
    messages: [],
    model: null,
  }
}

function toChatSummary(value: unknown): ChatSummary | null {
  if (!value || typeof value !== "object") {
    return null
  }

  const chat = value as Record<string, unknown>

  if (
    typeof chat.id !== "string" ||
    typeof chat.title !== "string" ||
    typeof chat.updatedAt !== "string"
  ) {
    return null
  }

  return {
    id: chat.id,
    title: chat.title,
    provider: typeof chat.provider === "string" ? chat.provider : null,
    model: typeof chat.model === "string" ? chat.model : null,
    updatedAt: chat.updatedAt,
  }
}

function toUIMessages(value: unknown): UIMessage[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter(
    (message): message is UIMessage =>
      Boolean(
        message &&
          typeof message === "object" &&
          typeof (message as UIMessage).id === "string" &&
          Array.isArray((message as UIMessage).parts),
      ),
  )
}

function getAssistantText(message: UIMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("")
    .trim()
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const { notify } = useChatNotification()
  const [active, setActive] = useState<ActiveChat>(createDraftChat)
  const openRequestRef = useRef(0)
  const [chats, setChats] = useState<ChatSummary[]>([])
  const [chatsLoading, setChatsLoading] = useState(true)
  const [chatsError, setChatsError] = useState(false)

  const refreshChats = useCallback(async () => {
    try {
      const response = await fetch("/api/chats", { cache: "no-store" })

      if (!response.ok) {
        throw new Error("Falha ao carregar chats")
      }

      const data = (await response.json()) as { chats?: unknown }
      const next = Array.isArray(data.chats)
        ? data.chats.flatMap((chat) => {
            const summary = toChatSummary(chat)
            return summary ? [summary] : []
          })
        : []

      setChats(next)
      setChatsError(false)
    } catch {
      setChatsError(true)
    } finally {
      setChatsLoading(false)
    }
  }, [])

  useEffect(() => {
    const timeout = setTimeout(() => {
      void refreshChats()
    }, 0)

    return () => clearTimeout(timeout)
  }, [refreshChats])

  const markChatPersisted = useCallback(
    (chatId: string) => {
      setActive((current) =>
        current.chatId === chatId ? { ...current, isDraft: false } : current,
      )
      void refreshChats()
    },
    [refreshChats],
  )

  // A resposta pode terminar com a conversa fora da tela: a instância vive no
  // registry, então o handler continua valendo e atualiza sidebar/notificação.
  useEffect(() => {
    setChatFinishHandler((chatId, event) => {
      markChatPersisted(chatId)

      if (event.isAbort || event.isError || event.isDisconnect) {
        return
      }

      const text = getAssistantText(event.message)

      if (text) {
        notify({ body: text })
      }
    })

    return () => setChatFinishHandler(() => {})
  }, [markChatPersisted, notify])

  const startNewChat = useCallback(() => {
    openRequestRef.current += 1
    setActive(createDraftChat())
  }, [])

  const openChat = useCallback(async (id: string) => {
    if (hasChatRuntime(id)) {
      openRequestRef.current += 1
      setActive({
        chatId: id,
        isDraft: false,
        isLoading: false,
        messages: getChatMessages(id),
        model: getChatModel(id),
      })
      return
    }

    const requestId = openRequestRef.current + 1
    openRequestRef.current = requestId

    setActive((current) => ({ ...current, isLoading: true }))

    try {
      const response = await fetch(`/api/chats/${id}`, { cache: "no-store" })

      if (!response.ok) {
        throw new Error("Falha ao carregar chat")
      }

      const data = (await response.json()) as {
        chat?: { provider?: string | null; model?: string | null }
        messages?: unknown
      }

      if (requestId !== openRequestRef.current) {
        return
      }

      const provider = data.chat?.provider
      const model = data.chat?.model

      setActive({
        chatId: id,
        isDraft: false,
        isLoading: false,
        messages: toUIMessages(data.messages),
        model:
          typeof provider === "string" && typeof model === "string"
            ? `${provider}:${model}`
            : null,
      })
    } catch {
      if (requestId === openRequestRef.current) {
        setActive((current) => ({ ...current, isLoading: false }))
      }
    }
  }, [])

  const deleteChat = useCallback(
    async (id: string) => {
      try {
        const response = await fetch(`/api/chats/${id}`, {
          method: "DELETE",
        })

        if (!response.ok) {
          return false
        }

        disposeChatRuntime(id)
        setChats((current) => current.filter((chat) => chat.id !== id))
        openRequestRef.current += 1
        setActive((current) => {
          if (current.chatId !== id) {
            return current
          }

          return createDraftChat()
        })

        return true
      } catch {
        return false
      }
    },
    [],
  )

  const renameChat = useCallback(
    async (id: string, title: string) => {
      try {
        const response = await fetch(`/api/chats/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title }),
        })

        if (!response.ok) {
          return
        }

        setChats((current) =>
          current.map((chat) =>
            chat.id === id ? { ...chat, title } : chat,
          ),
        )

        if (active.chatId === id) {
          setActive((current) => ({ ...current, chatId: current.chatId }))
        }
      } catch {
        // swallow
      }
    },
    [active.chatId],
  )

  const value = useMemo(
    () => ({
      chatId: active.chatId,
      isDraft: active.isDraft,
      isLoadingChat: active.isLoading,
      initialMessages: active.messages,
      initialModel: active.model,
      chats,
      chatsLoading,
      chatsError,
      startNewChat,
      openChat,
      refreshChats,
      markChatPersisted,
      deleteChat,
      renameChat,
    }),
    [
      active,
      chats,
      chatsLoading,
      chatsError,
      startNewChat,
      openChat,
      refreshChats,
      markChatPersisted,
      deleteChat,
      renameChat,
    ],
  )

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

export function useChatSession() {
  const context = useContext(ChatContext)

  if (!context) {
    throw new Error("useChatSession deve ser usado dentro de ChatProvider")
  }

  return context
}
