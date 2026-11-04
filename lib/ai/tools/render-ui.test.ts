import { describe, expect, it } from "vitest"
import { renderUiToolInputSchema } from "./render-ui"

const tableProps = {
  columns: ["Name", "Provider", "Input", "Output"],
  rows: [["GPT-OSS 20B", "Groq", 0.075, 0.3]],
}

describe("renderUi tool input", () => {
  it("accepts props as a JSON object", () => {
    const result = renderUiToolInputSchema.safeParse({
      component: "dataTable",
      props: tableProps,
    })

    expect(result.success).toBe(true)
  })

  it("parses props sent as a JSON string", () => {
    const result = renderUiToolInputSchema.safeParse({
      component: "dataTable",
      props: JSON.stringify(tableProps),
    })

    expect(result.success).toBe(true)

    if (result.success) {
      expect(result.data.props).toEqual(tableProps)
    }
  })

  it("parses the whole input sent as a JSON string", () => {
    const result = renderUiToolInputSchema.safeParse(
      JSON.stringify({
        component: "dataTable",
        props: tableProps,
      }),
    )

    expect(result.success).toBe(true)
  })

  it("parses props wrapped in a JSON code fence", () => {
    const result = renderUiToolInputSchema.safeParse({
      component: "dataTable",
      props: "```json\n" + JSON.stringify(tableProps) + "\n```",
    })

    expect(result.success).toBe(true)
  })

  it("rejects malformed stringified props", () => {
    expect(
      renderUiToolInputSchema.safeParse({
        component: "dataTable",
        props: "{",
      }).success,
    ).toBe(false)
  })
})
