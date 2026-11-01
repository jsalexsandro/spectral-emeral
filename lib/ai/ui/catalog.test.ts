import { describe, expect, it } from "vitest"
import {
  UI_CATALOG_VERSION,
  normalizeRenderUiOutput,
  renderUiHistorySchema,
  renderUiInputSchema,
  renderUiOutputSchema,
} from "./catalog"

const panelWithButton = {
  component: "panel" as const,
  props: {
    title: "Ações",
    children: [
      {
        type: "button" as const,
        label: "Abrir configurações",
        action: { type: "openSettings" as const, section: "byok" as const },
      },
    ],
  },
}

describe("generative UI catalog", () => {
  it("uses version 2", () => {
    expect(UI_CATALOG_VERSION).toBe(2)
  })

  it("accepts panel with structured actions in the tool input", () => {
    expect(renderUiInputSchema.safeParse(panelWithButton).success).toBe(true)
  })

  it("rejects the legacy chatUi component in new tool input", () => {
    expect(
      renderUiInputSchema.safeParse({
        component: "chatUi",
        props: { children: [{ type: "text", value: "oi" }] },
      }).success,
    ).toBe(false)
  })

  it("accepts legacy chatUi in history", () => {
    expect(
      renderUiHistorySchema.safeParse({
        component: "chatUi",
        props: {
          children: [
            {
              type: "button",
              label: "Confirmar",
              action: "confirm",
            },
          ],
        },
      }).success,
    ).toBe(true)
  })

  it("rejects more than two div levels", () => {
    expect(
      renderUiInputSchema.safeParse({
        component: "panel",
        props: {
          children: [
            {
              type: "div",
              children: [
                {
                  type: "div",
                  children: [
                    {
                      type: "div",
                      children: [{ type: "text", value: "fundo demais" }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      }).success,
    ).toBe(false)
  })

  it("requires a uiVersion in output payloads", () => {
    expect(
      renderUiOutputSchema.safeParse({
        component: "panel",
        props: panelWithButton.props,
      }).success,
    ).toBe(false)

    expect(
      renderUiOutputSchema.safeParse({
        component: "panel",
        props: panelWithButton.props,
        uiVersion: 2,
      }).success,
    ).toBe(true)
  })

  it("normalizes legacy chatUi and string actions to sendMessage", () => {
    const parsed = renderUiOutputSchema.parse({
      component: "chatUi",
      props: {
        children: [
          {
            type: "div",
            children: [
              { type: "text", value: "Continuar?" },
              {
                type: "button",
                label: "Confirmar",
                action: "confirm",
              },
            ],
          },
        ],
      },
      uiVersion: 1,
    })

    const normalized = normalizeRenderUiOutput(parsed)

    expect(normalized.component).toBe("panel")

    if (normalized.component !== "panel") {
      return
    }

    const div = normalized.props.children[0]

    expect(div.type).toBe("div")

    if (div.type !== "div") {
      return
    }

    expect(div.children[1]).toEqual({
      type: "button",
      label: "Confirmar",
      action: { type: "sendMessage", text: "Confirmar" },
    })
  })

  it("preserves structured actions in legacy history", () => {
    const parsed = renderUiOutputSchema.parse({
      component: "chatUi",
      props: {
        children: [
          {
            type: "button",
            label: "Tema escuro",
            action: { type: "setTheme", theme: "dark" },
          },
        ],
      },
      uiVersion: 1,
    })

    const normalized = normalizeRenderUiOutput(parsed)

    expect(normalized).toEqual({
      component: "panel",
      props: {
        children: [
          {
            type: "button",
            label: "Tema escuro",
            action: { type: "setTheme", theme: "dark" },
          },
        ],
      },
    })
  })
})
