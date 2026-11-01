passo 5
tools e system prompt
agentic loop

ui generative
ex: quero adicionar um novo modelo, ai com ui generativa ele vai abrir um tela para vc escolher o modelo, caso eu passo o model ele nem abre a janela, faz direto.

ex: quero configurar um novo provedor, ele vai abrir um tela pra você colocar o provedor, ai depois abre mais uma pedindo a key. ele salva e da um feedback

ui generativa

tools de estados(state - tools)
permitir buttons acessar tools, seja ela estado, fecth

existe tools internas e externas

criaremos uma tools que ira controlar estados.

  clicou em um botão o update do estado acontece

de acordo com x estado a ui-generativa muda!

toast da ui extern
--

começar a definir como  a IA vai controlar ferramentas internas como: mude o tema para claro, e ela muda
ex: mudar tema
mudar as preferencias do sistema: "Quero que minhas respostas sejam mais curtas."
adicionar novo provedor: ei adicionar a antropich com essa chave "xddd-fgf-h-h-g"

entre outros

(ela usou poder interno para todos)

definir a UI generariva, components basicos que a IA poderá usar pra agregar, sendo internos no chat e externos



----

Recursive reference detected at #/anyOf/6/properties/props/properties/children/items/anyOf/3/properties/children/items! Defaulting to any
Error [AI_APICallError]: Request contains an invalid argument.
    at ignore-listed frames {
  cause: undefined,
  url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:streamGenerateContent?alt=sse',
  requestBodyValues: {
    generationConfig: {
      maxOutputTokens: undefined,
      temperature: undefined,
      topK: undefined,
      topP: undefined,
      frequencyPenalty: undefined,
      presencePenalty: undefined,
      stopSequences: undefined,
      seed: undefined,
      responseMimeType: undefined,
      responseJsonSchema: undefined,
      responseModalities: undefined,
      thinkingConfig: undefined
    },
    contents: [
      [Object], [Object],
      [Object], [Object],
      [Object], [Object],
      [Object], [Object],
      [Object], [Object],
      [Object], [Object],
      [Object]
    ],
    systemInstruction: { parts: [Array] },
    safetySettings: undefined,
    tools: [ [Object] ],
    toolConfig: { functionCallingConfig: [Object] },
    cachedContent: undefined,
    labels: undefined,
    serviceTier: undefined
  },
  statusCode: 400,
  responseHeaders: {
    'alt-svc': 'h3=":443"; ma=2592000,h3-29=":443"; ma=2592000',
    'content-length': '127',
    'content-type': 'text/event-stream',
    date: 'Fri, 30 Oct 2026 19:32:53 GMT',
    server: 'scaffolding on HTTPServer2',
    'server-timing': 'gfet4t7; dur=2238',
    vary: 'Origin, X-Origin, Referer',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'SAMEORIGIN',
    'x-xss-protection': '0'
  },
  responseBody: '{\n' +
    '  "error": {\n' +
    '    "code": 400,\n' +
    '    "message": "Request contains an invalid argument.",\n' +
    '    "status": "INVALID_ARGUMENT"\n' +
    '  }\n' +
    '}\n',
  isRetryable: false,
  data: {
    error: {
      code: 400,
      message: 'Request contains an invalid argument.',
      status: 'INVALID_ARGUMENT'
    }
  }
}
 POST /api/chat 200 in 7.8s (next.js: 8ms, application-code: 7.7s)
 GET /api/chats 200 in 433ms (next.js: 3ms, application-code: 430ms)
agent_end {
  chatId: '781584da-2363-46b6-b043-d108160f5e97',
  steps: 2,
  aborted: false,
  outcome: 'failed'
}

Recursive reference detected at #/anyOf/6/properties/props/properties/children/items/anyOf/3/properties/children/items! Defaulting to any
Recursive reference detected at #/anyOf/6/properties/props/properties/children/items/anyOf/3/properties/children/items! Defaulting to any
agent_step_end {
  chatId: '781584da-2363-46b6-b043-d108160f5e97',
  step: 1,
  finishReason: 'tool-calls',
  inputTokens: 8343,
  outputTokens: 1013,
  toolCalls: [ 'renderUi' ]
}
Recursive reference detected at #/anyOf/6/properties/props/properties/children/items/anyOf/3/properties/children/items! Defaulting to any
Recursive reference detected at #/anyOf/6/properties/props/properties/children/items/anyOf/3/properties/children/items! Defaulting to any
 GET /api/auth/session 200 in 33ms (next.js: 14ms, application-code: 19ms)
 GET /api/auth/session 200 in 14ms (next.js: 3ms, application-code: 11ms)
agent_step_end {
  chatId: '781584da-2363-46b6-b043-d108160f5e97',
  step: 2,
  finishReason: 'tool-calls',
  inputTokens: 9676,
  outputTokens: 978,
  toolCalls: [ 'renderUi' ]
}
Recursive reference detected at #/anyOf/6/properties/props/properties/children/items/anyOf/3/properties/children/items! Defaulting to any
Recursive reference detected at #/anyOf/6/properties/props/properties/children/items/anyOf/3/properties/children/items! Defaulting to any
agent_step_end {
  chatId: '781584da-2363-46b6-b043-d108160f5e97',
  step: 3,
  finishReason: 'tool-calls',
  inputTokens: 10974,
  outputTokens: 742,
  toolCalls: [ 'renderUi' ]
}
Recursive reference detected at #/anyOf/6/properties/props/properties/children/items/anyOf/3/properties/children/items! Defaulting to any
Recursive reference detected at #/anyOf/6/properties/props/properties/children/items/anyOf/3/properties/children/items! Defaulting to any
agent_step_end {
  chatId: '781584da-2363-46b6-b043-d108160f5e97',
  step: 4,
  finishReason: 'tool-calls',
  inputTokens: 12036,
  outputTokens: 773,
  toolCalls: [ 'renderUi' ]
}
Recursive reference detected at #/anyOf/6/properties/props/properties/children/items/anyOf/3/properties/children/items! Defaulting to any
Recursive reference detected at #/anyOf/6/properties/props/properties/children/items/anyOf/3/properties/children/items! Defaulting to any
agent_step_end {
  chatId: '781584da-2363-46b6-b043-d108160f5e97',
  step: 5,
  finishReason: 'tool-calls',
  inputTokens: 13102,
  outputTokens: 738,
  toolCalls: [ 'renderUi' ]
}
Recursive reference detected at #/anyOf/6/properties/props/properties/children/items/anyOf/3/properties/children/items! Defaulting to any
Recursive reference detected at #/anyOf/6/properties/props/properties/children/items/anyOf/3/properties/children/items! Defaulting to any
agent_step_end {
  


  ---
bug
  agent_step_end {
    chatId: '1c54b77d-6e07-4fe9-a2e0-44c6f0cd70fd',
    step: 1,
    finishReason: 'tool-calls',
    inputTokens: 6152,
    outputTokens: 3795,
    toolCalls: [ 'renderUi' ]
  }    