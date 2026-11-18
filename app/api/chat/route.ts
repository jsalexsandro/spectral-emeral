import {
  createAgentUIStream,
  createUIMessageStreamResponse,
  safeValidateUIMessages,
  type UIMessage,
  type UIMessageChunk,
} from "ai"
import { createId } from "@paralleldrive/cuid2"
import { eq } from "drizzle-orm"
import { auth } from "@/auth"
import { db } from "@/db"
import { aiKeys, instantModels, users } from "@/db/schema"
import { createSpectralAgent } from "@/lib/ai/agents/spectral-agent"
import { resolveChatModel } from "@/lib/ai/chat-model"
import {
  ensureOwnedChat,
  getChatTitle,
  getMessageText,
  saveChatMessage,
  touchChat,
} from "@/lib/ai/chat-service"
import { getFallbackCandidateModels } from "@/lib/ai/instant-models"
import { getModel, parseModelKey } from "@/lib/ai/models"
import { buildSystemPrompt } from "@/lib/ai/prompts"
import { isProviderId, type ProviderId } from "@/lib/ai/providers"
import { sendChatMessageSchema } from "@/lib/validations/chat"

export const maxDuration = 240

const modelErrorStatus = {
  unknown_model: 400,
  model_disabled: 403,
  missing_api_key: 403,
} as const

const AGENT_TIMEOUT_MS = 240_000
const MAX_FALLBACK_ATTEMPTS = 3

function isContentChunk(chunk: UIMessageChunk): boolean {
  const type = (chunk as { type?: string }).type
  return (
    type === "text-delta" ||
    type === "reasoning-delta" ||
    type === "tool-input-start" ||
    type === "tool-input-delta" ||
    type === "tool-input-available" ||
    type === "tool-output-available" ||
    type === "tool-output-error" ||
    type === "source-url" ||
    type === "source-document" ||
    type === "file"
  )
}

async function toResponseStream(
  chunks: AsyncIterable<UIMessageChunk> | ReadableStream<UIMessageChunk>,
): Promise<Response> {
  const stream =
    chunks instanceof ReadableStream
      ? chunks
      : (ReadableStream as unknown as {
          from?: (iterable: AsyncIterable<UIMessageChunk>) => ReadableStream<UIMessageChunk>
        }).from
        ? (ReadableStream as unknown as {
            from: (iterable: AsyncIterable<UIMessageChunk>) => ReadableStream<UIMessageChunk>
          }).from(chunks)
        : new ReadableStream<UIMessageChunk>({
            async start(controller) {
              try {
                for await (const chunk of chunks) {
                  controller.enqueue(chunk)
                }
                controller.close()
              } catch (error) {
                controller.error(error)
              }
            },
          })

  return createUIMessageStreamResponse({ stream })
}

