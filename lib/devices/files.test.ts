import { describe, expect, it, beforeAll, afterAll } from "vitest"
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, sep } from "node:path"
import { FileSandbox, DeviceFileError } from "@/spectral/driver/src/commands/files"

let root: string
let sandbox: FileSandbox

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "spectral-files-test-"))
  sandbox = new FileSandbox({ root })

  await writeFile(join(root, "a.txt"), "linha 1\nlinha 2\nlinha 3\n")
  await writeFile(join(root, "b.md"), "# titulo\nconteudo\n")
  await writeFile(join(root, ".hidden"), "arquivo oculto\n")
  await writeFile(join(root, ".env"), "SEGREDO=123\n")
  await mkdir(join(root, "sub"), { recursive: true })
  await writeFile(join(root, "sub", "c.txt"), "arquivo em subpasta\n")
  await mkdir(join(root, "node_modules"), { recursive: true })
  await writeFile(join(root, "node_modules", "x.txt", ), "ignorado\n")
})

afterAll(async () => {
  await rm(root, { recursive: true, force: true })
})

describe("sandbox de arquivos", () => {
  it("lista arquivos da raiz por profundidade 1", async () => {
    const result = await sandbox.listFiles({
      path: undefined,
      depth: 1,
      showHidden: false,
      maxEntries: 200,
    })

    expect(result.ok).toBe(true)
    const names = result.entries!.map((e) => e.name)
    expect(names).toContain("a.txt")
    expect(names).toContain("b.md")
    expect(names).toContain("sub")
    expect(names).not.toContain(".hidden")
    expect(names).not.toContain("node_modules")
  })

  it("lista com profundidade 2", async () => {
    const result = await sandbox.listFiles({
      path: undefined,
      depth: 2,
      showHidden: false,
      maxEntries: 200,
    })

    const paths = result.entries!.map((e) => e.path)
    expect(paths.some((p) => p.endsWith("sub" + sep + "c.txt"))).toBe(true)
  })

  it("mostra arquivos ocultos quando solicitado", async () => {
    const result = await sandbox.listFiles({
      path: undefined,
      depth: 1,
      showHidden: true,
      maxEntries: 200,
    })

    const names = result.entries!.map((e) => e.name)
    expect(names).toContain(".hidden")
  })

  it("bloqueia caminho sensível (.env)", async () => {
    await expect(
      sandbox.readFile({ path: ".env", offset: 1, limit: 10 }),
    ).rejects.toBeInstanceOf(DeviceFileError)
  })

  it("bloqueia travessia de diretório", async () => {
    await expect(
      sandbox.resolvePath("../outside"),
    ).rejects.toBeInstanceOf(DeviceFileError)
  })

  it("lê arquivo com offset e limit", async () => {
    const result = await sandbox.readFile({
      path: "a.txt",
      offset: 1,
      limit: 2,
    })

    expect(result.ok).toBe(true)
    expect(result.file!.content).toBe("linha 1\nlinha 2")
    expect(result.file!.startLine).toBe(1)
    expect(result.file!.endLine).toBe(2)
    expect(result.file!.totalLines).toBe(4)
    expect(result.file!.truncated).toBe(true)
  })

  it("rejeita arquivo binário", async () => {
    await writeFile(join(root, "bin.dat"), Buffer.from([0, 1, 2, 3]))
    await expect(
      sandbox.readFile({ path: "bin.dat", offset: 1, limit: 10 }),
    ).rejects.toBeInstanceOf(DeviceFileError)
  })

  it("glob encontra arquivos por padrão", async () => {
    const result = await sandbox.glob({
      pattern: "**/*.txt",
      path: undefined,
      showHidden: false,
      maxResults: 100,
    })

    expect(result.ok).toBe(true)
    const paths = result.paths!.map((p) => p.split(sep).pop())
    expect(paths).toContain("a.txt")
    expect(paths).toContain("c.txt")
    expect(paths).not.toContain("x.txt")
  })

  it("grep encontra correspondências", async () => {
    await writeFile(join(root, "busca.txt"), "TODO: primeiro\noutro\nTODO: segundo\n")

    const result = await sandbox.grep({
      pattern: "TODO",
      path: undefined,
      glob: undefined,
      caseSensitive: false,
      maxResults: 100,
    })

    expect(result.ok).toBe(true)
    expect(result.matches!.length).toBe(2)
    expect(result.matches![0].line).toBe(1)
    expect(result.matches![0].text).toContain("TODO")
  })

  it("grep diferencia maiúsculas quando solicitado", async () => {
    const result = await sandbox.grep({
      pattern: "todo",
      path: undefined,
      glob: undefined,
      caseSensitive: true,
      maxResults: 100,
    })

    expect(result.ok).toBe(true)
    expect(result.matches!.length).toBe(0)
  })
})
