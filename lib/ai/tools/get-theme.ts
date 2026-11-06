import { tool } from "ai"
import { z } from "zod"
import type { Theme, ResolvedTheme } from "@/lib/theme"

export const GET_THEME_TOOL_NAME = "get-theme"

const description = [
  "Consulta o tema atual da aplicação Spectral.",
  "Retorna `theme` (preferência armazenada: light, dark ou system) e",
  "`resolvedTheme` (tema efetivo aplicado no documento: light ou dark, ou null se indisponível).",
  "Use esta tool antes de chamar `runAction` com `setTheme` para evitar",
  "trocar para um tema que já está ativo. O valor reflete o início da",
  "requisição atual; se `setTheme` for executado no mesmo turno, não consulte",
  "novamente esperando um valor diferente.",
].join("\n")

export const getThemeTool = tool({
  description,
  inputSchema: z.object({}),
  execute: async (_input, { context }) => {
    const theme = (context as { theme?: Theme } | undefined)?.theme ?? null
    const resolvedTheme =
      (context as { resolvedTheme?: ResolvedTheme | null } | undefined)
        ?.resolvedTheme ?? null

    return { theme, resolvedTheme }
  },
})
