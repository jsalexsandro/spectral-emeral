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
import {
  DEVICE_PRESS_KEY_TOOL_NAME,
  DEVICE_TYPE_TEXT_TOOL_NAME,
} from "@/lib/ai/tools/device-tools"

export const MAX_AGENT_STEPS = 12
export const MAX_AGENT_TOKENS = 150_000

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
    stopWhen: [isStepCount(MAX_AGENT_STEPS), budgetExceeded],
    runtimeContext,
    toolApproval: {
      [DEVICE_TYPE_TEXT_TOOL_NAME]: "user-approval",
      [DEVICE_PRESS_KEY_TOOL_NAME]: "user-approval",
    },
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
