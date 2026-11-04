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
import { RENDER_UI_TOOL_NAME } from "@/lib/ai/ui/catalog"

export const MAX_AGENT_STEPS = 12
export const MAX_AGENT_TOKENS = 150_000
export const MAX_RENDER_UI_CALLS = 2

const MAX_CONTEXT_MESSAGES = 40

export type AgentRuntimeContext = {
  userId: string
  chatId: string
  startedAt: number
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

export function countRenderUiCalls(steps: readonly StepWithToolCalls[]) {
  return steps.reduce(
    (total, step) =>
      total +
      step.toolCalls.filter((call) => call.toolName === RENDER_UI_TOOL_NAME)
        .length,
    0,
  )
}

const renderUiLimitReached: StopCondition<ToolSet, AgentRuntimeContext> = ({
  steps,
}) => countRenderUiCalls(steps) >= MAX_RENDER_UI_CALLS

export function createSpectralAgent({
  model,
  instructions,
  runtimeContext,
}: CreateSpectralAgentInput) {
  return new ToolLoopAgent({
    id: "spectral",
    model,
    instructions,
    tools: getChatTools({ userId: runtimeContext.userId }),
    stopWhen: [
      isStepCount(MAX_AGENT_STEPS),
      budgetExceeded,
      renderUiLimitReached,
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
