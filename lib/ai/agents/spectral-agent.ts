import {
  ToolLoopAgent,
  isStepCount,
  pruneMessages,
  type LanguageModel,
} from "ai"
import { getChatTools } from "@/lib/ai/tools"
import { resolveDeviceToolApproval } from "@/lib/devices/tool-approval"
import type { ChatExecutionMode } from "@/lib/devices/execution-policy"
import { RENDER_HTML_TOOL_NAME } from "@/lib/ai/ui/html-policy"

/**
 * O SDK envia o contexto inteiro a cada passo, então somar `input + output`
 * de todos os passos estoura qualquer orçamento em poucas iterações e o loop
 * era cortado antes de o modelo escrever a resposta final (mensagem vazia).
 * Agora o orçamento acumulado considera apenas tokens de saída; o contexto é
 * medido pelo `inputTokens` do último passo, que já reflete o prompt atual.
 */
export const MAX_AGENT_STEPS = 24
export const MAX_AGENT_OUTPUT_TOKENS = 80_000
export const MAX_AGENT_CONTEXT_TOKENS = 100_000
export const MAX_RENDER_HTML_CALLS = 2

export const WRAP_UP_INSTRUCTION = [
  "Você está no passo de encerramento desta execução.",
  "Não chame mais nenhuma ferramenta.",
  "Responda agora, em texto, com o que você já sabe: resuma o que foi feito,",
  "o que funcionou e o que ficou pendente. Se a tarefa não terminou, diga",
  "exatamente em que ponto parou e qual é o próximo passo.",
].join(" ")

const MAX_CONTEXT_MESSAGES = 40

export type AgentRuntimeContext = {
  userId: string
  chatId: string
  startedAt: number
  executionMode: ChatExecutionMode
  theme?: string | null
  resolvedTheme?: string | null
}

type CreateSpectralAgentInput = {
  model: LanguageModel
  instructions: string
  runtimeContext: AgentRuntimeContext
}

type StepWithToolCalls = {
  toolCalls: ReadonlyArray<{ toolName: string }>
}

export type StepWithUsage = StepWithToolCalls & {
  usage: {
    inputTokens?: number | null
    outputTokens?: number | null
  }
}

export function countRenderHtmlCalls(steps: readonly StepWithToolCalls[]) {
  return steps.reduce(
    (total, step) =>
      total +
      step.toolCalls.filter((call) => call.toolName === RENDER_HTML_TOOL_NAME)
        .length,
    0,
  )
}

export function totalOutputTokens(steps: readonly StepWithUsage[]) {
  return steps.reduce((total, step) => total + (step.usage.outputTokens ?? 0), 0)
}

function lastContextTokens(steps: readonly StepWithUsage[]) {
  const last = steps[steps.length - 1]

  return last?.usage.inputTokens ?? 0
}

/**
 * Decide se o próximo passo deve ser o encerramento (sem ferramentas, somente
 * texto). Isso evita o corte silencioso que deixava a resposta vazia: quando o
 * limite chega perto, o modelo ainda tem uma chance de escrever a conclusão.
 */
export function shouldWrapUpAgent(steps: readonly StepWithUsage[]) {
  if (steps.length === 0) {
    return false
  }

  if (steps.length >= MAX_AGENT_STEPS - 1) {
    return true
  }

  if (totalOutputTokens(steps) >= MAX_AGENT_OUTPUT_TOKENS) {
    return true
  }

  if (lastContextTokens(steps) >= MAX_AGENT_CONTEXT_TOKENS) {
    return true
  }

  return countRenderHtmlCalls(steps) >= MAX_RENDER_HTML_CALLS
}

export function createSpectralAgent({
  model,
  instructions,
  runtimeContext,
}: CreateSpectralAgentInput) {
  return new ToolLoopAgent({
    id: "spectral",
    model,
    instructions,
    tools: getChatTools({
      userId: runtimeContext.userId,
      chatId: runtimeContext.chatId,
      executionMode: runtimeContext.executionMode,
      theme: runtimeContext.theme,
      resolvedTheme: runtimeContext.resolvedTheme,
    }),
    // Toda tool de dispositivo passa por aqui antes de executar. A política
    // vive no app (modo da sessão + confirmação do device), nunca no texto do chat.
    toolApproval: async ({ toolCall }) =>
      resolveDeviceToolApproval({
        userId: runtimeContext.userId,
        chatId: runtimeContext.chatId,
        executionMode: runtimeContext.executionMode,
        toolName: toolCall.toolName,
        input: toolCall.input,
      }),
    // Assina os pedidos de aprovação: sem isso, um cliente malicioso poderia
    // forjar a resposta de aprovação de um comando que nunca foi autorizado.
    experimental_toolApprovalSecret:
      process.env.SPECTRAL_TOOL_APPROVAL_SECRET ?? process.env.AUTH_SECRET,
    // O limite duro fica acima do passo de encerramento: em condições normais
    // o loop termina sozinho quando o wrap-up responde apenas com texto.
    stopWhen: [isStepCount(MAX_AGENT_STEPS + 1)],
    runtimeContext,
    prepareStep: ({ steps, messages }) => {
      if (shouldWrapUpAgent(steps)) {
        return {
          activeTools: [],
          instructions: WRAP_UP_INSTRUCTION,
        }
      }

      if (messages.length <= MAX_CONTEXT_MESSAGES) {
        return {}
      }

      return {
        messages: pruneMessages({
          messages,
          reasoning: "before-last-message",
          toolCalls: "before-last-3-messages",
          emptyMessages: "remove",
        }),
      }
    },
  })
}
