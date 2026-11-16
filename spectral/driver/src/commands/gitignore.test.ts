import { describe, expect, it } from "vitest"
import { isGitignored, parseGitignore } from "./gitignore.js"

function ignored(path: string, rules: ReturnType<typeof parseGitignore>) {
  return isGitignored(path, false, rules)
}

describe("gitignore", () => {
  it("ignora comentários, linhas vazias e aplica curingas por nível", () => {
    const rules = parseGitignore("# comentario\n\n*.log\nnode_modules\n")

    expect(ignored("a.log", rules)).toBe(true)
    expect(ignored("sub/deep/b.log", rules)).toBe(true)
    expect(ignored("sub/node_modules", rules)).toBe(true)
    expect(ignored("sub/b.txt", rules)).toBe(false)
  })

  it("respeita negação na ordem em que aparece", () => {
    const rules = parseGitignore("*.log\n!keep.log\n")

    expect(ignored("a.log", rules)).toBe(true)
    expect(ignored("keep.log", rules)).toBe(false)
    expect(ignored("sub/keep.log", rules)).toBe(false)
  })

  it("ancora padrões com barra e ignora apenas diretórios com barra final", () => {
    const rules = parseGitignore("/dist\ndocs/\n")

    expect(ignored("dist", rules)).toBe(true)
    expect(ignored("sub/dist", rules)).toBe(false)
    expect(isGitignored("docs", true, rules)).toBe(true)
    expect(ignored("docs", rules)).toBe(false)
  })

  it("aplica regras aninhadas somente no diretório de origem", () => {
    const rules = [
      ...parseGitignore("*.log", ""),
      ...parseGitignore("!importante.log", "sub"),
    ]

    expect(ignored("sub/importante.log", rules)).toBe(false)
    expect(ignored("outro/importante.log", rules)).toBe(true)
    expect(ignored("sub/outro.log", rules)).toBe(true)
  })

  it("suporta curinga recursivo", () => {
    const rules = parseGitignore("build/**\n")

    expect(ignored("build/a.js", rules)).toBe(true)
    expect(ignored("build/nested/b.js", rules)).toBe(true)
    expect(ignored("outro/build/a.js", rules)).toBe(false)
  })
})
