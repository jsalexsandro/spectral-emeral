bug 1: janelas duplicadas em device-list-windows ✅ RESOLVIDO
Sintoma: `device-list-windows` retornava janelas repetidas (ex.: 8 janelas com
duplicatas), fazendo o modelo achar que havia mais janelas abertas do que o
real.
Causa: erro de formatação da resposta do modelo, não do driver; o driver já
retorna janelas únicas (dedupe por `id` em `listPlatformWindows`).
Evidência (validação ao vivo 2026-11-15): `device-list-windows` retornou 8
janelas únicas, com `focused`/`minimizado` corretos, sem `device_offline`.

bug 2: janelas minimizadas ✅ RESOLVIDO
`device-list-windows` aceita `includeMinimized` e lista janelas minimizadas
quando solicitado.

Legenda de uso: `windowId` retornado por `device-list-windows` identifica cada
janela para `device-focus-window` e `device-window-action`.