import { describe, expect, it } from "vitest"
import { updatePlanTool } from "@/lib/ai/tools/update-plan"

describe("updatePlan tool", () => {
  it("aceita plano válido com uma etapa current", async () => {
    const result = await updatePlanTool.execute!(
      {
        title: "Plano de teste",
        steps: [
          { title: "Etapa 1", status: "current" },
          { title: "Etapa 2", status: "pending" },
        ],
      },
      { toolCallId: "test-1", messages: [], context: {} },
    )

    expect((result as { ok: boolean }).ok).toBe(true)
    expect((result as { steps: unknown[] }).steps).toHaveLength(2)
  })

  it("rejeita mais de uma etapa current", async () => {
    const result = await updatePlanTool.execute!(
      {
        title: "Plano inválido",
        steps: [
          { title: "Etapa 1", status: "current" },
          { title: "Etapa 2", status: "current" },
        ],
      },
      { toolCallId: "test-2", messages: [], context: {} },
    )

    expect((result as { ok: boolean }).ok).toBe(false)
    expect((result as { error: string }).error).toContain(
      "Somente uma etapa pode ter status",
    )
  })

  it("aceita etapa failed sem pendentes após", async () => {
    const result = await updatePlanTool.execute!(
      {
        title: "Plano com falha",
        steps: [{ title: "Etapa 1", status: "failed" }],
      },
      { toolCallId: "test-3", messages: [], context: {} },
    )

    expect((result as { ok: boolean }).ok).toBe(true)
  })

  it("rejeita pending após failed sem replanejamento", async () => {
    const result = await updatePlanTool.execute!(
      {
        title: "Plano inválido após falha",
        steps: [
          { title: "Etapa 1", status: "failed" },
          { title: "Etapa 2", status: "pending" },
          { title: "Etapa 3", status: "pending" },
        ],
      },
      { toolCallId: "test-4", messages: [], context: {} },
    )

    expect((result as { ok: boolean }).ok).toBe(false)
    expect((result as { error: string }).error).toContain(
      "Após uma etapa `failed`, replaneje",
    )
  })
})
