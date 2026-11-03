import type { DeviceAppInfo } from "../../../shared/device-commands.js"

export type AppDefinition = {
  id: string
  name: string
  win32?: string
  darwin?: string
  linux?: string
}

export const APPS: readonly AppDefinition[] = [
  {
    id: "chrome",
    name: "Google Chrome",
    win32: "chrome.exe",
    darwin: "Google Chrome",
    linux: "google-chrome",
  },
  {
    id: "edge",
    name: "Microsoft Edge",
    win32: "msedge.exe",
    darwin: "Microsoft Edge",
    linux: "microsoft-edge",
  },
  {
    id: "firefox",
    name: "Mozilla Firefox",
    win32: "firefox.exe",
    darwin: "Firefox",
    linux: "firefox",
  },
  {
    id: "notepad",
    name: "Bloco de Notas",
    win32: "notepad.exe",
    linux: "gedit",
  },
  {
    id: "explorer",
    name: "Explorador de Arquivos",
    win32: "explorer.exe",
    darwin: "Finder",
    linux: "nautilus",
  },
  {
    id: "vscode",
    name: "Visual Studio Code",
    win32: "code.cmd",
    darwin: "Visual Studio Code",
    linux: "code",
  },
  {
    id: "terminal",
    name: "Terminal",
    win32: "cmd.exe",
    darwin: "Terminal",
    linux: "x-terminal-emulator",
  },
  {
    id: "calculator",
    name: "Calculadora",
    win32: "calc.exe",
    darwin: "Calculator",
    linux: "gnome-calculator",
  },
]

const APP_BY_ID = new Map(APPS.map((app) => [app.id, app]))

function platformTarget(
  app: AppDefinition,
  platform: NodeJS.Platform,
): string | undefined {
  if (platform === "win32") {
    return app.win32
  }

  if (platform === "darwin") {
    return app.darwin
  }

  if (platform === "linux") {
    return app.linux
  }

  return undefined
}

export function findApp(appId: string): AppDefinition | undefined {
  return APP_BY_ID.get(appId)
}

export function getAppTarget(
  app: AppDefinition,
  platform: NodeJS.Platform = process.platform,
): string | undefined {
  return platformTarget(app, platform)
}

export function listApps(
  platform: NodeJS.Platform = process.platform,
): DeviceAppInfo[] {
  return APPS.filter((app) => platformTarget(app, platform) !== undefined).map(
    (app) => ({ id: app.id, name: app.name }),
  )
}
