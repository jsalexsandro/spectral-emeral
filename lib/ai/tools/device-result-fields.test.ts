import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  DEVICE_GET_SYSTEM_STATUS_TOOL_NAME,
  DEVICE_GIT_DIFF_TOOL_NAME,
  DEVICE_GIT_STATUS_TOOL_NAME,
  DEVICE_KILL_PROCESS_TOOL_NAME,
  DEVICE_LIST_PROCESSES_TOOL_NAME,
  DEVICE_LOCK_SCREEN_TOOL_NAME,
  DEVICE_MEDIA_CONTROL_TOOL_NAME,
  DEVICE_POWER_TOOL_NAME,
  DEVICE_PROJECT_INFO_TOOL_NAME,
  DEVICE_READ_FILES_TOOL_NAME,
  DEVICE_SET_BRIGHTNESS_TOOL_NAME,
  DEVICE_SET_VOLUME_TOOL_NAME,
  DEVICE_WRITE_FILES_TOOL_NAME,
  createDeviceTools,
} from "./device-tools"

// O foco aqui é o resultado que chega ao modelo depois do transporte. A
// política real consulta o banco e é coberta em execution-policy.test.ts.
vi.mock("@/lib/devices/tool-approval", () => ({
  assertDeviceCommandAllowed: async () => ({
    ok: true,
    risk: "exec",
    policy: { confirmDestructive: false },
  }),
  describeAuditPolicy: () => "full",
  readDeviceToolCommand: () => undefined,
}))

vi.mock("@/lib/devices/audit", () => ({
  recordDeviceAudit: async () => {},
}))

function stubResult(result: Record<string, unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ result: { ok: true, ...result } })),
  )
}

const toolContext = { toolCallId: "call-1", messages: [], context: {} }

