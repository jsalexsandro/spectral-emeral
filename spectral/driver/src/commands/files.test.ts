import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { afterAll, describe, expect, it } from "vitest"
import type { DeviceCommandSuccess } from "../../../shared/device-commands.js"
import { parseDeviceCommand } from "../../../shared/device-commands.js"
import { executeDeviceCommand } from "./executor.js"

// O diretório do driver está em PROTECTED_PATHS e serve de alvo de escrita
// negada sem tocar em caminhos do sistema.
const driverRoot = join(dirname(fileURLToPath(import.meta.url)), "..")
const self = fileURLToPath(import.meta.url)

async function run(command: string, input: unknown) {
  return executeDeviceCommand(parseDeviceCommand(command, input))
}

async function runOk(
  command: string,
  input: unknown,
): Promise<DeviceCommandSuccess> {
  const result = await run(command, input)

  expect(result.ok).toBe(true)

  return result as DeviceCommandSuccess
}

describe.skipIf(process.platform !== "win32")("protected paths", () => {
  let workspace = ""

  afterAll(async () => {
    if (workspace) {
      await rm(workspace, { recursive: true, force: true }).catch(() => undefined)
    }
  })

  it("nega escrita e remoção mesmo em caminhos que existem", async () => {
    const target = join(driverRoot, "tmp-protected-e2e")
    const file = join(target, "arquivo.txt")

    expect(await run("mkdir", { path: target, recursive: true })).toMatchObject({
      ok: false,
      code: "path_protected",
    })

    expect(await run("write-file", { path: file, content: "x" })).toMatchObject({
      ok: false,
      code: "path_protected",
    })

    expect(
      await run("edit-file", { path: self, oldText: "protected", newText: "protected" }),
    ).toMatchObject({ ok: false, code: "path_protected" })

    expect(
      await run("apply-patch", {
        path: self,
        patches: [{ oldText: "protected", newText: "protected" }],
      }),
    ).toMatchObject({ ok: false, code: "path_protected" })

    expect(await run("delete", { path: self })).toMatchObject({
      ok: false,
      code: "path_protected",
    })

    expect(
      await run("move", { from: self, to: join(tmpdir(), "self-movido.ts") }),
    ).toMatchObject({ ok: false, code: "path_protected" })
  })

  it("nega cópia para destino protegido mas permite ler a origem", async () => {
    workspace = await mkdtemp(join(tmpdir(), "spectral-e2e-"))
    const source = join(workspace, "origem.txt")

    await writeFile(source, "origem", "utf8")

    expect(
      await run("copy", {
        from: source,
        to: join(driverRoot, "tmp-protected-e2e", "copia.txt"),
      }),
    ).toMatchObject({ ok: false, code: "path_protected" })
  })
})

