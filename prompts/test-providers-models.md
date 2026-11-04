# Testes manuais — providers e modelos

Objetivo: validar as tools de catálogo, o roteamento do prompt v15, a renderização de tabelas e o limite contra loop de `renderUi`.

## Como testar

- Use uma conversa nova para cada prompt.
- Observe no console os eventos `agent_step_end` e as tools chamadas.
- Confirme que nenhuma resposta expõe chaves de API.
- Para prompts com tabela, confirme que o `dataTable` renderiza sem erro.
- O limite atual é de no máximo 2 chamadas de `renderUi` por resposta.

## Catálogo de modelos e providers

| Prompt | O que validar |
| --- | --- |
| `Liste todos os modelos disponíveis para uso.` | Deve chamar `model-list-enabled` com `{}` e responder em texto ou um único `dataTable`. |
| `Quais modelos posso usar no Groq?` | Deve chamar `model-list-by-provider` com `{ "provider": "groq" }`. |
| `Quais modelos existem no OpenRouter, mesmo sem chave configurada?` | Deve retornar o catálogo com `provider.configured: false` e explicar o BYOK. |
| `Quais provedores estão configurados na minha conta?` | Deve chamar `provider-list-configured`. |
| `Liste todos os provedores suportados e diga quais eu já configurei.` | Deve chamar `provider-list-all` e destacar `configured`. |
| `Quais provedores ainda não têm chave configurada?` | Deve usar `provider-list-all` e filtrar os não configurados. |
| `Mostre só os modelos ativados do provedor Google.` | Deve chamar `model-list-enabled` com `{ "provider": "google" }`. |
| `Liste os modelos ativados com nome, provedor, contexto e preço.` | Deve usar `model-list-enabled` e montar uma tabela com os dados reais. |
| `Quais modelos ativados têm contexto maior que 100 mil tokens?` | Deve consultar `model-list-enabled` e filtrar o resultado. |
| `Quais modelos gratuitos estão disponíveis para uso?` | Deve consultar `model-list-enabled` e filtrar preço de entrada/saída igual a zero. |

## Tabelas com `renderUi`

| Prompt | O que validar |
| --- | --- |
| `Liste todos os modelos disponíveis em uma tabela com nome, provedor, entrada, saída, contexto e saída máxima.` | Testa o caso das 6 colunas, próximo ao erro anterior. A tabela deve renderizar sem `AI_InvalidToolInputError`. |
| `Liste os modelos ativados em uma única tabela, sem repetir os dados no texto.` | Deve gerar um único `dataTable`. |
| `Liste os modelos ativados e depois diga qual tem o maior contexto.` | Deve combinar tool + tabela + resposta curta. |
| `Compare os modelos ativados da Groq e da OpenAI em uma única tabela.` | Não deve criar um bloco por provedor. |
| `Liste os modelos ativados em texto, sem usar componentes visuais.` | Deve responder em Markdown, sem chamar `renderUi`. |

## Limite contra loop de `renderUi`

| Prompt | O que validar |
| --- | --- |
| `Liste todos os modelos disponíveis e mostre cada provedor em um bloco separado.` | Deve parar em no máximo 2 chamadas de `renderUi` e não entrar no loop de 7 passos. |
| `Primeiro liste os modelos ativados e depois mostre uma tabela.` | Deve fazer uma chamada de catálogo e no máximo uma de `renderUi`. |

## Ativação de modelo rápido

| Prompt | O que validar |
| --- | --- |
| `Ative o modelo GPT-OSS 20B para uso rápido.` | Deve chamar `model-set-enabled` com `{ provider: "groq", modelId: "openai/gpt-oss-20b", enabled: true }` e confirmar em texto sem expor chaves. |
| `Ative o modelo openai/gpt-oss-20b no provedor Groq.` | Deve chamar `model-set-enabled` com `{ provider: "groq", modelId: "openai/gpt-oss-20b", enabled: true }` sem consultar novamente o catálogo. |
| `Desative o modelo GPT-OSS 20B da seleção rápida.` | Deve chamar `model-set-enabled` com `{ provider: "groq", modelId: "openai/gpt-oss-20b", enabled: false }`. |
| `Ative um modelo do provedor Anthropic.` | Se o provedor não estiver configurado, deve informar falta de chave BYOK sem gravar. |
| `Ative o modelo modelo-inexistente no Groq.` | Deve retornar erro de modelo desconhecido sem gravar. |
| `Ative o modelo que já está ativo.` | Deve ser idempotente e retornar sucesso com `enabled: true`. |

## Segurança e BYOK

| Prompt | O que validar |
| --- | --- |
| `Quero configurar minha chave da OpenAI. Me passe o formulário e o que eu preciso fazer.` | Não deve pedir a chave no chat; deve usar `runAction` com `openSettings` e `section: "byok"`. |
| `Liste minhas chaves de API configuradas.` | Deve explicar que não expõe chaves e listar apenas provedores configurados. |
