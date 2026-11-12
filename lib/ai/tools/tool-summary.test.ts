import { describe, expect, it } from "vitest"
import {
  DEVICE_APPLY_PATCH_TOOL_NAME,
  DEVICE_CLICK_TOOL_NAME,
  DEVICE_COPY_TOOL_NAME,
  DEVICE_DELETE_TOOL_NAME,
  DEVICE_DRAG_TOOL_NAME,
  DEVICE_INSPECT_UI_TOOL_NAME,
  DEVICE_LIST_WINDOWS_TOOL_NAME,
  DEVICE_MKDIR_TOOL_NAME,
  DEVICE_MOVE_TOOL_NAME,
  DEVICE_OPEN_APP_TOOL_NAME,
  DEVICE_OPEN_PATH_TOOL_NAME,
  DEVICE_OPEN_URL_TOOL_NAME,
  DEVICE_PRESS_KEY_TOOL_NAME,
  DEVICE_REGISTER_APP_TOOL_NAME,
  DEVICE_REMOVE_APP_TOOL_NAME,
  DEVICE_STAT_TOOL_NAME,
  DEVICE_TYPE_TEXT_TOOL_NAME,
  DEVICE_UI_ACTION_TOOL_NAME,
  DEVICE_WINDOW_ACTION_TOOL_NAME,
} from "./device-tools"
import { summarizeToolInput } from "./tool-summary"

