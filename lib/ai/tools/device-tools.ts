import { tool } from "ai"
import { and, desc, eq, isNull } from "drizzle-orm"
import { z } from "zod"
import { devices } from "@/db/schema"
import {
  sendDeviceCommand,
  type SendDeviceCommandOutput,
} from "@/lib/devices/command-client"
import {
  DEVICE_APP_ID_PATTERN,
  DEVICE_KEYS,
  DEVICE_KEY_MODIFIERS,
  DEVICE_TEXT_MAX_LENGTH,
  DEVICE_URL_MAX_LENGTH,
  DEVICE_PATH_MAX_LENGTH,
  DEVICE_PATTERN_MAX_LENGTH,
  DEVICE_FILE_DEPTH_DEFAULT,
  DEVICE_FILE_DEPTH_MAX,
  DEVICE_FILE_DEPTH_MIN,
  DEVICE_FILE_ENTRIES_DEFAULT,
  DEVICE_FILE_ENTRIES_MAX,
  DEVICE_FILE_ENTRIES_MIN,
  DEVICE_FILE_RESULTS_DEFAULT,
  DEVICE_FILE_RESULTS_MAX,
  DEVICE_FILE_RESULTS_MIN,
  DEVICE_FILE_READ_LINES_DEFAULT,
  DEVICE_FILE_READ_LINES_MAX,
  DEVICE_FILE_READ_LINES_MIN,
  DEVICE_FILE_READ_OFFSET_DEFAULT,
  DEVICE_FILE_READ_OFFSET_MAX,
  DEVICE_FILE_READ_OFFSET_MIN,
  isAllowedDeviceUrl,
  isBlockedKeyCombination,
  type DeviceCommand,
  type DeviceKey,
  type DeviceKeyModifier,
} from "@/lib/devices/commands"
import { isDeviceOnline, type DeviceStatus } from "@/lib/devices/types"

export const DEVICE_LIST_TOOL_NAME = "device-list"
export const DEVICE_ONLINE_LIST_TOOL_NAME = "device-online-list"
export const DEVICE_OPEN_URL_TOOL_NAME = "device-open-url"
export const DEVICE_OPEN_APP_TOOL_NAME = "device-open-app"
export const DEVICE_LIST_APPS_TOOL_NAME = "device-list-apps"
export const DEVICE_GET_OS_TOOL_NAME = "device-get-os"
export const DEVICE_TYPE_TEXT_TOOL_NAME = "device-type-text"
export const DEVICE_PRESS_KEY_TOOL_NAME = "device-press-key"
export const DEVICE_LIST_FILES_TOOL_NAME = "device-list-files"
export const DEVICE_READ_FILE_TOOL_NAME = "device-read-file"
export const DEVICE_GLOB_TOOL_NAME = "device-glob"
export const DEVICE_GREP_TOOL_NAME = "device-grep"
export const DEVICE_CHECK_ADMIN_TOOL_NAME = "device-check-admin"

const deviceIdSchema = z
  .string()
  .min(1)
  .max(128)
  .describe("Id do dispositivo retornado por device-list.")

const deviceKeySchema = z.enum(
  DEVICE_KEYS as unknown as [DeviceKey, ...DeviceKey[]],
)

const deviceModifierSchema = z.enum(
  DEVICE_KEY_MODIFIERS as unknown as [
    DeviceKeyModifier,
    ...DeviceKeyModifier[],
  ],
)

export const deviceOpenUrlInputSchema = z.object({
  deviceId: deviceIdSchema,
  url: z
    .string()
    .min(1)
    .max(DEVICE_URL_MAX_LENGTH)
    .refine(isAllowedDeviceUrl, {
      message: "Use uma URL http:// ou https:// sem credenciais.",
    }),
})

export const deviceOpenAppInputSchema = z.object({
  deviceId: deviceIdSchema,
  appId: z
    .string()
    .regex(DEVICE_APP_ID_PATTERN, "Identificador de aplicativo inválido.")
    .describe("Id do aplicativo retornado por device-list-apps."),
})

export const deviceListAppsInputSchema = z.object({
  deviceId: deviceIdSchema,
})

export const deviceGetOsInputSchema = z.object({
  deviceId: deviceIdSchema,
})

export const deviceTypeTextInputSchema = z.object({
  deviceId: deviceIdSchema,
  text: z.string().min(1).max(DEVICE_TEXT_MAX_LENGTH),
})

export const devicePressKeyInputSchema = z
  .object({
    deviceId: deviceIdSchema,
    key: deviceKeySchema,
    modifiers: z.array(deviceModifierSchema).max(4).optional(),
  })
  .refine(
    (value) => !isBlockedKeyCombination(value.key, value.modifiers ?? []),
    {
      message: "Esta combinação de teclas é bloqueada por segurança.",
      path: ["key"],
    },
  )

