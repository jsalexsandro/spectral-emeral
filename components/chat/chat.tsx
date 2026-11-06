"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useChat } from "@ai-sdk/react"
import {
  DefaultChatTransport,
  getToolName,
  isToolUIPart,
  type UIMessage,
} from "ai"
import { ArrowUp, Loader2, Paperclip, Square } from "lucide-react"
import { toast } from "sonner"
import { ChatActionProvider } from "@/app/app/chat-action-provider"
import { useChatSession } from "@/app/app/chat-provider"
import { AppActionHandler, RenderHtmlPart } from "@/components/ai-ui"
import {
  RUN_ACTION_TOOL_NAME,
  type ActionResult,
} from "@/lib/ai/actions/catalog"
import {
  LEGACY_EXTERN_UI_TOOL_NAME,
  LEGACY_RENDER_UI_TOOL_NAME,
} from "@/lib/ai/actions/legacy"
import {
  resolveDefaultModelKey,
  type InstantModelPreference,
} from "@/lib/ai/instant-models"
import { aiModels, getModelKey } from "@/lib/ai/models"
import type { ProviderId } from "@/lib/ai/providers"
import { RENDER_HTML_TOOL_NAME } from "@/lib/ai/ui/html-policy"
import { AgentActivity } from "./agent-activity"
import { MarkdownMessage } from "./markdown-message"
import { ModelSelect } from "./model-select"

type ChatProps = {
  greeting?: string
  configuredProviders: readonly ProviderId[]
  instantPreferences: readonly InstantModelPreference[]
}

type ChatSessionProps = ChatProps & {
  chatId: string
  initialMessages: UIMessage[]
  initialModel: string | null
  onChatPersisted: () => void
}

const MAX_TEXTAREA_HEIGHT = 240

const hiddenMessageToolNames = new Set<string>([
  RUN_ACTION_TOOL_NAME,
  LEGACY_EXTERN_UI_TOOL_NAME,
])

function getMessageText(message: UIMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("")
    .trim()
}

function LegacyRenderUiFallback() {
  return (
    <div
      role="status"
      className="rounded-xl border border-border/70 bg-muted/40 p-3.5 text-xs text-muted-foreground"
    >
      Esta visualização usava o formato antigo e não está mais disponível.
    </div>
  )
}

export function Chat({
  greeting = "Olá!",
  configuredProviders,
  instantPreferences,
}: ChatProps) {
  const {
    chatId,
    initialMessages,
    initialModel,
    isLoadingChat,
    markChatPersisted,
  } = useChatSession()

  if (isLoadingChat) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <ChatSession
      key={chatId}
      chatId={chatId}
      initialMessages={initialMessages}
      initialModel={initialModel}
      greeting={greeting}
      configuredProviders={configuredProviders}
      instantPreferences={instantPreferences}
      onChatPersisted={markChatPersisted}
    />
  )
}

