export type ProviderId =
  | "openai"
  | "anthropic"
  | "google"
  | "openrouter"
  | "groq"

export type AIProvider = {
  id: ProviderId
  name: string
  description: string
  docsUrl: string
  placeholder: string
}

export type ByokProvider = AIProvider & {
  configured: boolean
  maskedKey: string | null
  updatedAt: string | null
}

export const aiProviders = [
  {
    id: "openai",
    name: "OpenAI",
    description: "Modelos GPT e o-series da OpenAI.",
    docsUrl: "https://platform.openai.com/api-keys",
    placeholder: "sk-...",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    description: "Modelos Claude da Anthropic.",
    docsUrl: "https://console.anthropic.com/settings/keys",
    placeholder: "sk-ant-...",
  },
  {
    id: "google",
    name: "Google Gemini",
    description: "Modelos Gemini do Google AI Studio.",
    docsUrl: "https://aistudio.google.com/app/apikey",
    placeholder: "AIza...",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    description: "Acesso unificado a modelos de diversos provedores.",
    docsUrl: "https://openrouter.ai/keys",
    placeholder: "sk-or-...",
  },
  {
    id: "groq",
    name: "Groq",
    description: "Modelos abertos de alta velocidade, como o GPT-OSS 20B.",
    docsUrl: "https://console.groq.com/keys",
    placeholder: "gsk_...",
  },
] as const satisfies readonly AIProvider[]

export function isProviderId(value: string): value is ProviderId {
  return aiProviders.some((provider) => provider.id === value)
}