describe("files batch", () => {
  let workspace = ""

  afterAll(async () => {
    if (workspace) {
      await rm(workspace, { recursive: true, force: true }).catch(() => undefined)
    }
  })

  async function ensureWorkspace(): Promise<string> {
    if (!workspace) {
      workspace = await mkdtemp(join(tmpdir(), "spectral-batch-"))
    }

    return workspace
  }

  it("grava vários arquivos, cria diretórios e sinaliza created", async () => {
    const root = await ensureWorkspace()
    const first = join(root, "src", "a.txt")
    const second = join(root, "src", "nested", "b.txt")
    const third = join(root, "c.txt")

    const created = await runOk("write-files", {
      files: [
        { path: first, content: "um" },
        { path: second, content: "dois" },
        { path: third, content: "tres" },
      ],
    })

    expect(created).toMatchObject({ written: 3, failed: [] })
    expect(created.writes?.map((item) => item.created)).toEqual([
      true,
      true,
      true,
    ])

    const overwritten = await runOk("write-files", {
      files: [{ path: first, content: "um de novo" }],
    })

    expect(overwritten).toMatchObject({ written: 1 })
    expect(overwritten.writes?.[0]).toMatchObject({ created: false })
  })

  it("lê vários arquivos em uma chamada e deduplica caminhos", async () => {
    const root = await ensureWorkspace()
    const first = join(root, "read", "a.txt")
    const second = join(root, "read", "b.txt")

    await run("write-files", {
      files: [
        { path: first, content: "linha 1\nlinha 2\nlinha 3" },
        { path: second, content: "outro" },
      ],
    })

    const result = await runOk("read-files", {
      paths: [first, second, first],
    })

    expect(result.files).toHaveLength(2)
    expect(result.files?.[0]).toMatchObject({ path: first })
    expect(result.files?.[1]).toMatchObject({ path: second })
    expect(result.truncated).toBeUndefined()
    expect(result.totalBytes).toBe(
      Buffer.byteLength("linha 1\nlinha 2\nlinha 3") +
        Buffer.byteLength("outro"),
    )
  })

  it("devolve falha por arquivo sem derrubar o lote", async () => {
    const root = await ensureWorkspace()
    const ok = join(root, "mixed", "ok.txt")
    const missing = join(root, "mixed", "nao-existe.txt")

    await run("write-files", { files: [{ path: ok, content: "conteudo" }] })

    const result = await runOk("read-files", { paths: [ok, missing] })

    expect(result.files).toHaveLength(2)
    expect(result.files?.[0]).toHaveProperty("file")
    expect(result.files?.[1]).toMatchObject({
      path: missing,
      code: "path_not_found",
    })
  })

  it("corta o lote de leitura no teto total de bytes", async () => {
    const root = await ensureWorkspace()
    const chunk = "x".repeat(64 * 1024)
    const paths = [0, 1, 2, 3, 4].map((index) => join(root, "cap", `${index}.txt`))

    await runOk("write-files", {
      files: paths.map((path) => ({ path, content: chunk })),
    })

    const result = await runOk("read-files", { paths })

    expect(result.truncated).toBe(true)
    expect(result.totalBytes).toBeLessThanOrEqual(256 * 1024)
    expect(result.files?.[4]).toMatchObject({ code: "batch_limit_reached" })
  })

  it("valida o lote inteiro antes de gravar qualquer arquivo", async () => {
    const root = await ensureWorkspace()
    const good = join(root, "atomic", "bom.txt")

    const result = await run("write-files", {
      files: [
        { path: good, content: "nao deve existir" },
        { path: join(driverRoot, "tmp-protected-batch.txt"), content: "x" },
      ],
    })

    expect(result).toMatchObject({ ok: false, code: "path_protected" })
    await expect(access(good)).rejects.toThrow()
  })

  it("respeita o .gitignore na listagem e permite desligar", async () => {
    const root = await ensureWorkspace()
    const listing = join(root, "ignore")

    await mkdir(join(listing, "gerado"), { recursive: true })
    await mkdir(join(listing, "src"), { recursive: true })
    await writeFile(join(listing, ".gitignore"), "gerado/\n*.tmp\n", "utf8")
    await writeFile(join(listing, "gerado", "bundle.js"), "x", "utf8")
    await writeFile(join(listing, "app.tmp"), "x", "utf8")
    await writeFile(join(listing, "src", "a.ts"), "x", "utf8")
    await writeFile(join(listing, "src", "notes.tmp"), "x", "utf8")

    const filtered = await runOk("list-files", { path: listing, depth: 2 })
    const names = filtered.entries?.map((entry) => entry.name) ?? []

    expect(names).toContain("src")
    expect(names).toContain("a.ts")
    expect(names).not.toContain("gerado")
    expect(names).not.toContain("app.tmp")
    expect(names).not.toContain("notes.tmp")

    const unfiltered = await runOk("list-files", {
      path: listing,
      depth: 2,
      respectGitignore: false,
    })
    const all = unfiltered.entries?.map((entry) => entry.name) ?? []

    expect(all).toContain("gerado")
    expect(all).toContain("app.tmp")
    expect(all).toContain("notes.tmp")
  })
})
