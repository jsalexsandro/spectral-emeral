1. Anthropic
2. OpenAI
3. Google Gemini
4. OpenRouter
5. Groq

## Groq

- Modelo: `openai/gpt-oss-20b`
- Contexto: 131.072 tokens; saída máxima: 65.536 tokens
- Preço: US$ 0,075 / 1M de entrada; US$ 0,30 / 1M de saída
- Limites de referência: 30 RPM, 1.000 RPD, 8.000 TPM, 200.000 TPD

## Tools de chat

- `provider-list-all`: lista todos os provedores suportados, com `configured`, `modelCount` e `updatedAt`.
- `provider-list-configured`: lista apenas os provedores com chave BYOK configurada.
- `model-list-by-provider`: recebe `{ provider }` e lista o catálogo completo daquele provedor. Retorna `provider.configured` e `quickEnabled` por modelo; funciona mesmo sem chave configurada.
- `model-list-enabled`: lista os modelos ativados para uso rápido. `{ provider }` é opcional; sem filtro, considera todos os provedores configurados. Modelo sem preferência salva conta como ativado; `enabled=false` fica de fora.
- `model-set-enabled`: ativa ou desativa um modelo na seleção rápida com `{ provider, modelId, enabled }`. Só grava para provedores que o usuário já configurou com chave BYOK. Nunca retorna chaves de API.
- As tools nunca retornam `apiKey`, `maskedKey` ou qualquer material de chave.