describe("summarizeToolInput", () => {
  it("resume ui-action com a ação e o runtimeId", () => {
    expect(
      summarizeToolInput(DEVICE_UI_ACTION_TOOL_NAME, {
        windowId: "393250",
        runtimeId: "42.393250.4.0.0.656",
        action: "select",
      }),
    ).toBe("select · 42.393250.4.0.0.656")
  })

  it("resume setValue com o texto digitado", () => {
    expect(
      summarizeToolInput(DEVICE_UI_ACTION_TOOL_NAME, {
        windowId: "393250",
        runtimeId: "42.393250.4.0.0.656",
        action: "setValue",
        value: "clima em João Pessoa",
        waitMs: 1500,
      }),
    ).toBe('setValue · 42.393250.4.0.0.656 · "clima em João Pessoa"')
  })

  it("resume inspect-ui com role e janela", () => {
    expect(
      summarizeToolInput(DEVICE_INSPECT_UI_TOOL_NAME, {
        windowId: "393250",
        role: "TabItem",
      }),
    ).toBe("role: TabItem · janela 393250")
  })

  it("mostra a espera do inspect-ui quando waitMs é maior que zero", () => {
    expect(
      summarizeToolInput(DEVICE_INSPECT_UI_TOOL_NAME, {
        windowId: "393250",
        find: "Menu",
        waitMs: 2000,
      }),
    ).toBe('"Menu" · janela 393250 · espera 2000ms')
  })

  it("resume click com coordenadas, botão e repetição", () => {
    expect(
      summarizeToolInput(DEVICE_CLICK_TOOL_NAME, {
        x: 10,
        y: 20,
        button: "left",
        count: 1,
      }),
    ).toBe("10,20")

    expect(
      summarizeToolInput(DEVICE_CLICK_TOOL_NAME, {
        x: 10,
        y: 20,
        button: "right",
        count: 2,
      }),
    ).toBe("10,20 · right · 2x")
  })

  it("resume drag como origem e destino", () => {
    expect(
      summarizeToolInput(DEVICE_DRAG_TOOL_NAME, {
        from: { x: 1, y: 2 },
        to: { x: 30, y: 40 },
      }),
    ).toBe("1,2 → 30,40")
  })

  it("resume tecla com modificadores", () => {
    expect(
      summarizeToolInput(DEVICE_PRESS_KEY_TOOL_NAME, {
        key: "Enter",
        modifiers: ["Ctrl", "Shift"],
      }),
    ).toBe("Enter · Ctrl+Shift")
  })

  it("trunca textos longos", () => {
    const text = "a".repeat(200)
    const summary = summarizeToolInput(DEVICE_TYPE_TEXT_TOOL_NAME, { text })

    expect(summary.startsWith('"')).toBe(true)
    expect(summary.endsWith("…\"")).toBe(true)
    expect(summary.length).toBeLessThan(60)
  })

  it("resume open-url pelo host", () => {
    expect(
      summarizeToolInput(DEVICE_OPEN_URL_TOOL_NAME, {
        url: "https://www.youtube.com/watch?v=abc",
      }),
    ).toBe("www.youtube.com")
  })

  it("resume open-app pelo id ou caminho", () => {
    expect(
      summarizeToolInput(DEVICE_OPEN_APP_TOOL_NAME, { appId: "zed-1a2b3c" }),
    ).toBe("zed-1a2b3c")
    expect(
      summarizeToolInput(DEVICE_OPEN_APP_TOOL_NAME, {
        path: "C:\\Program Files\\Zed\\Zed.exe",
      }),
    ).toBe("C:\\Program Files\\Zed\\Zed.exe")
    expect(
      summarizeToolInput(DEVICE_OPEN_APP_TOOL_NAME, {
        appId: "zed-1a2b3c",
        args: ["projeto"],
        cwd: "C:\\projeto",
      }),
    ).toBe("zed-1a2b3c · args: projeto · cwd: C:\\projeto")
  })

  it("resume open-path pelo caminho", () => {
    expect(
      summarizeToolInput(DEVICE_OPEN_PATH_TOOL_NAME, {
        path: "C:\\Users\\eujos\\relatorio.pdf",
      }),
    ).toBe("C:\\Users\\eujos\\relatorio.pdf")
  })

  it("resume register-app com nome, caminho e cwd", () => {
    expect(
      summarizeToolInput(DEVICE_REGISTER_APP_TOOL_NAME, {
        name: "Zed",
        path: "C:\\Programas\\Zed\\Zed.exe",
        cwd: "C:\\projeto",
      }),
    ).toBe('"Zed" · → C:\\Programas\\Zed\\Zed.exe · cwd: C:\\projeto')
  })

  it("resume remove-app pelo id", () => {
    expect(
      summarizeToolInput(DEVICE_REMOVE_APP_TOOL_NAME, { appId: "zed-1a2b3c" }),
    ).toBe("remover zed-1a2b3c")
  })

  it("resume find-app com a busca", () => {
    expect(summarizeToolInput("device-find-app", { query: "Zed" })).toBe('"Zed"')
    expect(
      summarizeToolInput("device-find-app", { query: "Zed", refresh: true }),
    ).toBe('"Zed" · atualizado')
  })

  it("resume window-action com ação e janela", () => {
    expect(
      summarizeToolInput(DEVICE_WINDOW_ACTION_TOOL_NAME, {
        windowId: "393250",
        action: "minimize",
      }),
    ).toBe("minimize · janela 393250")
  })

  it("descreve list-windows sem argumentos", () => {
    expect(summarizeToolInput(DEVICE_LIST_WINDOWS_TOOL_NAME, {})).toBe(
      "visíveis",
    )
    expect(
      summarizeToolInput(DEVICE_LIST_WINDOWS_TOOL_NAME, {
        includeMinimized: true,
      }),
    ).toBe("inclui minimizadas")
  })

  it("cai no resumo genérico para tools desconhecidas", () => {
    expect(summarizeToolInput("tool-qualquer", { foo: "bar" })).toBe("foo=bar")
  })

  it("resume mkdir, stat e delete", () => {
    expect(
      summarizeToolInput(DEVICE_MKDIR_TOOL_NAME, { path: "~/projetos/novo" }),
    ).toBe("~/projetos/novo")
    expect(
      summarizeToolInput(DEVICE_STAT_TOOL_NAME, { path: "~/a.txt" }),
    ).toBe("~/a.txt")
    expect(
      summarizeToolInput(DEVICE_DELETE_TOOL_NAME, {
        path: "~/a.txt",
        permanent: true,
        recursive: false,
      }),
    ).toBe("~/a.txt · permanente")
  })

  it("resume copy e move como origem e destino", () => {
    expect(
      summarizeToolInput(DEVICE_COPY_TOOL_NAME, {
        from: "~/a.txt",
        to: "~/b.txt",
      }),
    ).toBe("~/a.txt → ~/b.txt")
    expect(
      summarizeToolInput(DEVICE_MOVE_TOOL_NAME, {
        from: "~/b.txt",
        to: "~/c.txt",
      }),
    ).toBe("~/b.txt → ~/c.txt")
  })

  it("resume apply-patch com a contagem de patches", () => {
    expect(
      summarizeToolInput(DEVICE_APPLY_PATCH_TOOL_NAME, {
        path: "~/a.ts",
        patches: [{ oldText: "a", newText: "b" }],
      }),
    ).toBe("~/a.ts · 1 patch")
  })

  it("retorna vazio quando não há argumentos", () => {
    expect(summarizeToolInput(DEVICE_UI_ACTION_TOOL_NAME, undefined)).toBe("")
    expect(summarizeToolInput(DEVICE_UI_ACTION_TOOL_NAME, null)).toBe("")
    expect(summarizeToolInput(DEVICE_UI_ACTION_TOOL_NAME, "texto")).toBe("")
  })
})
