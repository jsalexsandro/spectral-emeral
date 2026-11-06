import type { ProviderId } from "../providers"
import type { Theme, ResolvedTheme } from "@/lib/theme"

export type PromptUser = {
  name?: string | null
  nickname?: string | null
}

export type PromptModel = {
  provider: ProviderId
  modelId: string
}

export type PromptContext = {
  user?: PromptUser
  locale?: string
  now?: Date
  model?: PromptModel
  theme?: Theme | null
  resolvedTheme?: ResolvedTheme | null
}

export type PromptSection = {
  id: string
  render: (context: PromptContext) => string | null
}
