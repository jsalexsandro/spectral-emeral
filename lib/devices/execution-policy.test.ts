import { describe, expect, it } from "vitest"
import { homedir } from "node:os"
import {
  classifyDeviceToolRisk,
  evaluateDeviceToolCall,
  parseDeviceExecutionPolicy,
  type ChatExecutionMode,
  type DeviceToolRisk,
} from "./execution-policy"

function decide(
  confirmDestructive: boolean,
  mode: ChatExecutionMode,
  risk: DeviceToolRisk,
) {
  return evaluateDeviceToolCall({
    policy: { confirmDestructive },
    mode,
    risk,
  }).action
}

const MUTATIONS = ["input", "write", "exec"] as const
const IRREVERSIBLE = ["destructive", "system"] as const

describe("execution policy", () => {
  it("always allows read tools, regardless of mode or device setting", () => {
    for (const confirmDestructive of [true, false]) {
      for (const mode of ["plan", "build"] as const) {
        expect(decide(confirmDestructive, mode, "read")).toBe("allow")
      }
    }
  })

  it("denies every mutation in plan mode", () => {
    for (const confirmDestructive of [true, false]) {
      for (const risk of [...MUTATIONS, ...IRREVERSIBLE]) {
        expect(decide(confirmDestructive, "plan", risk)).toBe("deny")
      }
    }
  })

  it("runs mutations directly in build mode", () => {
    for (const confirmDestructive of [true, false]) {
      for (const risk of MUTATIONS) {
        expect(decide(confirmDestructive, "build", risk)).toBe("allow")
      }
    }
  })

  it("asks approval for destructive and system actions when confirming", () => {
    for (const risk of IRREVERSIBLE) {
      expect(decide(true, "build", risk)).toBe("approval")
    }
  })

  it("asks approval for launch when confirming, allows under full power", () => {
    expect(decide(true, "build", "launch")).toBe("approval")
    expect(decide(false, "build", "launch")).toBe("allow")
    expect(decide(true, "plan", "launch")).toBe("deny")
    expect(decide(false, "plan", "launch")).toBe("deny")
  })

  it("releases destructive and system actions under full power", () => {
    for (const risk of IRREVERSIBLE) {
      expect(decide(false, "build", risk)).toBe("allow")
    }
  })
})