function ChatSession({
  chatId,
  initialMessages,
  initialModel,
  greeting,
  configuredProviders,
  instantPreferences,
  onChatPersisted,
}: ChatSessionProps) {
  const [message, setMessage] = useState("")
  const [model, setModel] = useState(() => {
    if (
      initialModel &&
      aiModels.some((item) => getModelKey(item) === initialModel)
    ) {
      return initialModel
    }

    return resolveDefaultModelKey(configuredProviders, instantPreferences)
  })
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const initialMessageIds = useMemo(
    () => new Set(initialMessages.map((item) => item.id)),
    [initialMessages],
  )
  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/chat" }),
    [],
  )

  const { messages, sendMessage, status, error, stop } = useChat<UIMessage>({
    id: chatId,
    messages: initialMessages,
    transport,
    onFinish: onChatPersisted,
  })

  const isBusy = status === "submitted" || status === "streaming"
  const canSend = message.trim().length > 0 && model.length > 0 && !isBusy
  const hasMessages = messages.length > 0

  const sendText = useCallback(
    (text: string): ActionResult => {
      const content = text.trim()

      if (!content) {
        return { ok: false, error: "empty-message" }
      }

      if (!model) {
        toast.error("Selecione um modelo antes de enviar.")
        return { ok: false, error: "missing-model" }
      }

      if (isBusy) {
        toast.info("Aguarde a resposta atual terminar.")
        return { ok: false, error: "busy" }
      }

      void sendMessage(
        { text: content },
        {
          body: {
            chatId,
            model,
          },
        },
      )

      return { ok: true }
    },
    [chatId, isBusy, model, sendMessage],
  )

  useEffect(() => {
    const textarea = textareaRef.current

    if (!textarea) {
      return
    }

    textarea.style.height = "auto"
    textarea.style.height = `${Math.min(
      textarea.scrollHeight,
      MAX_TEXTAREA_HEIGHT,
    )}px`
  }, [message])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" })
  }, [messages, status])

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const result = sendText(message)

    if (result.ok) {
      setMessage("")
      textareaRef.current?.focus()
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      event.currentTarget.form?.requestSubmit()
    }
  }

  return (
    <ChatActionProvider sendText={sendText}>
      <AppActionHandler
        messages={messages}
        initialMessageIds={initialMessageIds}
      />
      <div className="flex h-full min-h-0 flex-col">
        {hasMessages ? (
        <div className="flex-1 overflow-y-auto px-4 py-8">
          <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
            {messages.map((item, messageIndex) => {
              const text = getMessageText(item)
              const hasToolParts = item.parts.some(
                (part) =>
                  isToolUIPart(part) &&
                  !hiddenMessageToolNames.has(getToolName(part)),
              )
              const isUser = item.role === "user"
              const isStreaming =
                status === "streaming" &&
                messageIndex === messages.length - 1 &&
                !isUser

              if (!text && !hasToolParts && item.role === "assistant") {
                return null
              }

              return (
                <div
                  key={item.id}
                  className={
                    isUser
                      ? "max-w-[85%] self-end rounded-2xl bg-primary px-4 py-2.5 text-sm break-words whitespace-pre-wrap text-primary-foreground"
                      : "max-w-[85%] self-start rounded-2xl bg-muted px-4 py-2.5 text-sm break-words text-foreground"
                  }
                >
                  {isUser ? (
                    text
                  ) : (
                    <div className="flex flex-col gap-2">
                      <AgentActivity
                        key={`${item.id}-activity`}
                        parts={item.parts}
                        isStreaming={isStreaming}
                      />
                      {item.parts.map((part, index) => {
                        if (part.type === "text" && part.text.trim()) {
                          return (
                            <MarkdownMessage
                              key={`${item.id}-text-${index}`}
                              content={part.text}
                            />
                          )
                        }

                        if (
                          isToolUIPart(part) &&
                          getToolName(part) === RENDER_HTML_TOOL_NAME
                        ) {
                          return (
                            <RenderHtmlPart
                              key={part.toolCallId ?? `${item.id}-tool-${index}`}
                              part={part}
                            />
                          )
                        }

                        if (
                          isToolUIPart(part) &&
                          getToolName(part) === LEGACY_RENDER_UI_TOOL_NAME
                        ) {
                          return (
                            <LegacyRenderUiFallback
                              key={part.toolCallId ?? `${item.id}-legacy-${index}`}
                            />
                          )
                        }

                        return null
                      })}
                    </div>
                  )}
                </div>
              )
            })}
            {status === "submitted" && (
              <div className="flex max-w-[85%] items-center gap-2 self-start rounded-2xl bg-muted px-4 py-2.5 text-sm text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                Pensando...
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center px-4">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            {greeting}
          </h1>
        </div>
      )}

      <div className="px-3 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-4 sm:pb-6">
        <form className="mx-auto w-full max-w-2xl" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-2.5 shadow-soft focus-within:border-primary/50 focus-within:ring-3 focus-within:ring-primary/10 sm:flex-row sm:items-end sm:p-3">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Como posso ajudar você hoje?"
              rows={1}
              aria-label="Mensagem"
              enterKeyHint="send"
              className="order-1 max-h-60 min-h-10 w-full flex-1 resize-none overflow-y-auto bg-transparent px-2 py-2 text-base outline-none [scrollbar-width:none] placeholder:text-muted-foreground sm:order-2 sm:px-1 sm:text-sm [&::-webkit-scrollbar]:hidden"
            />
            <div className="order-2 flex items-center gap-2 sm:contents">
              <button
                type="button"
                aria-label="Anexar arquivo"
                title="Anexar arquivo"
                disabled
                className="hidden size-9 shrink-0 cursor-not-allowed items-center justify-center rounded-lg text-muted-foreground opacity-50 sm:order-1 sm:flex"
              >
                <Paperclip className="size-4" />
              </button>
              <div className="min-w-0 flex-1 sm:order-3 sm:flex-none">
                <ModelSelect
                  value={model}
                  onChange={setModel}
                  configuredProviders={configuredProviders}
                  instantPreferences={instantPreferences}
                />
              </div>
              <button
                type={isBusy ? "button" : "submit"}
                aria-label={isBusy ? "Parar resposta" : "Enviar mensagem"}
                title={isBusy ? "Parar resposta" : "Enviar mensagem"}
                onClick={isBusy ? () => stop() : undefined}
                disabled={!isBusy && !canSend}
                className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/80 disabled:cursor-not-allowed disabled:opacity-50 sm:order-4"
              >
                {isBusy ? (
                  <Square className="size-3.5 fill-current" />
                ) : (
                  <ArrowUp className="size-4" />
                )}
              </button>
            </div>
          </div>
          <p className="mt-2 hidden text-center text-xs text-muted-foreground sm:block">
            Enter para enviar · Shift+Enter para quebrar linha
          </p>
          {error && (
            <p className="mt-2 text-center text-xs text-destructive">
              Não foi possível concluir a resposta. Verifique o modelo e a
              chave do provedor.
            </p>
          )}
        </form>
      </div>
      </div>
    </ChatActionProvider>
  )
}
