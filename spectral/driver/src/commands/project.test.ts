import { execFile } from "node:child_process"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { promisify } from "node:util"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { getFileSandbox } from "./files.js"
import { locateCommand } from "./shell.js"
import { getInstalledRuntimes } from "./system.js"
import { getGitDiff, getGitStatus, getProjectInfo, parseGitStatusOutput } from "./project.js"

vi.mock("./system.js", () => ({
  getInstalledRuntimes: vi.fn().mockResolvedValue([]),
}))

const execFileAsync = promisify(execFile)
const sandbox = getFileSandbox()
const gitAvailable = Boolean(await locateCommand("git"))

const workspaces: string[] = []

async function workspace(name: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), `spectral-project-${name}-`))

  workspaces.push(root)

  return root
}

afterAll(async () => {
  await Promise.all(
    workspaces.map((root) => rm(root, { recursive: true, force: true })),
  )
})

describe("parseGitStatusOutput", () => {
  it("interpreta branch, rename, untracked e conflito", () => {
    const output = [
      "# branch.oid abc",
      "# branch.head main",
      "# branch.upstream origin/main",
      "# branch.ab +2 -1",
      "1 .M N... 100644 100644 100644 aaa aaa src/a.ts",
      "2 R. N... 100644 100644 100644 aaa aaa R100 novo.ts",
      "antigo.ts",
      "? novo.txt",
      "u UU N... 100644 100644 100644 100644 aaa aaa aaa conflito.txt",
      "",
    ].join("\0")

    const parsed = parseGitStatusOutput(output)

    expect(parsed.branch).toBe("main")
    expect(parsed.upstream).toBe("origin/main")
    expect(parsed.ahead).toBe(2)
    expect(parsed.behind).toBe(1)
    expect(parsed.counts).toEqual({
      staged: 1,
      unstaged: 1,
      untracked: 1,
      conflicted: 1,
    })
    expect(parsed.files.map((file) => file.path)).toEqual([
      "src/a.ts",
      "novo.ts",
      "novo.txt",
      "conflito.txt",
    ])
    expect(parsed.files[1]).toMatchObject({ status: "R.", staged: true })
  })
})

describe("project-info", () => {
  it("detecta node com typescript, pnpm, scripts e versão pinada", async () => {
    const root = await workspace("node")

    await writeFile(
      join(root, "package.json"),
      JSON.stringify({
        name: "app-teste",
        packageManager: "pnpm@9.0.0",
        scripts: { dev: "next dev", test: "vitest run" },
        engines: { node: ">=20" },
        dependencies: { next: "^16.0.0", react: "^19.0.0" },
        devDependencies: { typescript: "^5.0.0" },
      }),
      "utf8",
    )
    await writeFile(join(root, "tsconfig.json"), "{}", "utf8")
    await writeFile(join(root, "pnpm-lock.yaml"), "lockfileVersion: 9", "utf8")
    await writeFile(join(root, ".nvmrc"), "20\n", "utf8")
    await mkdir(join(root, "node_modules"), { recursive: true })

    const result = await getProjectInfo({ path: root }, sandbox)
    const project = result.project

    expect(project).toBeDefined()
    expect(project).toMatchObject({
      root,
      name: "app-teste",
      stack: {
        language: "typescript",
        framework: "next",
        packageManager: "pnpm",
      },
      dependencies: { installed: true, manager: "node_modules" },
    })
    expect(project?.scripts).toEqual([
      { name: "dev", command: "next dev" },
      { name: "test", command: "vitest run" },
    ])
    expect(project?.pinned).toEqual(
      expect.arrayContaining([
        { tool: "node", version: "20", source: ".nvmrc" },
        { tool: "node", version: ">=20", source: "package.json#engines" },
      ]),
    )
    expect(project?.manifests.map((item) => item.kind)).toEqual(
      expect.arrayContaining(["node", "typescript", "pnpm-lock"]),
    )
    expect(project?.entries.some((entry) => entry.name === "package.json")).toBe(
      true,
    )
  })

  it("detecta python com uv", async () => {
    const root = await workspace("python")

    await writeFile(
      join(root, "pyproject.toml"),
      '[project]\nname = "app"\n',
      "utf8",
    )
    await writeFile(join(root, "uv.lock"), "", "utf8")
    await writeFile(join(root, ".python-version"), "3.12.1\n", "utf8")

    const result = await getProjectInfo({ path: root }, sandbox)

    expect(result.project?.stack).toMatchObject({
      language: "python",
      packageManager: "uv",
    })
    expect(result.project?.pinned).toEqual(
      expect.arrayContaining([
        { tool: "python", version: "3.12.1", source: ".python-version" },
      ]),
    )
    expect(result.project?.dependencies.installed).toBe(false)
    expect(result.project?.warnings.join(" ")).toContain("Dependências")
  })

  it("detecta rust e a versão da toolchain", async () => {
    const root = await workspace("rust")

    await writeFile(join(root, "Cargo.toml"), '[package]\nname = "app"\n', "utf8")
    await writeFile(
      join(root, "rust-toolchain.toml"),
      '[toolchain]\nchannel = "1.79.0"\n',
      "utf8",
    )
    await mkdir(join(root, "target"), { recursive: true })

    const result = await getProjectInfo({ path: root }, sandbox)

    expect(result.project?.stack).toMatchObject({
      language: "rust",
      packageManager: "cargo",
    })
    expect(result.project?.pinned).toEqual([
      { tool: "rust", version: "1.79.0", source: "rust-toolchain.toml" },
    ])
    expect(result.project?.dependencies).toEqual({
      installed: true,
      manager: "target",
    })
  })

  it("avisa quando não há manifesto e sobe até a raiz do projeto", async () => {
    const root = await workspace("vazio")
    const nested = join(root, "src", "deep")

    await mkdir(nested, { recursive: true })

    const empty = await getProjectInfo({ path: nested }, sandbox)

    expect(empty.project?.root).toBe(nested)
    expect(empty.project?.stack.language).toBeNull()
    expect(empty.project?.warnings.join(" ")).toContain("Nenhum manifesto")

    await writeFile(join(root, "go.mod"), "module exemplo\n\ngo 1.22\n", "utf8")

    const found = await getProjectInfo({ path: nested }, sandbox)

    expect(found.project?.root).toBe(root)
    expect(found.project?.stack).toMatchObject({
      language: "go",
      packageManager: "go",
    })
    expect(found.project?.pinned).toEqual([
      { tool: "go", version: "1.22", source: "go.mod" },
    ])
  })
})