describe("device tool risk classification", () => {
  it("returns null for tools that are not device tools", () => {
    expect(classifyDeviceToolRisk("render-html", {})).toBeNull()
  })

  it("classifies known tools", () => {
    expect(classifyDeviceToolRisk("device-list", {})).toBe("read")
    expect(classifyDeviceToolRisk("device-click", {})).toBe("input")
    expect(classifyDeviceToolRisk("device-write-file", {})).toBe("write")
    expect(
      classifyDeviceToolRisk("device-window-action", { action: "close" }),
    ).toBe("destructive")
    expect(
      classifyDeviceToolRisk("device-window-action", { action: "minimize" }),
    ).toBe("input")
    expect(classifyDeviceToolRisk("device-minimize-window", {})).toBe("input")
    expect(classifyDeviceToolRisk("device-close-window", {})).toBe(
      "destructive",
    )
    expect(classifyDeviceToolRisk("device-stat", {})).toBe("read")
    expect(classifyDeviceToolRisk("device-read-files", { paths: ["a.ts"] })).toBe(
      "read",
    )
    expect(classifyDeviceToolRisk("device-project-info", {})).toBe("read")
    expect(classifyDeviceToolRisk("device-git-status", {})).toBe("read")
    expect(classifyDeviceToolRisk("device-git-diff", {})).toBe("read")
    expect(classifyDeviceToolRisk("device-mkdir", {})).toBe("write")
    expect(
      classifyDeviceToolRisk("device-write-files", {
        files: [{ path: "a.ts", content: "x" }],
      }),
    ).toBe("write")
    expect(classifyDeviceToolRisk("device-copy", {})).toBe("write")
    expect(classifyDeviceToolRisk("device-move", {})).toBe("write")
    expect(classifyDeviceToolRisk("device-apply-patch", {})).toBe("write")
    expect(classifyDeviceToolRisk("device-delete", {})).toBe("destructive")
    expect(classifyDeviceToolRisk("device-list-processes", {})).toBe("read")
    expect(classifyDeviceToolRisk("device-kill-process", {})).toBe(
      "destructive",
    )
  })

  it("promotes dangerous shell scripts", () => {
    expect(classifyDeviceToolRisk("device-shell", { script: "npm test" })).toBe(
      "exec",
    )
    expect(
      classifyDeviceToolRisk("device-shell", { script: "shutdown /s /t 0" }),
    ).toBe("system")
    expect(
      classifyDeviceToolRisk("device-shell", {
        script: "Remove-Item -Recurse -Force C:\\temp",
      }),
    ).toBe("destructive")
  })

  it("classifica lançamentos de apps no shell como launch", () => {
    const scripts = [
      "Start-Process 'C:\\Zed\\Zed.exe' -ArgumentList '.'",
      "start \"\" \"C:\\Zed\\Zed.exe\" .",
      "xdg-open /home/user/projeto",
      "explorer.exe C:\\Users\\eujos\\projeto",
      "open -a Safari",
      "open .",
      "& 'C:\\Zed\\Zed.exe' .",
      "\"C:\\Zed\\Zed.exe\" .",
    ]

    for (const script of scripts) {
      expect(classifyDeviceToolRisk("device-shell", { script })).toBe("launch")
    }
  })

  it("mantém system e destructive acima de launch", () => {
    expect(
      classifyDeviceToolRisk("device-shell", {
        script: "Start-Process powershell -Verb RunAs",
      }),
    ).toBe("system")
    expect(
      classifyDeviceToolRisk("device-shell", {
        script: "Start-Process cmd -ArgumentList '/c del /s /q C:\\temp'",
      }),
    ).toBe("destructive")
  })

  it("classifica instalações de software no shell como install", () => {
    const scripts = [
      "winget install OpenJS.NodeJS.LTS",
      "choco install git",
      "scoop install python",
      "msiexec /i setup.msi /qn",
      "npm i -g some-cli",
      "pnpm add -g some-cli",
      "yarn global add some-cli",
      "cargo install ripgrep",
      "go install example.com/cli@latest",
      "dotnet tool install -g some-tool",
      "gem install rails",
      "pip install requests",
    ]

    for (const script of scripts) {
      expect(classifyDeviceToolRisk("device-shell", { script })).toBe(
        "install",
      )
    }
  })

  it("não classifica dependências do projeto como install", () => {
    for (const script of [
      "npm ci",
      "npm install",
      "pnpm install --frozen-lockfile",
      "yarn install",
      "bun install",
      "uv sync",
      "cargo add serde",
      "dotnet add package Newtonsoft.Json",
      "go mod download",
    ]) {
      expect(classifyDeviceToolRisk("device-shell", { script })).toBe("exec")
    }
  })

  it("install pede aprovação sempre, inclusive em Poder Total", () => {
    for (const confirmDestructive of [true, false]) {
      expect(decide(confirmDestructive, "build", "install")).toBe("approval")
      expect(decide(confirmDestructive, "plan", "install")).toBe("deny")
    }
  })

  it("classifica device-setup-toolchain como install", () => {
    expect(classifyDeviceToolRisk("device-setup-toolchain", {})).toBe(
      "install",
    )
  })

  it("não promove comandos comuns de build a install", () => {
    for (const script of ["npm test", "git status", "python script.py"]) {
      expect(classifyDeviceToolRisk("device-shell", { script })).toBe("exec")
    }
  })

  it("não promove comandos comuns de build a launch", () => {
    for (const script of [
      "npm test",
      "git status",
      "Write-Output 'ok'",
      "Get-Item C:\\Zed\\Zed.exe",
      "python script.py",
    ]) {
      expect(classifyDeviceToolRisk("device-shell", { script })).toBe("exec")
    }
  })

  it("promotes dangerous run-command invocations", () => {
    expect(
      classifyDeviceToolRisk("device-run-command", { command: "taskkill" }),
    ).toBe("destructive")
    expect(
      classifyDeviceToolRisk("device-run-command", { command: "whoami" }),
    ).toBe("exec")
  })

  it("classifica open-app sem argumentos como interação", () => {
    expect(
      classifyDeviceToolRisk("device-open-app", { appId: "zed-7eb333" }),
    ).toBe("input")
    expect(
      classifyDeviceToolRisk("device-open-app", { path: "C:\\Zed\\Zed.exe" }),
    ).toBe("input")
  })

  it("promove open-app com args ou cwd para lançamento", () => {
    expect(
      classifyDeviceToolRisk("device-open-app", {
        appId: "zed-7eb333",
        args: ["."],
      }),
    ).toBe("launch")
    expect(
      classifyDeviceToolRisk("device-open-app", {
        appId: "zed-7eb333",
        cwd: "C:\\projeto",
      }),
    ).toBe("launch")
    expect(
      classifyDeviceToolRisk("device-open-app", {
        path: "C:\\Zed\\Zed.exe",
        args: ["--verbose"],
      }),
    ).toBe("launch")
  })

  it("classifica open-path e register/remove", () => {
    expect(
      classifyDeviceToolRisk("device-open-path", { path: "C:\\arquivo.pdf" }),
    ).toBe("input")
    expect(
      classifyDeviceToolRisk("device-register-app", {
        name: "Zed",
        path: "C:\\Zed\\Zed.exe",
      }),
    ).toBe("write")
    expect(
      classifyDeviceToolRisk("device-remove-app", { appId: "zed-7eb333" }),
    ).toBe("write")
  })

  it("classifica tools de jobs", () => {
    expect(classifyDeviceToolRisk("device-job-start", { script: "npm test" })).toBe(
      "exec",
    )
    expect(classifyDeviceToolRisk("device-job-status", { jobId: "abc" })).toBe(
      "read",
    )
    expect(classifyDeviceToolRisk("device-job-output", { jobId: "abc", cursor: 0 })).toBe(
      "read",
    )
    expect(classifyDeviceToolRisk("device-job-cancel", { jobId: "abc" })).toBe(
      "input",
    )
    expect(classifyDeviceToolRisk("device-job-list", {})).toBe("read")
  })

  it("escrita dentro do home e escrita fora do home", () => {
    const home = homedir()

    // Dentro do home: escrita normal
    expect(
      classifyDeviceToolRisk("device-write-file", { path: `${home}\\arquivo.txt` }),
    ).toBe("write")
    expect(
      classifyDeviceToolRisk("device-edit-file", { path: `${home}\\projeto\\code.ts` }),
    ).toBe("write")
    expect(
      classifyDeviceToolRisk("device-mkdir", { path: `${home}\\nova-pasta` }),
    ).toBe("write")

    // Fora do home: escrita vira destrutiva (precisa de aprovacao)
    expect(
      classifyDeviceToolRisk("device-write-file", { path: "D:\\projetos\\arquivo.txt" }),
    ).toBe("destructive")
    expect(
      classifyDeviceToolRisk("device-edit-file", { path: "C:\\Windows\\system.ini" }),
    ).toBe("destructive")
    expect(
      classifyDeviceToolRisk("device-copy", { from: "D:\\a.txt", to: "D:\\b.txt" }),
    ).toBe("destructive")
    expect(
      classifyDeviceToolRisk("device-move", { from: "D:\\a.txt", to: "D:\\b.txt" }),
    ).toBe("destructive")
    expect(
      classifyDeviceToolRisk("device-apply-patch", { path: "D:\\projeto\\code.ts", patches: [] }),
    ).toBe("destructive")

    // Lote de escrita: qualquer caminho fora do home eleva o lote inteiro.
    expect(
      classifyDeviceToolRisk("device-write-files", {
        files: [
          { path: `${home}\\a.ts`, content: "x" },
          { path: `${home}\\b.ts`, content: "y" },
        ],
      }),
    ).toBe("write")
    expect(
      classifyDeviceToolRisk("device-write-files", {
        files: [
          { path: `${home}\\a.ts`, content: "x" },
          { path: "D:\\fora.ts", content: "y" },
        ],
      }),
    ).toBe("destructive")

    // device-delete continua sempre destrutivo, independente do caminho
    expect(
      classifyDeviceToolRisk("device-delete", { path: `${home}\\arquivo.txt` }),
    ).toBe("destructive")
    expect(
      classifyDeviceToolRisk("device-delete", { path: "D:\\arquivo.txt" }),
    ).toBe("destructive")
  })
})

