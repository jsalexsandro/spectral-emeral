import { MockLanguageModelV4 } from "ai/test"
import { describe, expect, it, vi } from "vitest"
import {
  MAX_AGENT_OUTPUT_TOKENS,
  MAX_AGENT_STEPS,
  WRAP_UP_INSTRUCTION,
  createSpectralAgent,
} from "./spectral-agent"

vi.mock("@/lib/ai/tools", async () => {
  const { tool } = await import("ai")
  const { z } = await import("zod")

  return {
    getChatTools: () => ({
      ping: tool({
        description: "ping",
        inputSchema: z.object({}),
        execute: async () => ({ ok: true }),
      }),
    }),
  }
})

const usage = (outputTokens = 10) => ({
  inputTokens: {
    total: 1_000,
    noCache: 1_000,
    cacheRead: 0,
    cacheWrite: 0,
  },
  outputTokens: {
    total: outputTokens,
    text: outputTokens,
    reasoning: 0,
  },
})

const toolCallStep = (index: number, outputTokens = 10) => ({
  content: [
    {
      type: "tool-call" as const,
      toolCallId: `call-${index}`,
      toolName: "ping",
      input: "{}",
    },
  ],
  finishReason: { unified: "tool-calls" as const, raw: "tool_calls" },
  usage: usage(outputTokens),
  warnings: [],
})

const textStep = (text: string) => ({
  content: [{ type: "text" as const, text }],
  finishReason: { unified: "stop" as const, raw: "stop" },
  usage: usage(),
  warnings: [],
})

function createAgent(results: unknown[]) {
  const model = new MockLanguageModelV4({
    doGenerate: results as never,
  })

  const agent = createSpectralAgent({
    model,
    instructions: "instruções do sistema",
    runtimeContext: {
      userId: "user-1",
      chatId: "chat-1",
      startedAt: Date.now(),
      executionMode: "ask",
    },
  })

  return { agent, model }
}

describe("agent loop budget", () => {
  it("reserves a final text step instead of stopping with an empty reply", async () => {
    const results = [
      ...Array.from({ length: MAX_AGENT_STEPS - 1 }, (_, index) =>
        toolCallStep(index),
      ),
      textStep("Concluído: a tarefa terminou."),
    ]

    const { agent, model } = createAgent(results)
    const result = await agent.generate({ prompt: "faça a tarefa" })

    expect(result.text).toBe("Concluído: a tarefa terminou.")
    expect(result.steps).toHaveLength(MAX_AGENT_STEPS)

    // A última chamada ao modelo acontece sem ferramentas e com a instrução
    // de encerramento, que é o que garante uma resposta em texto.
    const wrapUpCall = model.doGenerateCalls[MAX_AGENT_STEPS - 1]

    expect(wrapUpCall.tools ?? []).toHaveLength(0)
    expect(JSON.stringify(wrapUpCall.prompt)).toContain(WRAP_UP_INSTRUCTION)
  })

  it("wraps up when the accumulated output budget is spent", async () => {
    const { agent } = createAgent([
      toolCallStep(0, MAX_AGENT_OUTPUT_TOKENS),
      textStep("Resumo do que já foi feito."),
    ])

    const result = await agent.generate({ prompt: "faça a tarefa" })

    expect(result.text).toBe("Resumo do que já foi feito.")
    expect(result.steps).toHaveLength(2)
  })
})