export const deviceListFilesInputSchema = z.object({
  deviceId: deviceIdSchema,
  path: z.string().max(DEVICE_PATH_MAX_LENGTH).optional(),
  depth: z
    .number()
    .int()
    .min(DEVICE_FILE_DEPTH_MIN)
    .max(DEVICE_FILE_DEPTH_MAX)
    .default(DEVICE_FILE_DEPTH_DEFAULT),
  showHidden: z.boolean().default(false),
  maxEntries: z
    .number()
    .int()
    .min(DEVICE_FILE_ENTRIES_MIN)
    .max(DEVICE_FILE_ENTRIES_MAX)
    .default(DEVICE_FILE_ENTRIES_DEFAULT),
})

export const deviceReadFileInputSchema = z.object({
  deviceId: deviceIdSchema,
  path: z.string().max(DEVICE_PATH_MAX_LENGTH),
  offset: z
    .number()
    .int()
    .min(DEVICE_FILE_READ_OFFSET_MIN)
    .max(DEVICE_FILE_READ_OFFSET_MAX)
    .default(DEVICE_FILE_READ_OFFSET_DEFAULT),
  limit: z
    .number()
    .int()
    .min(DEVICE_FILE_READ_LINES_MIN)
    .max(DEVICE_FILE_READ_LINES_MAX)
    .default(DEVICE_FILE_READ_LINES_DEFAULT),
})

export const deviceGlobInputSchema = z.object({
  deviceId: deviceIdSchema,
  pattern: z.string().max(DEVICE_PATTERN_MAX_LENGTH),
  path: z.string().max(DEVICE_PATH_MAX_LENGTH).optional(),
  showHidden: z.boolean().default(false),
  maxResults: z
    .number()
    .int()
    .min(DEVICE_FILE_RESULTS_MIN)
    .max(DEVICE_FILE_RESULTS_MAX)
    .default(DEVICE_FILE_RESULTS_DEFAULT),
})

export const deviceGrepInputSchema = z.object({
  deviceId: deviceIdSchema,
  pattern: z.string().max(DEVICE_PATTERN_MAX_LENGTH),
  path: z.string().max(DEVICE_PATH_MAX_LENGTH).optional(),
  glob: z.string().max(DEVICE_PATTERN_MAX_LENGTH).optional(),
  caseSensitive: z.boolean().default(false),
  maxResults: z
    .number()
    .int()
    .min(DEVICE_FILE_RESULTS_MIN)
    .max(DEVICE_FILE_RESULTS_MAX)
    .default(DEVICE_FILE_RESULTS_DEFAULT),
})

export const deviceCheckAdminInputSchema = z.object({
  deviceId: deviceIdSchema,
})

type DeviceRow = {
  id: string
  name: string
  hostname: string | null
  platform: string
  architecture: string | null
  lastSeenAt: Date | null
}

export type DeviceToolSummary = {
  id: string
  name: string
  hostname: string | null
  platform: string
  architecture: string | null
  status: DeviceStatus
  lastSeenAt: string | null
}

export function toDeviceToolSummary(
  device: DeviceRow,
  now: number = Date.now(),
): DeviceToolSummary {
  return {
    id: device.id,
    name: device.name,
    hostname: device.hostname,
    platform: device.platform,
    architecture: device.architecture,
    status: isDeviceOnline(device.lastSeenAt, now) ? "online" : "offline",
    lastSeenAt: device.lastSeenAt?.toISOString() ?? null,
  }
}

export function selectOnlineDevices(
  list: readonly DeviceToolSummary[],
): DeviceToolSummary[] {
  return list.filter((device) => device.status === "online")
}

async function listOwnedDevices(userId: string): Promise<DeviceToolSummary[]> {
  const { db } = await import("@/db")

  const rows = await db
    .select({
      id: devices.id,
      name: devices.name,
      hostname: devices.hostname,
      platform: devices.platform,
      architecture: devices.architecture,
      lastSeenAt: devices.lastSeenAt,
    })
    .from(devices)
    .where(and(eq(devices.userId, userId), isNull(devices.revokedAt)))
    .orderBy(desc(devices.createdAt))

  const now = Date.now()

  return rows.map((row) => toDeviceToolSummary(row, now))
}