describe("parseDeviceExecutionPolicy", () => {
  it("defaults to confirming destructive actions", () => {
    expect(parseDeviceExecutionPolicy(null).confirmDestructive).toBe(true)
    expect(parseDeviceExecutionPolicy(undefined).confirmDestructive).toBe(true)
    expect(parseDeviceExecutionPolicy("nonsense").confirmDestructive).toBe(true)
    expect(parseDeviceExecutionPolicy([]).confirmDestructive).toBe(true)
  })

  it("accepts the current boolean shape", () => {
    expect(parseDeviceExecutionPolicy({ confirmDestructive: false })).toEqual({
      confirmDestructive: false,
    })
    expect(
      parseDeviceExecutionPolicy({
        confirmDestructive: true,
        updatedAt: "2026-11-11T00:00:00.000Z",
      }),
    ).toEqual({
      confirmDestructive: true,
      updatedAt: "2026-11-11T00:00:00.000Z",
    })
  })

  it("maps the legacy level format without loosening anything", () => {
    expect(parseDeviceExecutionPolicy("full").confirmDestructive).toBe(false)
    expect(parseDeviceExecutionPolicy({ level: "full" })).toEqual({
      confirmDestructive: false,
    })
    expect(parseDeviceExecutionPolicy("trusted").confirmDestructive).toBe(true)
    expect(parseDeviceExecutionPolicy("read-only").confirmDestructive).toBe(true)
    expect(parseDeviceExecutionPolicy({ level: "nope" }).confirmDestructive).toBe(
      true,
    )
  })
})
