import postgres from "postgres"
import { readUIMessageStream, streamText, toUIMessageStream, isStepCount, type UIMessage } from "ai"
import { resolveChatModel } from "./lib/ai/chat-model"
import { buildSystemPrompt } from "./lib/ai/prompts"
import { getChatTools } from "./lib/ai/tools"
import type { ProviderId } from "./lib/ai/providers"

async function main() {
  const u = new URL(process.env.DATABASE_URL!)
  const sql = postgres({ host: u.hostname, port: Number(u.port), database: u.pathname.slice(1), username: u.username, password: decodeURIComponent(u.password), ssl: "require", max: 1 })
  const [chat] = await sql`select c.id, c."userId", c.provider, c.model, u.name, u.nickname from "Chat" c join "user" u on u.id = c."userId" order by c."updatedAt" desc limit 1`
  console.log("chat", chat.id, chat.provider, chat.model, chat.userId)
  const resolved = await resolveChatModel(chat.userId, chat.provider as ProviderId, chat.model)
  if (!resolved.ok) { console.log("resolve failed", resolved); process.exit(1) }
  const messages: UIMessage[] = [{ id: "u1", role: "user", parts: [{ type: "text", text: "crie um aviso de sucesso dizendo que deu certo" }] }]
  const systemPrompt = buildSystemPrompt({ user: { name: chat.name, nickname: chat.nickname }, now: new Date(), model: { provider: chat.provider, modelId: chat.model } })
  const result = streamText({ model: resolved.model, system: systemPrompt.prompt, tools: getChatTools({ userId: chat.userId }), stopWhen: isStepCount(4), messages: [{ role: "user", content: "crie um aviso de sucesso dizendo que deu certo" }] })
  const stream = toUIMessageStream({ stream: result.stream, originalMessages: messages })
  let last: UIMessage | undefined
  for await (const message of readUIMessageStream({ stream })) last = message
  console.log(JSON.stringify(last?.parts, null, 2))
  await sql.end()
}
void main()
