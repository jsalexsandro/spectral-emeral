import { arch, platform, release, type, version } from "node:os"
import { execFileSync } from "node:child_process"
import type { DeviceOsInfo } from "../../../shared/device-commands.js"

function isElevated(): boolean {
  try {
    if (process.platform === "win32") {
      const output = execFileSync("whoami", ["/groups"], {
        encoding: "utf8",
        windowsHide: true,
      })

      return output.includes("S-1-16-12288")
    }

    return (process.getuid?.() ?? -1) === 0
  } catch {
    return false
  }
}

export function getOsInfo(): DeviceOsInfo {
  return {
    platform: platform() || "unknown",
    type: type() || "unknown",
    release: release() || "unknown",
    version: version() || "unknown",
    architecture: arch() || "unknown",
    elevated: isElevated(),
  }
}
