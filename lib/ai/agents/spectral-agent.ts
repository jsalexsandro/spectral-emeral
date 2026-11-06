import {
  ToolLoopAgent,
  isStepCount,
  pruneMessages,
  type LanguageModel,
  type StepResult,
  type StopCondition,
  type ToolSet,
} from "ai"
import { getChatTools } from "@/lib/ai/tools"
import { RENDER_HTML_TOOL_NAME } from "@/lib/ai/ui/html-policy"

export const MAX_AGENT_STEPS = 12
export const MAX_AGENT_TOKENS = 150_000
export const MAX_RENDER_HTML_CALLS = 2

const MAX_CONTEXT_MESSAGES = 40

export type AgentRuntimeContext = {
  userId: string
  chatId: string
  startedAt: number
  theme?: string | null
  resolvedTheme?: string | null
  lastPlan?: {
    title?: string
    steps: Array<{ title: string; status: string }>
  }
}

type CreateSpectralAgentInput = {
  model: LanguageModel
  instructions: string
  runtimeContext: AgentRuntimeContext
}

function totalTokens(steps: Array<StepResult<ToolSet, AgentRuntimeContext>>) {
  return steps.reduce((total, step) => {
    const input = step.usage.inputTokens ?? 0
    const output = step.usage.outputTokens ?? 0

    return total + input + output
  }, 0)
}

const budgetExceeded: StopCondition<ToolSet, AgentRuntimeContext> = ({
  steps,
}) => totalTokens(steps) >= MAX_AGENT_TOKENS

type StepWithToolCalls = {
  toolCalls: ReadonlyArray<{ toolName: string }>
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

const renderHtmlLimitReached: StopCondition<ToolSet, AgentRuntimeContext> = ({
  steps,
}) => countRenderHtmlCalls(steps) >= MAX_RENDER_HTML_CALLS

const MAX_CONSECUTIVE_FAILED_PLANS = 3

// Stop condition auxiliada pelo contexto de runtime: para quando há muitas
// falhas de plano sem progresso. Desabilitada por padrão pois o StopCondition
// do SDK não expõe runtimeContext; reativar quando o cliente enviar lastPlan
// no corpo de /api/chat.
const repeatedPlanFailures = ({
  steps,
  runtimeContext,
}: {
  steps: StepResult<ToolSet, AgentRuntimeContext>[]
  runtimeContext?: AgentRuntimeContext
}) => {
  const rc = runtimeContext
  if (!rc?.lastPlan) {
    return false
  }

  const failedSteps = rc.lastPlan.steps.filter(
    (step) => step.status === "failed",
  ).length

  const hasProgress = rc.lastPlan.steps.some(
    (step) => step.status === "done" || step.status === "current",
  )

  return !hasProgress && failedSteps >= MAX_CONSECUTIVE_FAILED_PLANS
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
      theme: runtimeContext.theme,
      resolvedTheme: runtimeContext.resolvedTheme,
    }),
    stopWhen: [
      isStepCount(MAX_AGENT_STEPS),
      budgetExceeded,
      renderHtmlLimitReached,
      repeatedPlanFailures as StopCondition<ToolSet, AgentRuntimeContext>,
    ],
    runtimeContext,
    prepareStep: ({ messages }) => {
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
