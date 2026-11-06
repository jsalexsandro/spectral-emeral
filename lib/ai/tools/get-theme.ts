import { tool } from "ai"
import { z } from "zod"
import type { Theme, ResolvedTheme } from "@/lib/theme"

export const GET_THEME_TOOL_NAME = "get-theme"

const description = [
  "Consulta o tema atual da aplicação Spectral.",
  "Retorna:",
  "  - `currentTheme`: o tema efetivo aplicado no documento agora (`light`,",
  "    `dark` ou `null` se indisponível). Este é o campo que indica se o app",
  "    está visualmente claro ou escuro — use-o para comparar antes de",
  "    chamar `setTheme`.",
  "  - `preference`: a preferência armazenada no localStorage (`light`,",
  "    `dark` ou `system`).",
  "  - `resolvedTheme`: o tema efetivo aplicado no documento (`light`,",
  "    `dark` ou `null`).",
  "",
  "Use esta tool antes de chamar `runAction` com `setTheme` para evitar",
  "trocar para um tema que já está ativo. Compare o tema pedido com",
  "`currentTheme` (ou `resolvedTheme`), nunca com `preference` quando for",
  "sistema (ex.: preferência `system` com `currentTheme` `dark` significa",
  "que o app está escuro agora).",
  "",
  "O valor reflete o início da requisição atual; se `setTheme` for executado",
  "no mesmo turno, não consulte novamente esperando um valor diferente.",
].join("\n")

export const getThemeTool = tool({
  description,
  inputSchema: z.object({}),
  execute: async (_input, { context }) => {
    const ctx = context as {
      theme?: Theme | null
      resolvedTheme?: ResolvedTheme | null
    } | undefined

    const preference = ctx?.theme ?? null
    const resolvedTheme = ctx?.resolvedTheme ?? null

    // currentTheme é a fonte da verdade: o que está visualmente aplicado.
    // Se resolvedTheme está disponível, usa ele. Senão, se a preferência não
    // é system, usa a própria preferência. Senão, null.
    let currentTheme: ResolvedTheme | null = resolvedTheme
    if (currentTheme === null && preference !== null && preference !== "system") {
      currentTheme = preference
    }

    return { currentTheme, preference, resolvedTheme }
  },
})
