import { asSchema } from "ai"
import { describe, expect, it } from "vitest"
import { getChatTools } from "@/lib/ai/tools"
import { runActionTool } from "@/lib/ai/tools/run-action"

function collectForbiddenKeys(
  value: unknown,
  path = "$",
  found: string[] = [],
): string[] {
  if (!value || typeof value !== "object") {
    return found
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectForbiddenKeys(item, `${path}[${index}]`, found)
    })
    return found
  }

  for (const [key, child] of Object.entries(value)) {
    if (key === "$ref" || key === "$defs" || key === "definitions") {
      found.push(`${path}.${key}`)
    }

    collectForbiddenKeys(child, `${path}.${key}`, found)
  }

  return found
}

describe("chat tool schemas", () => {
  it("does not emit refs in the JSON schema sent to providers", async () => {
    const tools = getChatTools({ userId: "test-user" })

    for (const [name, chatTool] of Object.entries(tools)) {
      const schema = await asSchema(chatTool.inputSchema).jsonSchema
      const forbidden = collectForbiddenKeys(schema)

      expect(forbidden, `tool ${name} emitted ${forbidden.join(", ")}`).toEqual(
        [],
      )
    }
  })

  it("exposes runAction as a server-acknowledged command", async () => {
    expect(typeof runActionTool.execute).toBe("function")

    const result = await runActionTool.execute!(
      { type: "setTheme", theme: "dark" },
      { toolCallId: "test", messages: [], context: {} },
    )

    expect(result).toEqual({
      ok: true,
      action: { type: "setTheme", theme: "dark" },
    })
  })
})