function toCommandToolResult(
  deviceId: string,
  output: SendDeviceCommandOutput,
) {
  if (!output.ok) {
    return { ok: false as const, code: output.code, error: output.error }
  }

  if (!output.result.ok) {
    return {
      ok: false as const,
      code: output.result.code ?? "command_failed",
      error: output.result.error,
    }
  }

  return {
    ok: true as const,
    deviceId,
    ...(output.result.output ? { output: output.result.output } : {}),
    ...(output.result.apps ? { apps: output.result.apps } : {}),
    ...(output.result.os ? { os: output.result.os } : {}),
    ...(output.result.entries ? { entries: output.result.entries } : {}),
    ...(output.result.file ? { file: output.result.file } : {}),
    ...(output.result.paths ? { paths: output.result.paths } : {}),
    ...(output.result.matches ? { matches: output.result.matches } : {}),
    ...(output.result.truncated !== undefined
      ? { truncated: output.result.truncated }
      : {}),
    ...(output.result.total !== undefined
      ? { total: output.result.total }
      : {}),
    ...(output.result.filesScanned !== undefined
      ? { filesScanned: output.result.filesScanned }
      : {}),
    ...(output.result.admin !== undefined
      ? { admin: output.result.admin }
      : {}),
  }
}

async function runDeviceCommand(
  userId: string,
  deviceId: string,
  command: DeviceCommand,
) {
  const output = await sendDeviceCommand({ userId, deviceId, command })
  return toCommandToolResult(deviceId, output)
}

const listError = {
  ok: false as const,
  error: "Não foi possível consultar os dispositivos.",
}

const listDescription = [
  "Lista os dispositivos pareados à conta do usuário, incluindo os que estão offline.",
  "Use quando o usuário perguntar quais dispositivos estão conectados ou disponíveis.",
  "Retorna id, nome, hostname, plataforma, arquitetura, status e último contato.",
  "Use o id retornado nas tools de controle (device-open-url, device-open-app, device-list-apps, device-type-text e device-press-key).",
].join("\n")

const onlineListDescription = [
  "Lista apenas os dispositivos pareados que estão online agora (heartbeat nos últimos 45 segundos).",
  "Use antes de executar comandos para confirmar que o dispositivo alvo está disponível.",
].join("\n")

const openUrlDescription = [
  "Abre uma URL http:// ou https:// no navegador padrão de um dispositivo online.",
  "Informe o deviceId retornado por device-list ou device-online-list.",
  "A URL não pode conter credenciais (usuário/senha) nem usar outros protocolos.",
].join("\n")

const openAppDescription = [
  "Abre um aplicativo permitido em um dispositivo online.",
  "Informe o deviceId e um appId retornado por device-list-apps.",
  "Apenas aplicativos da allowlist do driver podem ser abertos.",
].join("\n")

const listAppsDescription = [
  "Lista os aplicativos que o driver permite abrir em um dispositivo online.",
  "Use antes de device-open-app para descobrir os appIds válidos.",
].join("\n")

const getOsDescription = [
  "Retorna informações do sistema operacional do dispositivo: plataforma, tipo, release, versão e arquitetura.",
  "Use quando o usuário precisar saber a versão do Windows, macOS ou Linux, ou quando a plataforma da listagem não for suficiente.",
  "Requer um dispositivo online e o deviceId retornado por device-list.",
].join("\n")

const typeTextDescription = [
  "Digita texto no aplicativo que está em foco no dispositivo.",
  "O driver envia as teclas para a janela ativa; ele não escolhe nem confirma qual janela está em foco.",
  "Confirme com o usuário antes de digitar conteúdo sensível e evite senhas.",
].join("\n")

const pressKeyDescription = [
  "Pressiona uma tecla ou combinação no dispositivo em foco.",
  "Teclas: letras a-z, dígitos 0-9, enter, tab, escape, backspace, delete, space, insert, setas, home, end, pageup, pagedown e f1-f12.",
  "Modificadores: ctrl, alt, shift e meta. As combinações alt+f4 e ctrl+alt+delete são bloqueadas.",
  "Use com cuidado: atalhos podem fechar janelas ou alterar o sistema.",
].join("\n")

const listFilesDescription = [
  "Lista arquivos e pastas de um dispositivo online.",
  "Informe o deviceId retornado por device-list ou device-online-list.",
  "O caminho padrão é a pasta de usuário do dispositivo. Use `depth` para navegar subpastas.",
  "O driver não segue links simbólicos e bloqueia caminhos sensíveis (credenciais, navegadores, sistema).",
  "O resultado é limitado a 200 itens; defina `truncated` quando houver mais.",
].join("\n")

const readFileDescription = [
  "Lê o conteúdo de texto de um arquivo em um dispositivo online.",
  "Use `device-list-files` ou `device-glob` para descobrir o caminho antes de ler.",
  "Retorna até 2000 linhas por chamada (máximo 64 KB). Use `offset` e `limit` para ler trechos seguintes.",
  "Não lê arquivos binários nem arquivos maiores que 1 MB.",
].join("\n")

const globDescription = [
  "Busca arquivos por padrão (glob) em um dispositivo online.",
  "Exemplo de padrão: `*.md`, `src/**/*.ts`, `Documentos/*.txt`.",
  "Retorna caminhos absolutos; limitado a 200 resultados.",
  "Ignora pastas grandes por padrão (node_modules, .git, dist, build, etc.) e caminhos bloqueados.",
].join("\n")

