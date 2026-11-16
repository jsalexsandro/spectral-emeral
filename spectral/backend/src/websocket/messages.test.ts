import { describe, expect, it } from "vitest"
import { commandResultMessageSchema } from "./messages.js"

const element = {
  runtimeId: "42.393250.4.0.0.656",
  name: "Fechar",
  role: "Button",
  value: null,
  bounds: { x: 10, y: 20, width: 30, height: 30 },
  center: { x: 25, y: 35 },
  enabled: true,
  focused: false,
  selected: null,
  expanded: null,
  offscreen: false,
  actionable: true,
  actions: ["invoke", "focus"],
  automationId: "close-tab",
  path: [{ name: "Guia", role: "TabItem" }],
}

function parseResult(result: unknown) {
  return commandResultMessageSchema.safeParse({
    type: "device:command:result",
    id: "command-1",
    result,
  })
}

describe("commandResultMessageSchema", () => {
  it("preserva o resultado de inspect-ui", () => {
    const parsed = parseResult({
      ok: true,
      ui: {
        windowId: "393250",
        windowTitle: "Chrome",
        elements: [element],
        scanned: 12,
        waitedMs: 0,
        truncated: false,
      },
    })

    expect(parsed.success).toBe(true)

    if (!parsed.success || !parsed.data.result.ok) {
      throw new Error("Esperava um resultado ok.")
    }

    expect(parsed.data.result.ui?.elements[0]?.runtimeId).toBe(
      "42.393250.4.0.0.656",
    )
    expect(parsed.data.result.ui?.elements[0]?.actions).toEqual([
      "invoke",
      "focus",
    ])
  })

  it("preserva o resultado de ui-action", () => {
    const parsed = parseResult({
      ok: true,
      uiAction: {
        windowId: "393250",
        action: "select",
        element: { ...element, role: "TabItem", selected: true },
        waitedMs: 0,
        hint: "Elemento selecionável: use a ação select.",
      },
    })

    expect(parsed.success).toBe(true)

    if (!parsed.success || !parsed.data.result.ok) {
      throw new Error("Esperava um resultado ok.")
    }

    expect(parsed.data.result.uiAction?.action).toBe("select")
    expect(parsed.data.result.uiAction?.element.selected).toBe(true)
    expect(parsed.data.result.uiAction?.waitedMs).toBe(0)
    expect(parsed.data.result.uiAction?.hint).toBe(
      "Elemento selecionável: use a ação select.",
    )
  })

  it("preserva a espera da inspeção e rejeita waitedMs negativo", () => {
    const parsed = parseResult({
      ok: true,
      ui: {
        windowId: "393250",
        windowTitle: "Chrome",
        elements: [element],
        scanned: 12,
        waitedMs: 640,
        truncated: false,
      },
    })

    expect(parsed.success).toBe(true)

    if (!parsed.success || !parsed.data.result.ok) {
      throw new Error("Esperava um resultado ok.")
    }

    expect(parsed.data.result.ui?.waitedMs).toBe(640)

    expect(
      parseResult({
        ok: true,
        ui: {
          windowId: "393250",
          windowTitle: "Chrome",
          elements: [element],
          scanned: 12,
          waitedMs: -1,
          truncated: false,
        },
      }).success,
    ).toBe(false)
  })

  it("rejeita runtimeId malformado", () => {
    const parsed = parseResult({
      ok: true,
      ui: {
        windowId: "393250",
        windowTitle: "Chrome",
        elements: [{ ...element, runtimeId: "42; rm -rf /" }],
        scanned: 1,
        waitedMs: 0,
        truncated: false,
      },
    })

    expect(parsed.success).toBe(false)
  })

  it("preserva a descoberta de apps e o resultado de find-app", () => {
    const parsed = parseResult({
      ok: true,
      query: "Zed",
      found: true,
      apps: [
        {
          id: "zed-1a2b3c",
          name: "Zed",
          source: "start-menu",
          target: "C:\\Users\\ana\\AppData\\Local\\Programs\\Zed\\Zed.exe",
        },
      ],
    })

    expect(parsed.success).toBe(true)

    if (!parsed.success || !parsed.data.result.ok) {
      throw new Error("Esperava um resultado ok.")
    }

    expect(parsed.data.result.found).toBe(true)
    expect(parsed.data.result.query).toBe("Zed")
    expect(parsed.data.result.apps?.[0]?.source).toBe("start-menu")
    expect(parsed.data.result.apps?.[0]?.target).toContain("Zed.exe")
  })

  it("rejeita origem de app desconhecida", () => {
    const parsed = parseResult({
      ok: true,
      apps: [{ id: "zed", name: "Zed", source: "inventado" }],
    })

    expect(parsed.success).toBe(false)
  })

  it("preserva os resultados das operações de arquivo", () => {
    const parsed = parseResult({
      ok: true,
      mkdir: { path: "C:\\Users\\ana\\projeto", created: true },
      stat: {
        path: "C:\\Users\\ana\\projeto",
        type: "directory",
        size: null,
        modifiedAt: "2026-11-11T12:00:00.000Z",
        createdAt: "2026-11-11T12:00:00.000Z",
        mode: 16_822,
        isSymlink: false,
        linkTarget: null,
      },
      copy: { from: "C:\\a.txt", to: "C:\\b.txt", files: 1, bytes: 10 },
      move: { from: "C:\\b.txt", to: "C:\\c.txt" },
      delete: { path: "C:\\c.txt", deleted: true, toTrash: true },
      patch: { path: "C:\\d.txt", applied: 2, replacements: 2 },
    })

    expect(parsed.success).toBe(true)

    if (!parsed.success || !parsed.data.result.ok) {
      throw new Error("Esperava um resultado ok.")
    }

    expect(parsed.data.result.mkdir?.created).toBe(true)
    expect(parsed.data.result.stat?.type).toBe("directory")
    expect(parsed.data.result.copy?.bytes).toBe(10)
    expect(parsed.data.result.move?.to).toBe("C:\\c.txt")
    expect(parsed.data.result.delete?.toTrash).toBe(true)
    expect(parsed.data.result.patch?.replacements).toBe(2)
  })

  it("preserva o resultado de setup-toolchain", () => {
    const parsed = parseResult({
      ok: true,
      toolchain: {
        id: "uv",
        name: "uv",
        packageId: "astral-sh.uv",
        action: "install",
        version: null,
        jobId: "job-1",
      },
      job: {
        id: "job-1",
        label: "winget: uv",
        status: "running",
        shell: "powershell",
        shellPath: "powershell.exe",
        cwd: "C:\\",
        startedAt: "2026-11-16T12:00:00.000Z",
        durationMs: 0,
        exitCode: null,
        error: null,
        stdoutBytes: 0,
        stderrBytes: 0,
        outputChars: 0,
        truncated: false,
        timedOut: false,
        cancelled: false,
      },
    })

    expect(parsed.success).toBe(true)

    if (!parsed.success || !parsed.data.result.ok) {
      throw new Error("Esperava um resultado ok.")
    }

    expect(parsed.data.result.toolchain?.id).toBe("uv")
    expect(parsed.data.result.toolchain?.packageId).toBe("astral-sh.uv")
    expect(parsed.data.result.toolchain?.action).toBe("install")
    expect(parsed.data.result.toolchain?.jobId).toBe("job-1")
    expect(parsed.data.result.job?.id).toBe("job-1")
  })

  it("aceita toolchain fora do catálogo (packageId livre)", () => {
    const parsed = parseResult({
      ok: true,
      toolchain: {
        id: "7zip.7zip",
        name: "7zip.7zip",
        packageId: "7zip.7zip",
        action: "install",
        version: null,
        jobId: "job-9",
      },
      job: {
        id: "job-9",
        label: "winget: 7zip.7zip",
        status: "running",
        shell: "powershell",
        shellPath: "powershell.exe",
        cwd: "C:\\",
        startedAt: "2026-11-16T12:00:00.000Z",
        durationMs: 0,
        exitCode: null,
        error: null,
        stdoutBytes: 0,
        stderrBytes: 0,
        outputChars: 0,
        truncated: false,
        timedOut: false,
        cancelled: false,
      },
    })

    expect(parsed.success).toBe(true)

    if (!parsed.success || !parsed.data.result.ok) {
      throw new Error("Esperava um resultado ok.")
    }

    expect(parsed.data.result.toolchain?.id).toBe("7zip.7zip")
    expect(parsed.data.result.toolchain?.packageId).toBe("7zip.7zip")
    expect(parsed.data.result.toolchain?.action).toBe("install")
    expect(parsed.data.result.toolchain?.jobId).toBe("job-9")
    expect(parsed.data.result.job?.id).toBe("job-9")
  })
})
