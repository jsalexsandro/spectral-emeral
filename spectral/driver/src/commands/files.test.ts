import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { afterAll, describe, expect, it } from "vitest"
import { parseDeviceCommand } from "../../../shared/device-commands.js"
import { executeDeviceCommand } from "./executor.js"

// O diretório do driver está em PROTECTED_PATHS e serve de alvo de escrita
// negada sem tocar em caminhos do sistema.
const driverRoot = join(dirname(fileURLToPath(import.meta.url)), "..")
const self = fileURLToPath(import.meta.url)

async function run(command: string, input: unknown) {
  return executeDeviceCommand(parseDeviceCommand(command, input))
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
