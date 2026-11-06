import { tool } from "ai"
import {
  UPDATE_PLAN_TOOL_NAME,
  updatePlanInputSchema,
  type UpdatePlanInput,
} from "@/lib/ai/plan"

export { UPDATE_PLAN_TOOL_NAME }

function validatePlan(input: UpdatePlanInput): string[] {
  const errors: string[] = []

  const currentCount = input.steps.filter(
    (step) => step.status === "current",
  ).length

  if (currentCount > 1) {
    errors.push(
      "Somente uma etapa pode ter status `current` por vez.",
    )
  }

  // Depois de uma etapa `failed`, não deve haver etapa `pending` sem uma `current` anterior.
  // Isso força o modelo a replanear antes de seguir adiante.
  let seenFailed = false
  for (const step of input.steps) {
    if (step.status === "failed") {
      seenFailed = true
      continue
    }
    if (seenFailed && step.status === "pending") {
      errors.push(
        "Após uma etapa `failed`, replaneje antes de deixar etapas `pending`.",
      )
      break
    }
  }

  return errors
}

export const updatePlanTool = tool({
  description:
    "Cria ou atualiza o plano de execução exibido ao usuário. Use no início de tarefas com múltiplos passos e atualize sempre que concluir uma etapa ou mudar o caminho. Mantenha no máximo uma etapa com status `current`. Não use para perguntas simples ou respostas de um único passo. Se uma etapa falhar, marque-a como `failed` e replaneje antes de continuar.",
  inputSchema: updatePlanInputSchema,
  execute: async ({ title, steps }) => {
    const validationErrors = validatePlan({ title, steps })

    if (validationErrors.length > 0) {
      return {
        ok: false as const,
        error: validationErrors.join(" "),
        title: title ?? "Plano",
        steps,
      }
    }

    return {
      ok: true as const,
      title: title ?? "Plano",
      steps,
    }
  },
})