beforeEach(() => {
  vi.stubEnv("SPECTRAL_INTERNAL_SECRET", "test-secret")
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe("device command results — campos preservados", () => {
  it("repassa systemStatus de get-system-status", async () => {
    const systemStatus = {
      volume: null,
      muted: null,
      brightness: 29,
      battery: { percent: 34, charging: true, acConnected: false },
    }
    stubResult({ systemStatus })

    const tool = createDeviceTools("user-1")[DEVICE_GET_SYSTEM_STATUS_TOOL_NAME]
    const output = await tool.execute!(
      { deviceId: "device-1" },
      toolContext,
    )

    expect(output).toMatchObject({ ok: true, deviceId: "device-1", systemStatus })
  })

  it("repassa processes de list-processes", async () => {
    const processes = [
      {
        pid: 1234,
        name: "code.exe",
        commandLine: "code.exe .",
        memoryBytes: 1024,
        protected: false,
      },
    ]
    stubResult({ processes })

    const tool = createDeviceTools("user-1")[DEVICE_LIST_PROCESSES_TOOL_NAME]
    const output = await tool.execute!(
      { deviceId: "device-1", limit: 40 },
      toolContext,
    )

    expect(output).toMatchObject({ ok: true, processes })
  })

  it("repassa killed de kill-process", async () => {
    stubResult({ killed: true })

    const tool = createDeviceTools("user-1")[DEVICE_KILL_PROCESS_TOOL_NAME]
    const output = await tool.execute!(
      { deviceId: "device-1", pid: 1234, force: false, tree: false },
      toolContext,
    )

    expect(output).toMatchObject({ ok: true, killed: true })
  })

  it("repassa volume, brightness, locked, power e mediaControl", async () => {
    const tools = createDeviceTools("user-1")

    stubResult({ volume: { level: 40, muted: false } })
    expect(
      await tools[DEVICE_SET_VOLUME_TOOL_NAME].execute!(
        { deviceId: "device-1", level: 40 },
        toolContext,
      ),
    ).toMatchObject({ ok: true, volume: { level: 40, muted: false } })

    stubResult({ brightness: { level: 50 } })
    expect(
      await tools[DEVICE_SET_BRIGHTNESS_TOOL_NAME].execute!(
        { deviceId: "device-1", level: 50 },
        toolContext,
      ),
    ).toMatchObject({ ok: true, brightness: { level: 50 } })

    stubResult({ locked: true })
    expect(
      await tools[DEVICE_LOCK_SCREEN_TOOL_NAME].execute!(
        { deviceId: "device-1" },
        toolContext,
      ),
    ).toMatchObject({ ok: true, locked: true })

    stubResult({ power: { action: "shutdown", delaySec: 60 } })
    expect(
      await tools[DEVICE_POWER_TOOL_NAME].execute!(
        { deviceId: "device-1", action: "shutdown", delaySec: 60 },
        toolContext,
      ),
    ).toMatchObject({ ok: true, power: { action: "shutdown", delaySec: 60 } })

    stubResult({ mediaControl: { action: "play-pause" } })
    expect(
      await tools[DEVICE_MEDIA_CONTROL_TOOL_NAME].execute!(
        { deviceId: "device-1", action: "play-pause" },
        toolContext,
      ),
    ).toMatchObject({ ok: true, mediaControl: { action: "play-pause" } })
  })
})

describe("device command results — lote, projeto e git", () => {
  it("repassa files, sucessos e falhas de read-files", async () => {
    const files = [
      {
        path: "src/a.ts",
        file: {
          path: "src/a.ts",
          content: "export const a = 1\n",
          startLine: 1,
          endLine: 1,
          totalLines: 1,
          truncated: false,
          size: 20,
        },
      },
      {
        path: "src/b.ts",
        code: "file_not_found",
        error: "Arquivo não encontrado.",
      },
    ]
    stubResult({ files, totalBytes: 20 })

    const tool = createDeviceTools("user-1")[DEVICE_READ_FILES_TOOL_NAME]
    const output = await tool.execute!(
      {
        deviceId: "device-1",
        paths: ["src/a.ts", "src/b.ts"],
        offset: 1,
        limit: 2000,
      },
      toolContext,
    )

    expect(output).toMatchObject({
      ok: true,
      deviceId: "device-1",
      files,
      totalBytes: 20,
    })
  })

  it("repassa writes, written, failed e totalBytes de write-files", async () => {
    const writes = [
      { path: "src/a.ts", size: 20, created: true },
      { path: "src/b.ts", size: 10, created: false },
    ]
    const failed = [
      {
        path: "C:\\Windows\\system32\\x.txt",
        code: "protected_path",
        error: "Caminho protegido.",
      },
    ]
    stubResult({ writes, written: 2, failed, totalBytes: 30 })

    const tool = createDeviceTools("user-1")[DEVICE_WRITE_FILES_TOOL_NAME]
    const output = await tool.execute!(
      {
        deviceId: "device-1",
        files: [
          { path: "src/a.ts", content: "export const a = 1\n" },
          { path: "src/b.ts", content: "export {}\n" },
        ],
      },
      toolContext,
    )

    expect(output).toMatchObject({
      ok: true,
      deviceId: "device-1",
      writes,
      written: 2,
      failed,
      totalBytes: 30,
    })
  })

  it("repassa project de project-info", async () => {
    const project = {
      root: "C:\\projetos\\app",
      name: "app",
      stack: {
        language: "TypeScript",
        framework: "Next.js",
        packageManager: "pnpm",
      },
      manifests: [{ path: "package.json", kind: "node" }],
      scripts: [{ name: "dev", command: "next dev" }],
      engines: { node: ">=20" },
      pinned: [{ tool: "node", version: "20.11.0", source: ".nvmrc" }],
      dependencies: { installed: true, manager: "pnpm" },
      git: {
        branch: "main",
        upstream: "origin/main",
        ahead: 1,
        behind: 0,
        dirty: true,
        changedFiles: 2,
        lastCommit: {
          hash: "abc1234",
          subject: "feat: algo",
          date: "2026-01-01T00:00:00.000Z",
        },
      },
      entries: [
        {
          name: "src",
          path: "C:\\projetos\\app\\src",
          type: "directory",
          size: null,
          modifiedAt: null,
        },
      ],
      warnings: [],
    }
    stubResult({ project })

    const tool = createDeviceTools("user-1")[DEVICE_PROJECT_INFO_TOOL_NAME]
    const output = await tool.execute!(
      { deviceId: "device-1" },
      toolContext,
    )

    expect(output).toMatchObject({ ok: true, deviceId: "device-1", project })
  })

  it("repassa gitStatus e gitDiff, inclusive quando nulos", async () => {
    const tools = createDeviceTools("user-1")
    const gitStatus = {
      root: "C:\\projetos\\app",
      branch: "main",
      upstream: "origin/main",
      ahead: 0,
      behind: 1,
      clean: false,
      counts: { staged: 1, unstaged: 1, untracked: 0, conflicted: 0 },
      files: [{ path: "src/a.ts", status: "M.", staged: true }],
      truncated: false,
    }
    stubResult({ gitStatus })
    expect(
      await tools[DEVICE_GIT_STATUS_TOOL_NAME].execute!(
        { deviceId: "device-1", includeUntracked: true },
        toolContext,
      ),
    ).toMatchObject({ ok: true, gitStatus })

    const gitDiff = {
      root: "C:\\projetos\\app",
      filesChanged: 1,
      additions: 2,
      deletions: 0,
      diff: "diff --git a/src/a.ts b/src/a.ts\n",
      truncated: false,
    }
    stubResult({ gitDiff })
    expect(
      await tools[DEVICE_GIT_DIFF_TOOL_NAME].execute!(
        { deviceId: "device-1", staged: false, context: 3, maxBytes: 204800 },
        toolContext,
      ),
    ).toMatchObject({ ok: true, gitDiff })

    stubResult({ gitStatus: null })
    const noRepo = await tools[DEVICE_GIT_STATUS_TOOL_NAME].execute!(
      { deviceId: "device-1", includeUntracked: true },
      toolContext,
    )
    expect(noRepo).toMatchObject({ ok: true })
    expect(noRepo).toHaveProperty("gitStatus", null)
  })
})