const grepDescription = [
  "Busca texto dentro de arquivos de um dispositivo online.",
  "Informe um padrão (expressão regular) e opcionalmente um caminho e um glob de arquivos.",
  "Retorna até 100 correspondências com arquivo, linha, coluna e trecho do texto.",
  "Não lê arquivos binários nem arquivos maiores que 1 MB.",
].join("\n")

const checkAdminDescription = [
  "Verifica se o dispositivo está rodando com privilégios de administrador.",
  "Use quando o usuário perguntar se o PC tem privilégios de adm.",
  "Retorna `admin: true/false`.",
].join("\n")

export function createDeviceTools(userId: string) {
  return {
    [DEVICE_LIST_TOOL_NAME]: tool({
      description: listDescription,
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const list = await listOwnedDevices(userId)

          return {
            ok: true as const,
            total: list.length,
            devices: list,
          }
        } catch {
          return listError
        }
      },
    }),
    [DEVICE_ONLINE_LIST_TOOL_NAME]: tool({
      description: onlineListDescription,
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const list = selectOnlineDevices(await listOwnedDevices(userId))

          return {
            ok: true as const,
            total: list.length,
            devices: list,
          }
        } catch {
          return listError
        }
      },
    }),
    [DEVICE_OPEN_URL_TOOL_NAME]: tool({
      description: openUrlDescription,
      inputSchema: deviceOpenUrlInputSchema,
      execute: async ({ deviceId, url }) =>
        runDeviceCommand(userId, deviceId, {
          command: "open-url",
          input: { url },
        }),
    }),
    [DEVICE_OPEN_APP_TOOL_NAME]: tool({
      description: openAppDescription,
      inputSchema: deviceOpenAppInputSchema,
      execute: async ({ deviceId, appId }) =>
        runDeviceCommand(userId, deviceId, {
          command: "open-app",
          input: { appId },
        }),
    }),
    [DEVICE_LIST_APPS_TOOL_NAME]: tool({
      description: listAppsDescription,
      inputSchema: deviceListAppsInputSchema,
      execute: async ({ deviceId }) =>
        runDeviceCommand(userId, deviceId, {
          command: "list-apps",
          input: {},
        }),
    }),
    [DEVICE_GET_OS_TOOL_NAME]: tool({
      description: getOsDescription,
      inputSchema: deviceGetOsInputSchema,
      execute: async ({ deviceId }) =>
        runDeviceCommand(userId, deviceId, {
          command: "get-os",
          input: {},
        }),
    }),
    [DEVICE_TYPE_TEXT_TOOL_NAME]: tool({
      description: typeTextDescription,
      inputSchema: deviceTypeTextInputSchema,
      needsApproval: true,
      execute: async ({ deviceId, text }) =>
        runDeviceCommand(userId, deviceId, {
          command: "type-text",
          input: { text },
        }),
    }),
    [DEVICE_PRESS_KEY_TOOL_NAME]: tool({
      description: pressKeyDescription,
      inputSchema: devicePressKeyInputSchema,
      needsApproval: true,
      execute: async ({ deviceId, key, modifiers }) =>
        runDeviceCommand(userId, deviceId, {
          command: "press-key",
          input: { key, modifiers: modifiers ?? [] },
        }),
    }),
    [DEVICE_LIST_FILES_TOOL_NAME]: tool({
      description: listFilesDescription,
      inputSchema: deviceListFilesInputSchema,
      execute: async ({ deviceId, ...input }) =>
        runDeviceCommand(userId, deviceId, {
          command: "list-files",
          input,
        }),
    }),
    [DEVICE_READ_FILE_TOOL_NAME]: tool({
      description: readFileDescription,
      inputSchema: deviceReadFileInputSchema,
      execute: async ({ deviceId, ...input }) =>
        runDeviceCommand(userId, deviceId, {
          command: "read-file",
          input,
        }),
    }),
    [DEVICE_GLOB_TOOL_NAME]: tool({
      description: globDescription,
      inputSchema: deviceGlobInputSchema,
      execute: async ({ deviceId, ...input }) =>
        runDeviceCommand(userId, deviceId, {
          command: "glob",
          input,
        }),
    }),
    [DEVICE_GREP_TOOL_NAME]: tool({
      description: grepDescription,
      inputSchema: deviceGrepInputSchema,
      execute: async ({ deviceId, ...input }) =>
        runDeviceCommand(userId, deviceId, {
          command: "grep",
          input,
        }),
    }),
    [DEVICE_CHECK_ADMIN_TOOL_NAME]: tool({
      description: checkAdminDescription,
      inputSchema: deviceCheckAdminInputSchema,
      execute: async ({ deviceId }) =>
        runDeviceCommand(userId, deviceId, {
          command: "check-admin",
          input: {},
        }),
    }),
  }
}