describe.skipIf(!gitAvailable)("git somente leitura", () => {
  let repo = ""

  beforeAll(async () => {
    repo = await workspace("git")

    const git = async (...args: string[]) =>
      execFileAsync("git", args, { cwd: repo, windowsHide: true })

    await git("init", "-q")
    await git("config", "user.email", "teste@spectral.local")
    await git("config", "user.name", "Teste")
    await git("config", "commit.gpgsign", "false")
    await writeFile(join(repo, "a.txt"), "linha 1\nlinha 2\n", "utf8")
    await git("add", "a.txt")
    await git("commit", "-q", "-m", "commit inicial")
  })

  it("lê o estado do repositório sem shell", async () => {
    await writeFile(join(repo, "a.txt"), "linha 1 alterada\nlinha 2\n", "utf8")
    await writeFile(join(repo, "novo.txt"), "novo\n", "utf8")

    const status = await getGitStatus({ path: repo, includeUntracked: true }, sandbox)

    expect(status.gitStatus).toMatchObject({
      branch: "master",
      clean: false,
      counts: { staged: 0, unstaged: 1, untracked: 1, conflicted: 0 },
    })

    const tracked = status.gitStatus?.files.filter(
      (file) => file.status !== "??",
    )

    expect(tracked).toEqual([
      expect.objectContaining({ path: "a.txt", status: ".M" }),
    ])

    const diff = await getGitDiff(
      { path: repo, staged: false, context: 3, maxBytes: 200 * 1024 },
      sandbox,
    )

    expect(diff.gitDiff).toMatchObject({
      filesChanged: 1,
      additions: 1,
      deletions: 1,
    })
    expect(diff.gitDiff?.diff).toContain("-linha 1")
    expect(diff.gitDiff?.diff).toContain("+linha 1 alterada")
  })

  it("corta o patch no limite pedido", async () => {
    await writeFile(
      join(repo, "a.txt"),
      Array.from({ length: 200 }, (_, index) => `linha ${index}`).join("\n"),
      "utf8",
    )

    const diff = await getGitDiff(
      { path: repo, staged: false, context: 3, maxBytes: 64 },
      sandbox,
    )

    expect(diff.gitDiff?.truncated).toBe(true)
    expect(Buffer.byteLength(diff.gitDiff?.diff ?? "", "utf8")).toBeLessThanOrEqual(
      64,
    )
  })

  it("devolve null fora de um repositório", async () => {
    const outside = await workspace("sem-git")

    const status = await getGitStatus(
      { path: outside, includeUntracked: true },
      sandbox,
    )
    const diff = await getGitDiff(
      { path: outside, staged: false, context: 3, maxBytes: 1024 },
      sandbox,
    )

    expect(status.gitStatus).toBeNull()
    expect(diff.gitDiff).toBeNull()
  })
})

describe("warnings de runtime ausente", () => {
  const mockRuntimes = vi.mocked(getInstalledRuntimes)

  it("avisa quando falta o runtime do projeto e aponta device-setup-toolchain", async () => {
    mockRuntimes.mockResolvedValue([
      { id: "node", version: "26.13.1", path: "C:\\node\\node.exe" },
    ])

    const root = await workspace("py-sem-python")
    await writeFile(join(root, "requirements.txt"), "requests\n")

    const result = await getProjectInfo({ path: root }, sandbox)
    const warnings = result.project?.warnings ?? []

    expect(
      warnings.some(
        (w) =>
          w.includes("Python") &&
          w.includes("não foi encontrado") &&
          w.includes("device-setup-toolchain") &&
          w.includes("toolchain: python"),
      ),
    ).toBe(true)
  })

  it("não avisa quando o runtime exigido está instalado", async () => {
    mockRuntimes.mockResolvedValue([
      { id: "node", version: "26.13.1", path: "C:\\node\\node.exe" },
      { id: "python", version: "3.14.0", path: "C:\\python\\python.exe" },
    ])

    const root = await workspace("node-com-runtime")
    await writeFile(join(root, "package.json"), JSON.stringify({ name: "meu-app" }))

    const result = await getProjectInfo({ path: root }, sandbox)
    const warnings = result.project?.warnings ?? []

    expect(
      warnings.some((w) => w.includes("device-setup-toolchain")),
    ).toBe(false)
  })

  it("não avisa runtimes ausentes quando a detecção veio vazia", async () => {
    mockRuntimes.mockResolvedValue([])

    const root = await workspace("sem-runtimes")
    await writeFile(join(root, "package.json"), JSON.stringify({ name: "x" }))

    const result = await getProjectInfo({ path: root }, sandbox)
    const warnings = result.project?.warnings ?? []

    expect(
      warnings.some((w) => w.includes("não foi encontrado")),
    ).toBe(false)
  })
})
