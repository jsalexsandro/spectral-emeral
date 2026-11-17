import { describe, expect, it } from "vitest"
import { resolveSnippetInvocation, runSnippet } from "./snippet.js"

function snippetOf(result: unknown): {
  exitCode: number | null
  stdout: string
  stderr: string
  command?: string
  durationMs: number
} {
  return (result as { snippet: { exitCode: number | null; stdout: string; stderr: string; command?: string; durationMs: number } }).snippet
}

describe("resolveSnippetInvocation", () => {
  it("node → comando node, extensão .js, script, catálogo node", () => {
    const inv = resolveSnippetInvocation("node")

    expect(inv.mode).toBe("script")
    expect(inv.command).toBe("node")
    expect(inv.extension).toBe(".js")
    if (inv.mode === "script") {
      expect(inv.args).toEqual([])
    }
    expect(inv.toolchainId).toBe("node")
  })

  it("aliases javascript/js → node", () => {
    expect(resolveSnippetInvocation("javascript").command).toBe("node")
    expect(resolveSnippetInvocation("js").command).toBe("node")
  })

  it("python → comando python (win) / python3 (posix), extensão .py, catálogo python", () => {
    const inv = resolveSnippetInvocation("python")

    expect(inv.extension).toBe(".py")
    expect(inv.toolchainId).toBe("python")
    expect(inv.command).toBe(process.platform === "win32" ? "python" : "python3")
  })

  it("go → go run, extensão .go", () => {
    const inv = resolveSnippetInvocation("go")

    expect(inv.command).toBe("go")
    if (inv.mode === "script") {
      expect(inv.args).toEqual(["run"])
    }
    expect(inv.extension).toBe(".go")
    expect(inv.toolchainId).toBe("go")
  })

  it("java → script .java, catálogo java", () => {
    const inv = resolveSnippetInvocation("java")

    expect(inv.mode).toBe("script")
    expect(inv.command).toBe("java")
    expect(inv.extension).toBe(".java")
    expect(inv.toolchainId).toBe("java")
  })

  it("rust → compile-run rustc .rs .exe, catálogo rust", () => {
    const inv = resolveSnippetInvocation("rust")

    expect(inv.mode).toBe("compile-run")
    if (inv.mode === "compile-run") {
      expect(inv.command).toBe("rustc")
      expect(inv.extension).toBe(".rs")
      expect(inv.outputExtension).toBe(".exe")
      expect(inv.toolchainId).toBe("rust")
    }
  })

  it("c/cpp → compile-run gcc/g++", () => {
    const c = resolveSnippetInvocation("c")
    const cpp = resolveSnippetInvocation("cpp")

    expect(c.mode).toBe("compile-run")
    if (c.mode === "compile-run") {
      expect(c.command).toBe("gcc")
      expect(c.extension).toBe(".c")
    }
    expect(cpp.mode).toBe("compile-run")
    if (cpp.mode === "compile-run") {
      expect(cpp.command).toBe("g++")
      expect(cpp.extension).toBe(".cpp")
    }
  })

  it("linguagem desconhecida → comando = language, extensão .txt, sem catálogo", () => {
    const inv = resolveSnippetInvocation("elixir")

    expect(inv.mode).toBe("script")
    expect(inv.command).toBe("elixir")
    expect(inv.extension).toBe(".txt")
    expect("toolchainId" in inv).toBe(false)
  })

  it("normaliza maiúsculas e espaços", () => {
    expect(resolveSnippetInvocation("  NODE  ").command).toBe("node")
    expect(resolveSnippetInvocation("Python").command).toBe("python")
  })
})

describe("runSnippet (execução real)", () => {
  it("executa snippet de node com sucesso", async () => {
    const result = await runSnippet({
      language: "node",
      code: "console.log(1 + 2)",
    })

    expect(result.ok).toBe(true)
    const snippet = snippetOf(result)
    expect(snippet.exitCode).toBe(0)
    expect(snippet.stdout).toContain("3")
    expect(snippet.command).toContain("node")
    expect(typeof snippet.durationMs).toBe("number")
    expect(snippet.durationMs).toBeGreaterThanOrEqual(0)
  })

  it("exitCode diferente de zero não vira ok:false (código falhou, tool rodou)", async () => {
    const result = await runSnippet({
      language: "node",
      code: "process.exit(3)",
    })

    expect(result.ok).toBe(true)
    expect(snippetOf(result).exitCode).toBe(3)
  })

  it("runtime ausente → runtime_not_installed sem sugerir device-setup-toolchain", async () => {
    const result = await runSnippet({
      language: "definitely-not-a-runtime-7c",
      code: "print(1)",
    })

    expect(result.ok).toBe(false)
    expect((result as { code: string }).code).toBe("runtime_not_installed")
    expect((result as { error: string }).error).not.toContain("device-setup-toolchain")
  })

  it("idioma inválido → invalid_snippet_language", async () => {
    const result = await runSnippet({
      language: "node; rm -rf /",
      code: "console.log(1)",
    })

    expect(result.ok).toBe(false)
    expect((result as { code: string }).code).toBe("invalid_snippet_language")
  })

  it("cwd inexistente → invalid_snippet_cwd", async () => {
    const result = await runSnippet({
      language: "node",
      code: "console.log(1)",
      cwd: "C:\\pasta-que-nao-existe-7c",
    })

    expect(result.ok).toBe(false)
    expect((result as { code: string }).code).toBe("invalid_snippet_cwd")
  })

  it("timeout forçado → snippet_timeout", async () => {
    const result = await runSnippet(
      { language: "node", code: "setTimeout(() => {}, 5000)" },
      undefined,
      { timeoutMs: 100 },
    )

    expect(result.ok).toBe(false)
    expect((result as { code: string }).code).toBe("snippet_timeout")
  })

  it("code vazio → invalid_snippet_code", async () => {
    const result = await runSnippet({ language: "node", code: "" })

    expect(result.ok).toBe(false)
    expect((result as { code: string }).code).toBe("invalid_snippet_code")
  })
})