export async function POST(request: Request) {
  const session = await auth()

  if (!session?.user?.id) {
    return Response.json({ error: "unauthorized" }, { status: 401 })
  }

  let payload: unknown

  try {
    payload = await request.json()
  } catch {
    return Response.json({ error: "invalid_payload" }, { status: 400 })
  }

  const parsed = sendChatMessageSchema.safeParse(payload)

  if (!parsed.success) {
    return Response.json(
      {
        error: "invalid_payload",
        issues: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    )
  }

  const modelKey = parseModelKey(parsed.data.model)

  if (!modelKey) {
    return Response.json({ error: "unknown_model" }, { status: 400 })
  }

  const validation = await safeValidateUIMessages({
    messages: parsed.data.messages as UIMessage[],
  })

  if (!validation.success) {
    return Response.json({ error: "invalid_messages" }, { status: 400 })
  }

  const messages = validation.data
  const userMessage = [...messages]
    .reverse()
    .find((message) => message.role === "user")

  if (!userMessage) {
    return Response.json({ error: "missing_user_message" }, { status: 400 })
  }

  const userText = getMessageText(userMessage)

  if (!userText) {
    return Response.json({ error: "empty_message" }, { status: 400 })
  }

  const { chatId } = parsed.data

  try {
    const [userRow, keyRows, preferenceRows] = await Promise.all([
      db
        .select({
          allowModelFallbackOnFailure: users.allowModelFallbackOnFailure,
        })
        .from(users)
        .where(eq(users.id, session.user.id))
        .limit(1)
        .then((rows) => rows[0]),
      db
        .select({ provider: aiKeys.provider })
        .from(aiKeys)
        .where(eq(aiKeys.userId, session.user.id)),
      db
        .select({
          provider: instantModels.provider,
          modelId: instantModels.modelId,
          enabled: instantModels.enabled,
        })
        .from(instantModels)
        .where(eq(instantModels.userId, session.user.id)),
    ])

    const allowFallback = userRow?.allowModelFallbackOnFailure ?? false
    const configuredProviders = Array.from(
      new Set(
        keyRows
          .map((key) => key.provider)
          .filter((provider): provider is ProviderId => isProviderId(provider)),
      ),
    )
    const instantPreferences = preferenceRows.flatMap((preference) => {
      if (
        !isProviderId(preference.provider) ||
        !getModel(preference.provider, preference.modelId)
      ) {
        return []
      }

      return [
        {
          provider: preference.provider as ProviderId,
          modelId: preference.modelId,
          enabled: preference.enabled,
        },
      ]
    })

    const attempts: Array<{ provider: ProviderId; modelId: string }> = [
      modelKey,
      ...(allowFallback
        ? getFallbackCandidateModels(
            configuredProviders,
            instantPreferences,
            modelKey,
            MAX_FALLBACK_ATTEMPTS - 1,
          )
        : []),
    ]

    // Salva a mensagem do usuário e garante o chat uma única vez (modelo solicitado).
    const chatExists = await ensureOwnedChat({
      userId: session.user.id,
      chatId,
      title: getChatTitle(userText),
      provider: modelKey.provider,
      modelId: modelKey.modelId,
    })

    if (!chatExists) {
      return Response.json({ error: "chat_not_found" }, { status: 404 })
    }

    await saveChatMessage({
      id: userMessage.id,
      chatId,
      role: "user",
      content: userText,
      parts: userMessage.parts,
    })

    let lastResolveError: "unknown_model" | "model_disabled" | "missing_api_key" | null =
      null

    for (let index = 0; index < attempts.length; index++) {
      const attempt = attempts[index]
      const isLast = index === attempts.length - 1
      const resolved = await resolveChatModel(
        session.user.id,
        attempt.provider,
        attempt.modelId,
      )

      if (!resolved.ok) {
        lastResolveError = resolved.error
        if (
          allowFallback &&
          !isLast &&
          (resolved.error === "model_disabled" ||
            resolved.error === "missing_api_key")
        ) {
          console.info(
            JSON.stringify({
              event: "agent_model_fallback_skip",
              chatId,
              from: `${attempt.provider}/${attempt.modelId}`,
              reason: resolved.error,
            }),
          )
          continue
        }

        if (!allowFallback || isLast || resolved.error === "unknown_model") {
          return Response.json(
            { error: resolved.error },
            { status: modelErrorStatus[resolved.error] },
          )
        }

        continue
      }

      const systemPrompt = buildSystemPrompt({
        user: {
          name: session.user.name,
          nickname: session.user.nickname,
        },
        now: new Date(),
        model: {
          provider: attempt.provider,
          modelId: attempt.modelId,
        },
        theme: parsed.data.theme ?? null,
        resolvedTheme: parsed.data.resolvedTheme ?? null,
      })

      const agent = createSpectralAgent({
        model: resolved.model,
        instructions: systemPrompt.prompt,
        runtimeContext: {
          userId: session.user.id,
          chatId,
          startedAt: Date.now(),
          executionMode: parsed.data.executionMode,
          theme: parsed.data.theme ?? null,
          resolvedTheme: parsed.data.resolvedTheme ?? null,
        },
      })

      let inputTokens = 0
      let outputTokens = 0
      let stepCount = 0
      let errorSeen = false
      let committed = false

      const stream = await createAgentUIStream({
        agent,
        uiMessages: messages,
        originalMessages: messages,
        generateMessageId: () => createId(),
        abortSignal: request.signal,
        timeout: { totalMs: AGENT_TIMEOUT_MS },
        onError: (error) => {
          errorSeen = true
          console.error(
            JSON.stringify({
              event: "agent_error",
              chatId,
              provider: attempt.provider,
              modelId: attempt.modelId,
              message: error instanceof Error ? error.message : String(error),
            }),
          )
          return "Não foi possível gerar a resposta."
        },
        onStepEnd: (step) => {
          stepCount += 1
          inputTokens += step.usage.inputTokens ?? 0
          outputTokens += step.usage.outputTokens ?? 0

          console.info(
            JSON.stringify({
              event: "agent_step_end",
              chatId,
              step: stepCount,
              finishReason: step.finishReason,
              inputTokens: step.usage.inputTokens ?? null,
              outputTokens: step.usage.outputTokens ?? null,
              totalOutputTokens: outputTokens,
              contextTokens: step.usage.inputTokens ?? null,
              toolCalls: step.toolCalls.map((call) => call.toolName),
              provider: attempt.provider,
              modelId: attempt.modelId,
            }),
          )
        },
        onEnd: async ({ responseMessage, isAborted, outcome }) => {
          try {
            if (!committed) {
              return
            }

            const responseText = getMessageText(responseMessage)

            console.info(
              JSON.stringify({
                event: "agent_end",
                chatId,
                steps: stepCount,
                aborted: isAborted,
                outcome: outcome.status,
                promptVersion: systemPrompt.version,
                inputTokens,
                outputTokens,
                textLength: responseText.length,
                emptyResponse: responseText.length === 0,
                provider: attempt.provider,
                modelId: attempt.modelId,
              }),
            )

            if (!responseText && responseMessage.parts.length === 0) {
              return
            }

            await saveChatMessage({
              id: responseMessage.id,
              chatId,
              role: responseMessage.role,
              content: responseText,
              parts: responseMessage.parts,
              provider: attempt.provider,
              modelId: attempt.modelId,
              promptVersion: systemPrompt.version,
              inputTokens: inputTokens || null,
              outputTokens: outputTokens || null,
            })
            await touchChat(chatId)
          } catch (error) {
            console.error("Falha ao salvar resposta do assistente:", error)
          }
        },
      })

      const iterator = stream[Symbol.asyncIterator]()
      const buffer: UIMessageChunk[] = []
      let hasContent = false
      let earlyDone = false

      while (true) {
        let next: IteratorResult<UIMessageChunk>
        try {
          next = await iterator.next()
        } catch (error) {
          errorSeen = true
          console.error(
            JSON.stringify({
              event: "agent_stream_error",
              chatId,
              provider: attempt.provider,
              modelId: attempt.modelId,
              message: error instanceof Error ? error.message : String(error),
            }),
          )
          break
        }

        if (next.done) {
          earlyDone = true
          break
        }

        const chunk = next.value
        buffer.push(chunk)
        if (isContentChunk(chunk)) {
          hasContent = true
          committed = true
          break
        }
      }

      const canRetry = allowFallback && !isLast && !hasContent
      if (canRetry && (errorSeen || earlyDone)) {
        console.info(
          JSON.stringify({
            event: "agent_model_fallback",
            chatId,
            from: `${attempt.provider}/${attempt.modelId}`,
            to: `${attempts[index + 1].provider}/${attempts[index + 1].modelId}`,
            reason: errorSeen ? "stream_error" : "no_content",
          }),
        )
        continue
      }

      committed = true

      async function* forward() {
        for (const chunk of buffer) {
          yield chunk
        }
        if (!hasContent) {
          // Consumir o restante normalmente (pode ter terminado sem conteúdo útil).
          while (true) {
            const next = await iterator.next()
            if (next.done) return
            yield next.value
          }
        } else {
          while (true) {
            const next = await iterator.next()
            if (next.done) return
            yield next.value
          }
        }
      }

      return await toResponseStream(forward())
    }

    if (lastResolveError) {
      return Response.json(
        { error: lastResolveError },
        { status: modelErrorStatus[lastResolveError] },
      )
    }

    return Response.json({ error: "internal_error" }, { status: 500 })
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "chat_route_error",
        chatId,
        message: error instanceof Error ? error.message : String(error),
      }),
    )
    return Response.json({ error: "internal_error" }, { status: 500 })
  }
}
