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
  DEVICE_APP_QUERY_MAX_LENGTH,
  DEVICE_APP_RESULTS_MAX,
  DEVICE_APP_RESULTS_DEFAULT,
  DEVICE_APP_ARGS_MAX,
  DEVICE_APP_ARG_MAX_LENGTH,
  DEVICE_APP_NAME_MAX_LENGTH,
  DEVICE_JOB_ID_MAX_LENGTH,
  DEVICE_JOB_LABEL_MAX_LENGTH,
  DEVICE_JOB_MAX_RUNTIME_DEFAULT_MS,
  DEVICE_JOB_MAX_RUNTIME_MS,
  DEVICE_JOB_MAX_RUNTIME_MIN_MS,
  DEVICE_JOB_OUTPUT_DEFAULT_BYTES,
  DEVICE_JOB_OUTPUT_MAX_BYTES,
  DEVICE_JOB_OUTPUT_MIN_BYTES,
  DEVICE_JOB_WAIT_DEFAULT_MS,
  DEVICE_JOB_WAIT_MAX_MS,
  DEVICE_JOB_WAIT_MIN_MS,
  DEVICE_KEYS,
  DEVICE_KEY_MODIFIERS,
  DEVICE_TEXT_MAX_LENGTH,
  DEVICE_CLIPBOARD_TEXT_MAX_LENGTH,
  DEVICE_MOUSE_COORD_MIN,
  DEVICE_MOUSE_COORD_MAX,
  DEVICE_MOUSE_BUTTONS,
  DEVICE_MOUSE_CLICK_COUNT_MIN,
  DEVICE_MOUSE_CLICK_COUNT_MAX,
  DEVICE_MOUSE_CLICK_COUNT_DEFAULT,
  DEVICE_MOUSE_SCROLL_DIRECTIONS,
  DEVICE_MOUSE_SCROLL_AMOUNT_MIN,
  DEVICE_MOUSE_SCROLL_AMOUNT_MAX,
  DEVICE_MOUSE_SCROLL_AMOUNT_DEFAULT,
  DEVICE_MOUSE_DRAG_DURATION_MIN_MS,
  DEVICE_MOUSE_DRAG_DURATION_MAX_MS,
  DEVICE_MOUSE_DRAG_DURATION_DEFAULT_MS,
  DEVICE_URL_MAX_LENGTH,
  DEVICE_PATH_MAX_LENGTH,
  DEVICE_PATTERN_MAX_LENGTH,
  isAbsoluteAppPath,
  hasAppPathExtension,
  hasBlockedOpenPathExtension,
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
  DEVICE_FILE_WRITE_MAX_BYTES,
  DEVICE_FILE_EDIT_MAX_OLD_TEXT,
  DEVICE_FILE_EDIT_MAX_NEW_TEXT,
  DEVICE_FILE_PATCH_MAX_COUNT,
  DEVICE_RUN_TIMEOUT_DEFAULT_MS,
  DEVICE_RUN_TIMEOUT_MAX_MS,
  DEVICE_RUN_ARGS_MAX_LENGTH,
  DEVICE_SHELL_KINDS,
  DEVICE_SHELL_SCRIPT_MAX_LENGTH,
  DEVICE_SHELL_STDIN_MAX_LENGTH,
  DEVICE_SHELL_TIMEOUT_MIN_MS,
  DEVICE_SHELL_TIMEOUT_MAX_MS,
  DEVICE_SHELL_TIMEOUT_DEFAULT_MS,
  DEVICE_SHELL_OUTPUT_MIN_BYTES,
  DEVICE_SHELL_OUTPUT_MAX_BYTES,
  DEVICE_SHELL_OUTPUT_DEFAULT_BYTES,
  DEVICE_SHELL_ENV_NAME_MAX_LENGTH,
  DEVICE_SHELL_ENV_VALUE_MAX_LENGTH,
  DEVICE_SCREENSHOT_FORMATS,
  DEVICE_SCREENSHOT_MAX_WIDTH_MIN,
  DEVICE_SCREENSHOT_MAX_WIDTH_MAX,
  DEVICE_SCREENSHOT_MAX_WIDTH_DEFAULT,
  DEVICE_SCREENSHOT_QUALITY_MIN,
  DEVICE_SCREENSHOT_QUALITY_MAX,
  DEVICE_SCREENSHOT_QUALITY_DEFAULT,
  DEVICE_SCREENSHOT_MONITOR_MAX,
  DEVICE_SCREENSHOT_NORMALIZED_COORD_MAX,
  DEVICE_WINDOW_ID_MAX_LENGTH,
  DEVICE_WINDOW_ID_PATTERN,
  DEVICE_WINDOW_LIMIT_DEFAULT,
  DEVICE_WINDOW_LIMIT_MAX,
  DEVICE_WINDOW_LIMIT_MIN,
  DEVICE_WINDOW_ACTIONS,
  DEVICE_UI_ACTIONS,
  DEVICE_UI_FIND_MAX_LENGTH,
  DEVICE_UI_ROLE_MAX_LENGTH,
  DEVICE_UI_RESULTS_MIN,
  DEVICE_UI_RESULTS_MAX,
  DEVICE_UI_RESULTS_DEFAULT,
  DEVICE_UI_DEPTH_MIN,
  DEVICE_UI_DEPTH_MAX,
  DEVICE_UI_DEPTH_DEFAULT,
  DEVICE_UI_WAIT_MIN_MS,
  DEVICE_UI_WAIT_MAX_MS,
  DEVICE_UI_WAIT_DEFAULT_MS,
  DEVICE_UI_VALUE_MAX_LENGTH,
  DEVICE_UI_RUNTIME_ID_MAX_LENGTH,
  DEVICE_UI_RUNTIME_ID_PATTERN,
  isAllowedDeviceUrl,
  isBlockedKeyCombination,
  deviceCommandTimeoutMs,
  parseDeviceCommand,
  type DeviceCommand,
  type DeviceKey,
  type DeviceKeyModifier,
  type DeviceMouseButton,
  type DeviceMouseScrollDirection,
  type DeviceUiAction,
  type DeviceWindowAction,
} from "@/lib/devices/commands"
import {
  classifyDeviceToolRisk,
  parseDeviceExecutionPolicy,
  type ChatExecutionMode,
} from "@/lib/devices/execution-policy"
import { recordDeviceAudit } from "@/lib/devices/audit"
import {
  assertDeviceCommandAllowed,
  describeAuditPolicy,
  readDeviceToolCommand,
} from "@/lib/devices/tool-approval"
import {
  getScreenshot,
  getScreenshotMetadata,
  saveScreenshot,
} from "@/lib/devices/screenshot-store"
import {
  DEVICE_SCREENSHOT_TOOL_NAME,
  type DeviceScreenshotToolOutput,
} from "@/lib/devices/screenshot-tool"
import { isDeviceOnline, type DeviceStatus } from "@/lib/devices/types"

export { DEVICE_SCREENSHOT_TOOL_NAME }

export const DEVICE_LIST_TOOL_NAME = "device-list"
export const DEVICE_ONLINE_LIST_TOOL_NAME = "device-online-list"
export const DEVICE_OPEN_URL_TOOL_NAME = "device-open-url"
export const DEVICE_OPEN_APP_TOOL_NAME = "device-open-app"
export const DEVICE_OPEN_PATH_TOOL_NAME = "device-open-path"
export const DEVICE_REGISTER_APP_TOOL_NAME = "device-register-app"
export const DEVICE_REMOVE_APP_TOOL_NAME = "device-remove-app"
export const DEVICE_LIST_APPS_TOOL_NAME = "device-list-apps"
export const DEVICE_FIND_APP_TOOL_NAME = "device-find-app"
export const DEVICE_GET_OS_TOOL_NAME = "device-get-os"
export const DEVICE_TYPE_TEXT_TOOL_NAME = "device-type-text"
export const DEVICE_PRESS_KEY_TOOL_NAME = "device-press-key"
export const DEVICE_READ_CLIPBOARD_TOOL_NAME = "device-read-clipboard"
export const DEVICE_WRITE_CLIPBOARD_TOOL_NAME = "device-write-clipboard"
export const DEVICE_MOVE_MOUSE_TOOL_NAME = "device-move-mouse"
export const DEVICE_CLICK_TOOL_NAME = "device-click"
export const DEVICE_SCROLL_TOOL_NAME = "device-scroll"
export const DEVICE_DRAG_TOOL_NAME = "device-drag"
export const DEVICE_LIST_FILES_TOOL_NAME = "device-list-files"
export const DEVICE_READ_FILE_TOOL_NAME = "device-read-file"
export const DEVICE_GLOB_TOOL_NAME = "device-glob"
export const DEVICE_GREP_TOOL_NAME = "device-grep"
export const DEVICE_CHECK_ADMIN_TOOL_NAME = "device-check-admin"
export const DEVICE_WRITE_FILE_TOOL_NAME = "device-write-file"
export const DEVICE_EDIT_FILE_TOOL_NAME = "device-edit-file"
export const DEVICE_MKDIR_TOOL_NAME = "device-mkdir"
export const DEVICE_STAT_TOOL_NAME = "device-stat"
export const DEVICE_COPY_TOOL_NAME = "device-copy"
export const DEVICE_MOVE_TOOL_NAME = "device-move"
export const DEVICE_DELETE_TOOL_NAME = "device-delete"
export const DEVICE_APPLY_PATCH_TOOL_NAME = "device-apply-patch"
export const DEVICE_RUN_COMMAND_TOOL_NAME = "device-run-command"
export const DEVICE_ENV_TOOL_NAME = "device-env"
export const DEVICE_SHELL_TOOL_NAME = "device-shell"
export const DEVICE_JOB_START_TOOL_NAME = "device-job-start"
export const DEVICE_JOB_STATUS_TOOL_NAME = "device-job-status"
export const DEVICE_JOB_OUTPUT_TOOL_NAME = "device-job-output"
export const DEVICE_JOB_CANCEL_TOOL_NAME = "device-job-cancel"
export const DEVICE_JOB_LIST_TOOL_NAME = "device-job-list"
export const DEVICE_LIST_WINDOWS_TOOL_NAME = "device-list-windows"
export const DEVICE_FOCUS_WINDOW_TOOL_NAME = "device-focus-window"
export const DEVICE_WINDOW_ACTION_TOOL_NAME = "device-window-action"
export const DEVICE_INSPECT_UI_TOOL_NAME = "device-inspect-ui"
export const DEVICE_UI_ACTION_TOOL_NAME = "device-ui-action"

const SCREENSHOT_COMMAND_TIMEOUT_MS = 30_000

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

const deviceAppArgSchema = z
  .string()
  .min(1)
  .max(DEVICE_APP_ARG_MAX_LENGTH)
  .refine((value) => !/[\u0000-\u001f\u007f]/.test(value), {
    message: "O argumento não pode conter caracteres de controle.",
  })

const deviceAppArgsSchema = z
  .array(deviceAppArgSchema)
  .max(DEVICE_APP_ARGS_MAX)
  .describe(
    "Argumentos de linha de comando passados ao app, um por item (ex.: [\".\"] para `zed .`). Use apenas quando o usuário pedir para abrir algo específico.",
  )

const deviceAppCwdSchema = z
  .string()
  .trim()
  .min(1)
  .max(DEVICE_PATH_MAX_LENGTH)
  .refine(isAbsoluteAppPath, {
    message: "Use um caminho absoluto para o diretório de trabalho.",
  })
  .describe(
    "Diretório de trabalho do app. Passe o projeto/pasta quando usar argumentos como `.`.",
  )

const deviceAppPathSchema = z
  .string()
  .trim()
  .min(1)
  .max(DEVICE_PATH_MAX_LENGTH)
  .refine(isAbsoluteAppPath, {
    message: "Use um caminho absoluto para o executável ou atalho.",
  })

export const deviceOpenAppInputSchema = z
  .object({
    deviceId: deviceIdSchema,
    appId: z
      .string()
      .regex(DEVICE_APP_ID_PATTERN, "Identificador de aplicativo inválido.")
      .optional()
      .describe(
        "Id do aplicativo retornado por device-list-apps ou device-find-app.",
      ),
    path: deviceAppPathSchema
      .optional()
      .describe(
        "Caminho absoluto do executável ou atalho, para apps fora da descoberta automática.",
      ),
    args: deviceAppArgsSchema.optional(),
    cwd: deviceAppCwdSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if ((value.appId === undefined) === (value.path === undefined)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Informe "appId" ou "path", mas não os dois.',
        path: ["appId"],
      })
    }
  })

export const deviceOpenPathInputSchema = z.object({
  deviceId: deviceIdSchema,
  path: z
    .string()
    .trim()
    .min(1)
    .max(DEVICE_PATH_MAX_LENGTH)
    .refine(isAbsoluteAppPath, {
      message: "Use um caminho absoluto para o arquivo ou pasta.",
    })
    .refine((value) => !hasAppPathExtension(value), {
      message:
        "Arquivos executáveis devem ser abertos com device-open-app, que pede aprovação.",
    })
    .refine((value) => !hasBlockedOpenPathExtension(value), {
      message:
        "Scripts e instaladores devem ser abertos com device-open-app, que pede aprovação.",
    })
    .describe("Caminho absoluto de um arquivo ou pasta a abrir no app padrão."),
})

export const deviceRegisterAppInputSchema = z.object({
  deviceId: deviceIdSchema,
  name: z
    .string()
    .trim()
    .min(1)
    .max(DEVICE_APP_NAME_MAX_LENGTH)
    .describe("Nome amigável do aplicativo no catálogo do dispositivo."),
  path: deviceAppPathSchema.describe(
    "Caminho absoluto do executável ou atalho existente no dispositivo.",
  ),
  args: deviceAppArgsSchema
    .optional()
    .describe("Argumentos padrão usados quando este app for aberto."),
  cwd: deviceAppCwdSchema
    .optional()
    .describe("Diretório de trabalho padrão deste app."),
})

export const deviceRemoveAppInputSchema = z.object({
  deviceId: deviceIdSchema,
  appId: z
    .string()
    .regex(DEVICE_APP_ID_PATTERN, "Identificador de aplicativo inválido.")
    .describe("Id do app no catálogo do dispositivo."),
})

export const deviceListAppsInputSchema = z.object({
  deviceId: deviceIdSchema,
  query: z
    .string()
    .trim()
    .max(DEVICE_APP_QUERY_MAX_LENGTH)
    .optional()
    .describe("Filtra por nome, id ou caminho do aplicativo."),
  refresh: z
    .boolean()
    .optional()
    .describe(
      "Refaz a descoberta de apps instalados (Menu Iniciar e App Paths) em vez de usar o cache.",
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(DEVICE_APP_RESULTS_MAX)
    .default(DEVICE_APP_RESULTS_DEFAULT)
    .describe("Máximo de aplicativos retornados."),
})

export const deviceFindAppInputSchema = z.object({
  deviceId: deviceIdSchema,
  query: z
    .string()
    .trim()
    .min(1)
    .max(DEVICE_APP_QUERY_MAX_LENGTH)
    .describe("Nome, id ou parte do caminho do aplicativo procurado."),
  refresh: z
    .boolean()
    .optional()
    .describe("Refaz a descoberta de apps instalados em vez de usar o cache."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(DEVICE_APP_RESULTS_MAX)
    .default(10)
    .describe("Máximo de correspondências retornadas."),
})

export const deviceGetOsInputSchema = z.object({
  deviceId: deviceIdSchema,
})

export const deviceEnvInputSchema = z.object({
  deviceId: deviceIdSchema,
})

const deviceWindowIdSchema = z
  .string()
  .min(1)
  .max(DEVICE_WINDOW_ID_MAX_LENGTH)
  .regex(DEVICE_WINDOW_ID_PATTERN, "Identificador de janela inválido.")

export const deviceTypeTextInputSchema = z.object({
  deviceId: deviceIdSchema,
  text: z.string().min(1).max(DEVICE_TEXT_MAX_LENGTH),
  windowId: deviceWindowIdSchema
    .optional()
    .describe(
      "Id da janela retornado por device-list-windows. Quando informado, o driver foca a janela antes de digitar.",
    ),
})

export const devicePressKeyInputSchema = z
  .object({
    deviceId: deviceIdSchema,
    key: deviceKeySchema,
    modifiers: z.array(deviceModifierSchema).max(4).optional(),
    windowId: deviceWindowIdSchema
      .optional()
      .describe(
        "Id da janela retornado por device-list-windows. Quando informado, o driver foca a janela antes de pressionar a tecla.",
      ),
  })
  .refine(
    (value) => !isBlockedKeyCombination(value.key, value.modifiers ?? []),
    {
      message: "Esta combinação de teclas é bloqueada por segurança.",
      path: ["key"],
    },
  )

const clipboardControlCharacters = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/

export const deviceReadClipboardInputSchema = z.object({
  deviceId: deviceIdSchema,
})

export const deviceWriteClipboardInputSchema = z.object({
  deviceId: deviceIdSchema,
  text: z
    .string()
    .min(1)
    .max(DEVICE_CLIPBOARD_TEXT_MAX_LENGTH)
    .refine((value) => !clipboardControlCharacters.test(value), {
      message: "O texto contém caracteres de controle não suportados.",
    })
    .describe(
      "Texto que substituirá o conteúdo atual da área de transferência.",
    ),
})

const deviceMouseCoordinateSchema = z
  .number()
  .int()
  .min(DEVICE_MOUSE_COORD_MIN)
  .max(DEVICE_MOUSE_COORD_MAX)

const deviceMouseButtonSchema = z.enum(
  DEVICE_MOUSE_BUTTONS as unknown as [DeviceMouseButton, ...DeviceMouseButton[]],
)

const deviceMouseScrollDirectionSchema = z.enum(
  DEVICE_MOUSE_SCROLL_DIRECTIONS as unknown as [
    DeviceMouseScrollDirection,
    ...DeviceMouseScrollDirection[],
  ],
)

const deviceMousePointSchema = z.object({
  x: deviceMouseCoordinateSchema,
  y: deviceMouseCoordinateSchema,
})

const screenshotIdSchema = z
  .string()
  .min(8)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/, "Identificador de captura inválido.")
  .describe(
    "Id da captura retornada por device-screenshot. Nas tools de mouse, x/y passam a ser normalizados de 0 a 1000. Em device-screenshot, use junto com region normalizado para recortar/ampliar.",
  )

const mouseCoordinateDescription =
  "Com `screenshotId`: inteiro normalizado de 0 a 1000 na imagem (0 = borda esquerda/topo, 1000 = borda direita/baixo). Sem `screenshotId`: pixel nativo do sistema."

function withOptionalPointPair<T extends z.ZodRawShape>(shape: T) {
  return z.object(shape).superRefine((value, ctx) => {
    const candidate = value as {
      x?: number
      y?: number
      screenshotId?: string
    }
    const hasX = candidate.x !== undefined
    const hasY = candidate.y !== undefined

    if (hasX !== hasY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Informe "x" e "y" juntos ou omita os dois.',
        path: ["x"],
      })
      return
    }

    if (candidate.screenshotId !== undefined && !hasX) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Ao usar "screenshotId", informe também "x" e "y" normalizados de 0 a 1000.',
        path: ["screenshotId"],
      })
    }
  })
}

export const deviceMoveMouseInputSchema = z.object({
  deviceId: deviceIdSchema,
  x: deviceMouseCoordinateSchema.describe(mouseCoordinateDescription),
  y: deviceMouseCoordinateSchema.describe(mouseCoordinateDescription),
  screenshotId: screenshotIdSchema.optional(),
})

export const deviceClickInputSchema = withOptionalPointPair({
  deviceId: deviceIdSchema,
  x: deviceMouseCoordinateSchema.optional().describe(
    `Coordenada X para mover o cursor antes do clique. ${mouseCoordinateDescription}`,
  ),
  y: deviceMouseCoordinateSchema.optional().describe(
    `Coordenada Y para mover o cursor antes do clique. ${mouseCoordinateDescription}`,
  ),
  screenshotId: screenshotIdSchema.optional(),
  button: deviceMouseButtonSchema
    .default("left")
    .describe("Botão do mouse: left, right ou middle."),
  count: z
    .number()
    .int()
    .min(DEVICE_MOUSE_CLICK_COUNT_MIN)
    .max(DEVICE_MOUSE_CLICK_COUNT_MAX)
    .default(DEVICE_MOUSE_CLICK_COUNT_DEFAULT)
    .describe("Número de cliques: 1 (padrão), 2 ou 3."),
})

export const deviceScrollInputSchema = withOptionalPointPair({
  deviceId: deviceIdSchema,
  x: deviceMouseCoordinateSchema.optional().describe(
    `Coordenada X para posicionar o cursor antes de rolar. ${mouseCoordinateDescription}`,
  ),
  y: deviceMouseCoordinateSchema.optional().describe(
    `Coordenada Y para posicionar o cursor antes de rolar. ${mouseCoordinateDescription}`,
  ),
  screenshotId: screenshotIdSchema.optional(),
  direction: deviceMouseScrollDirectionSchema.describe(
    "Direção da rolagem: up, down, left ou right.",
  ),
  amount: z
    .number()
    .int()
    .min(DEVICE_MOUSE_SCROLL_AMOUNT_MIN)
    .max(DEVICE_MOUSE_SCROLL_AMOUNT_MAX)
    .default(DEVICE_MOUSE_SCROLL_AMOUNT_DEFAULT)
    .describe("Quantidade de passos de rolagem (1–50, padrão 3)."),
})

export const deviceDragInputSchema = z.object({
  deviceId: deviceIdSchema,
  from: deviceMousePointSchema.describe(
    `Ponto inicial do arrasto. ${mouseCoordinateDescription}`,
  ),
  to: deviceMousePointSchema.describe(
    `Ponto final do arrasto. ${mouseCoordinateDescription}`,
  ),
  screenshotId: screenshotIdSchema.optional(),
  button: deviceMouseButtonSchema
    .default("left")
    .describe("Botão mantido durante o arrasto: left, right ou middle."),
  durationMs: z
    .number()
    .int()
    .min(DEVICE_MOUSE_DRAG_DURATION_MIN_MS)
    .max(DEVICE_MOUSE_DRAG_DURATION_MAX_MS)
    .default(DEVICE_MOUSE_DRAG_DURATION_DEFAULT_MS)
    .describe("Duração do arrasto em milissegundos (100–10.000)."),
})

export const deviceListWindowsInputSchema = z.object({
  deviceId: deviceIdSchema,
  includeMinimized: z.boolean().default(false),
  limit: z
    .number()
    .int()
    .min(DEVICE_WINDOW_LIMIT_MIN)
    .max(DEVICE_WINDOW_LIMIT_MAX)
    .default(DEVICE_WINDOW_LIMIT_DEFAULT),
})

export const deviceFocusWindowInputSchema = z.object({
  deviceId: deviceIdSchema,
  windowId: deviceWindowIdSchema,
})

const deviceWindowActionSchema = z.enum(
  DEVICE_WINDOW_ACTIONS as unknown as [
    DeviceWindowAction,
    ...DeviceWindowAction[],
  ],
)

export const deviceWindowActionInputSchema = z.object({
  deviceId: deviceIdSchema,
  windowId: deviceWindowIdSchema,
  action: deviceWindowActionSchema.describe(
    "Ação a aplicar na janela: minimize, maximize, restore ou close.",
  ),
})

const deviceUiRoleSchema = z
  .string()
  .min(1)
  .max(DEVICE_UI_ROLE_MAX_LENGTH)
  .regex(
    /^[A-Za-z][A-Za-z0-9]{0,39}$/,
    "Use o papel sem o prefixo ControlType, como Button ou TabItem.",
  )

const deviceUiRuntimeIdSchema = z
  .string()
  .min(1)
  .max(DEVICE_UI_RUNTIME_ID_MAX_LENGTH)
  .regex(DEVICE_UI_RUNTIME_ID_PATTERN, "runtimeId inválido.")

export const deviceInspectUiInputSchema = z.object({
  deviceId: deviceIdSchema,
  windowId: deviceWindowIdSchema.describe(
    "Id da janela retornado por device-list-windows.",
  ),
  find: z
    .string()
    .min(1)
    .max(DEVICE_UI_FIND_MAX_LENGTH)
    .optional()
    .describe(
      "Filtra por trecho do nome ou AutomationId do controle, sem diferenciar maiúsculas.",
    ),
  role: deviceUiRoleSchema.optional().describe(
    "Filtra pelo papel do controle, como Button, TabItem, MenuItem, Edit ou CheckBox.",
  ),
  maxResults: z
    .number()
    .int()
    .min(DEVICE_UI_RESULTS_MIN)
    .max(DEVICE_UI_RESULTS_MAX)
    .default(DEVICE_UI_RESULTS_DEFAULT)
    .describe("Número máximo de elementos retornados (1–100, padrão 40)."),
  depth: z
    .number()
    .int()
    .min(DEVICE_UI_DEPTH_MIN)
    .max(DEVICE_UI_DEPTH_MAX)
    .default(DEVICE_UI_DEPTH_DEFAULT)
    .describe("Profundidade máxima da árvore de acessibilidade (1–12, padrão 10)."),
  includeOffscreen: z
    .boolean()
    .default(false)
    .describe("Inclui controles fora da área visível da janela."),
  waitMs: z
    .number()
    .int()
    .min(DEVICE_UI_WAIT_MIN_MS)
    .max(DEVICE_UI_WAIT_MAX_MS)
    .default(0)
    .describe(
      "Tempo máximo, em ms, para o resultado aparecer (0–10000, padrão 0). Use 2000 quando o alvo renderiza depois, como um menu abrindo ou uma pasta carregando.",
    ),
})

const deviceUiActionSchema = z.enum(
  DEVICE_UI_ACTIONS as unknown as [DeviceUiAction, ...DeviceUiAction[]],
)

export const deviceUiActionInputSchema = z.object({
  deviceId: deviceIdSchema,
  windowId: deviceWindowIdSchema.describe(
    "Id da janela usado na inspeção que retornou o runtimeId.",
  ),
  runtimeId: deviceUiRuntimeIdSchema.describe(
    "runtimeId exato retornado por device-inspect-ui. Vale apenas enquanto o elemento existir.",
  ),
  action: deviceUiActionSchema
    .default("invoke")
    .describe(
      "Ação de acessibilidade: invoke, select, toggle, expand, collapse, focus ou setValue.",
    ),
  value: z
    .string()
    .max(DEVICE_UI_VALUE_MAX_LENGTH)
    .optional()
    .describe(
      'Texto a escrever no controle. Obrigatório quando action é "setValue"; use "" para limpar o campo.',
    ),
  waitMs: z
    .number()
    .int()
    .min(DEVICE_UI_WAIT_MIN_MS)
    .max(DEVICE_UI_WAIT_MAX_MS)
    .default(DEVICE_UI_WAIT_DEFAULT_MS)
    .describe(
      "Tempo máximo, em ms, para reencontrar o runtimeId antes de desistir (0–10000, padrão 1500).",
    ),
})

const deviceScreenshotRegionSchema = z.object({
  x: z.number().int().min(-100_000).max(100_000),
  y: z.number().int().min(-100_000).max(100_000),
  width: z.number().int().min(1).max(100_000),
  height: z.number().int().min(1).max(100_000),
})

const deviceScreenshotFormatSchema = z.enum(
  DEVICE_SCREENSHOT_FORMATS as unknown as ["jpeg", "png"],
)

export const deviceScreenshotInputSchema = z
  .object({
    deviceId: deviceIdSchema,
    monitor: z
      .number()
      .int()
      .min(0)
      .max(DEVICE_SCREENSHOT_MONITOR_MAX)
      .optional()
      .describe(
        "Índice do monitor (0 = primeiro). Sem monitor, region nem windowId, captura a tela inteira virtual.",
      ),
    region: deviceScreenshotRegionSchema
      .optional()
      .describe(
        "Retângulo do alvo. Sem `screenshotId`, usa pixels nativos do sistema. Com `screenshotId`, usa coordenadas normalizadas inteiras de 0 a 1000 na captura de referência.",
      ),
    windowId: deviceWindowIdSchema
      .optional()
      .describe(
        "Id de uma janela retornada por device-list-windows. O driver foca a janela e captura apenas os limites dela no mesmo comando.",
      ),
    screenshotId: screenshotIdSchema
      .optional()
      .describe(
        "Captura de referência para interpretar `region` em coordenadas normalizadas 0–1000. Use para recortar e ampliar um alvo pequeno.",
      ),
    maxWidth: z
      .number()
      .int()
      .min(DEVICE_SCREENSHOT_MAX_WIDTH_MIN)
      .max(DEVICE_SCREENSHOT_MAX_WIDTH_MAX)
      .default(DEVICE_SCREENSHOT_MAX_WIDTH_DEFAULT)
      .describe(
        "Largura máxima da imagem final em pixels. Em capturas de região, o servidor eleva o valor até a largura nativa da região para não perder detalhe.",
      ),
    quality: z
      .number()
      .int()
      .min(DEVICE_SCREENSHOT_QUALITY_MIN)
      .max(DEVICE_SCREENSHOT_QUALITY_MAX)
      .default(DEVICE_SCREENSHOT_QUALITY_DEFAULT)
      .describe("Qualidade JPEG (30–90). Ignorada em PNG."),
    format: deviceScreenshotFormatSchema
      .default("jpeg")
      .describe("Formato da imagem: jpeg (padrão e menor) ou png."),
  })
  .superRefine((value, ctx) => {
    const targets = [
      value.monitor !== undefined,
      value.region !== undefined,
      value.windowId !== undefined,
    ].filter(Boolean).length

    if (targets > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Use apenas um alvo por captura: windowId, monitor ou region.",
        path: ["region"],
      })
    }

    if (value.screenshotId !== undefined && value.region === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Ao usar "screenshotId" para recorte, informe também "region" normalizado de 0 a 1000.',
        path: ["screenshotId"],
      })
    }
  })

type NativeMousePoint = { x: number; y: number }

type ResolvedMousePoints =
  | { ok: true; points: NativeMousePoint[] }
  | { ok: false; code: string; error: string }

type ScreenshotRegionInput = {
  x: number
  y: number
  width: number
  height: number
}

type ResolvedScreenshotRegion =
  | { ok: true; region: ScreenshotRegionInput | undefined }
  | { ok: false; code: string; error: string }

function clampCoordinate(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

async function resolveScreenshotRegion(
  deviceId: string,
  screenshotId: string | undefined,
  region: ScreenshotRegionInput | undefined,
): Promise<ResolvedScreenshotRegion> {
  if (!screenshotId) {
    return { ok: true, region }
  }

  if (!region) {
    return {
      ok: false,
      code: "invalid_region",
      error:
        'Ao usar "screenshotId" para recorte, informe também "region" normalizado de 0 a 1000.',
    }
  }

  const metadata = await getScreenshotMetadata(screenshotId)

  if (!metadata) {
    return {
      ok: false,
      code: "screenshot_not_found",
      error:
        "A captura de referência não existe ou expirou. Capture a tela novamente antes de recortar.",
    }
  }

  if (metadata.deviceId !== deviceId) {
    return {
      ok: false,
      code: "screenshot_device_mismatch",
      error:
        "A captura de referência pertence a outro dispositivo. Use o deviceId correto ou capture a tela novamente.",
    }
  }

  const values = [region.x, region.y, region.width, region.height]

  if (
    values.some(
      (value) =>
        !Number.isInteger(value) ||
        value < 0 ||
        value > DEVICE_SCREENSHOT_NORMALIZED_COORD_MAX,
    ) ||
    region.width <= 0 ||
    region.height <= 0 ||
    region.x + region.width > DEVICE_SCREENSHOT_NORMALIZED_COORD_MAX ||
    region.y + region.height > DEVICE_SCREENSHOT_NORMALIZED_COORD_MAX
  ) {
    return {
      ok: false,
      code: "invalid_region",
      error: `Com "screenshotId", use region normalizado inteiro de 0 a ${DEVICE_SCREENSHOT_NORMALIZED_COORD_MAX}, com width/height maiores que zero e sem passar da borda.`,
    }
  }

  const native: ScreenshotRegionInput = {
    x: Math.round(
      metadata.region.x +
        (region.x * metadata.region.width) /
          DEVICE_SCREENSHOT_NORMALIZED_COORD_MAX,
    ),
    y: Math.round(
      metadata.region.y +
        (region.y * metadata.region.height) /
          DEVICE_SCREENSHOT_NORMALIZED_COORD_MAX,
    ),
    width: Math.max(
      1,
      Math.round(
        (region.width * metadata.region.width) /
          DEVICE_SCREENSHOT_NORMALIZED_COORD_MAX,
      ),
    ),
    height: Math.max(
      1,
      Math.round(
        (region.height * metadata.region.height) /
          DEVICE_SCREENSHOT_NORMALIZED_COORD_MAX,
      ),
    ),
  }

  native.x = clampCoordinate(
    native.x,
    metadata.region.x,
    metadata.region.x + metadata.region.width - 1,
  )
  native.y = clampCoordinate(
    native.y,
    metadata.region.y,
    metadata.region.y + metadata.region.height - 1,
  )
  native.width = Math.min(
    native.width,
    metadata.region.x + metadata.region.width - native.x,
  )
  native.height = Math.min(
    native.height,
    metadata.region.y + metadata.region.height - native.y,
  )

  return { ok: true, region: native }
}

async function resolveMousePoints(
  deviceId: string,
  screenshotId: string | undefined,
  points: readonly NativeMousePoint[],
): Promise<ResolvedMousePoints> {
  if (!screenshotId) {
    return { ok: true, points: [...points] }
  }

  const metadata = await getScreenshotMetadata(screenshotId)

  if (!metadata) {
    return {
      ok: false,
      code: "screenshot_not_found",
      error:
        "A captura informada não existe ou expirou. Capture a tela novamente antes de usar as coordenadas.",
    }
  }

  if (metadata.deviceId !== deviceId) {
    return {
      ok: false,
      code: "screenshot_device_mismatch",
      error:
        "A captura pertence a outro dispositivo. Use o deviceId correto ou capture a tela novamente.",
    }
  }

  const converted: NativeMousePoint[] = []

  for (const point of points) {
    if (
      !Number.isInteger(point.x) ||
      !Number.isInteger(point.y) ||
      point.x < 0 ||
      point.y < 0 ||
      point.x > DEVICE_SCREENSHOT_NORMALIZED_COORD_MAX ||
      point.y > DEVICE_SCREENSHOT_NORMALIZED_COORD_MAX
    ) {
      return {
        ok: false,
        code: "invalid_coordinates",
        error: `Com "screenshotId", use coordenadas normalizadas inteiras de 0 a ${DEVICE_SCREENSHOT_NORMALIZED_COORD_MAX}. Recebido (${point.x}, ${point.y}).`,
      }
    }

    const nativeX = Math.round(
      metadata.region.x +
        (point.x * metadata.region.width) /
          DEVICE_SCREENSHOT_NORMALIZED_COORD_MAX,
    )
    const nativeY = Math.round(
      metadata.region.y +
        (point.y * metadata.region.height) /
          DEVICE_SCREENSHOT_NORMALIZED_COORD_MAX,
    )

    converted.push({
      x: clampCoordinate(
        nativeX,
        metadata.region.x,
        metadata.region.x + metadata.region.width - 1,
      ),
      y: clampCoordinate(
        nativeY,
        metadata.region.y,
        metadata.region.y + metadata.region.height - 1,
      ),
    })
  }

  return { ok: true, points: converted }
}

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

export const deviceWriteFileInputSchema = z.object({
  deviceId: deviceIdSchema,
  path: z.string().max(DEVICE_PATH_MAX_LENGTH),
  content: z.string().max(DEVICE_FILE_WRITE_MAX_BYTES),
})

export const deviceEditFileInputSchema = z.object({
  deviceId: deviceIdSchema,
  path: z.string().max(DEVICE_PATH_MAX_LENGTH),
  oldText: z.string().max(DEVICE_FILE_EDIT_MAX_OLD_TEXT),
  newText: z.string().max(DEVICE_FILE_EDIT_MAX_NEW_TEXT),
})

export const deviceMkdirInputSchema = z.object({
  deviceId: deviceIdSchema,
  path: z.string().min(1).max(DEVICE_PATH_MAX_LENGTH),
  recursive: z
    .boolean()
    .default(true)
    .describe("Cria os diretórios intermediários que faltarem."),
})

export const deviceStatInputSchema = z.object({
  deviceId: deviceIdSchema,
  path: z.string().min(1).max(DEVICE_PATH_MAX_LENGTH),
})

export const deviceCopyInputSchema = z.object({
  deviceId: deviceIdSchema,
  from: z.string().min(1).max(DEVICE_PATH_MAX_LENGTH),
  to: z.string().min(1).max(DEVICE_PATH_MAX_LENGTH),
  overwrite: z
    .boolean()
    .default(false)
    .describe("Substitui arquivos já existentes no destino."),
  recursive: z
    .boolean()
    .default(true)
    .describe("Copia diretórios inteiros, arquivo por arquivo."),
})

export const deviceMoveInputSchema = z.object({
  deviceId: deviceIdSchema,
  from: z.string().min(1).max(DEVICE_PATH_MAX_LENGTH),
  to: z.string().min(1).max(DEVICE_PATH_MAX_LENGTH),
  overwrite: z
    .boolean()
    .default(false)
    .describe("Substitui um arquivo já existente no destino."),
})

export const deviceDeleteInputSchema = z.object({
  deviceId: deviceIdSchema,
  path: z.string().min(1).max(DEVICE_PATH_MAX_LENGTH),
  recursive: z
    .boolean()
    .default(false)
    .describe("Apaga diretórios com conteúdo."),
  permanent: z
    .boolean()
    .default(false)
    .describe(
      "Apaga de vez em vez de mover para a lixeira. Use apenas com confirmação explícita do usuário.",
    ),
})

const devicePatchSchema = z.object({
  oldText: z.string().min(1).max(DEVICE_FILE_EDIT_MAX_OLD_TEXT),
  newText: z.string().max(DEVICE_FILE_EDIT_MAX_NEW_TEXT),
  replaceAll: z
    .boolean()
    .default(false)
    .describe("Substitui todas as ocorrências em vez de exigir uma única."),
})

export const deviceApplyPatchInputSchema = z.object({
  deviceId: deviceIdSchema,
  path: z.string().min(1).max(DEVICE_PATH_MAX_LENGTH),
  patches: z
    .array(devicePatchSchema)
    .min(1)
    .max(DEVICE_FILE_PATCH_MAX_COUNT)
    .describe(
      `Lista atômica de trechos exatos a substituir (máximo ${DEVICE_FILE_PATCH_MAX_COUNT}).`,
    ),
})

export const deviceRunCommandInputSchema = z.object({
  deviceId: deviceIdSchema,
  command: z.string().min(1).max(256),
  args: z.array(z.string().max(DEVICE_RUN_ARGS_MAX_LENGTH)).optional(),
  timeoutMs: z
    .number()
    .int()
    .min(1_000)
    .max(DEVICE_RUN_TIMEOUT_MAX_MS)
    .default(DEVICE_RUN_TIMEOUT_DEFAULT_MS),
  cwd: z.string().max(DEVICE_PATH_MAX_LENGTH).optional(),
})

export const deviceShellInputSchema = z.object({
  deviceId: deviceIdSchema,
  script: z
    .string()
    .min(1)
    .max(DEVICE_SHELL_SCRIPT_MAX_LENGTH)
    .describe("Script completo a executar. Não é interpolado numa linha de comando."),
  shell: z
    .enum(DEVICE_SHELL_KINDS)
    .default("auto")
    .describe(
      "Shell desejado. `auto` usa pwsh, depois powershell e por fim cmd no Windows.",
    ),
  cwd: z
    .string()
    .max(DEVICE_PATH_MAX_LENGTH)
    .optional()
    .describe("Diretório de trabalho. Aceita qualquer pasta da máquina; caminhos protegidos (instalação do Spectral, System32, WinSxS, Boot) são recusados."),
  timeoutMs: z
    .number()
    .int()
    .min(DEVICE_SHELL_TIMEOUT_MIN_MS)
    .max(DEVICE_SHELL_TIMEOUT_MAX_MS)
    .default(DEVICE_SHELL_TIMEOUT_DEFAULT_MS),
  env: z
    .record(
      z.string().max(DEVICE_SHELL_ENV_NAME_MAX_LENGTH),
      z.string().max(DEVICE_SHELL_ENV_VALUE_MAX_LENGTH),
    )
    .optional()
    .describe("Variáveis de ambiente extras (máximo 32)."),
  stdin: z
    .string()
    .max(DEVICE_SHELL_STDIN_MAX_LENGTH)
    .optional()
    .describe("Texto enviado para a entrada padrão do script."),
  maxOutputBytes: z
    .number()
    .int()
    .min(DEVICE_SHELL_OUTPUT_MIN_BYTES)
    .max(DEVICE_SHELL_OUTPUT_MAX_BYTES)
    .default(DEVICE_SHELL_OUTPUT_DEFAULT_BYTES)
    .describe("Teto de saída por stream. Acima disso, cabeça e cauda são mantidas."),
})

export const deviceJobStartInputSchema = z.object({
  deviceId: deviceIdSchema,
  script: z
    .string()
    .min(1)
    .max(DEVICE_SHELL_SCRIPT_MAX_LENGTH)
    .describe("Script completo a executar em segundo plano. Não é interpolado numa linha de comando."),
  shell: z
    .enum(DEVICE_SHELL_KINDS)
    .default("auto")
    .describe("Shell desejado. `auto` usa pwsh, depois powershell e por fim cmd no Windows."),
  cwd: z
    .string()
    .max(DEVICE_PATH_MAX_LENGTH)
    .optional()
    .describe("Diretório de trabalho. Aceita qualquer pasta da máquina; caminhos protegidos (instalação do Spectral, System32, WinSxS, Boot) são recusados."),
  env: z
    .record(
      z.string().max(DEVICE_SHELL_ENV_NAME_MAX_LENGTH),
      z.string().max(DEVICE_SHELL_ENV_VALUE_MAX_LENGTH),
    )
    .optional()
    .describe("Variáveis de ambiente extras (máximo 32)."),
  label: z
    .string()
    .trim()
    .max(DEVICE_JOB_LABEL_MAX_LENGTH)
    .optional()
    .describe("Rótulo amigável para identificar o job na listagem."),
  maxRuntimeMs: z
    .number()
    .int()
    .min(DEVICE_JOB_MAX_RUNTIME_MIN_MS)
    .max(DEVICE_JOB_MAX_RUNTIME_MS)
    .default(DEVICE_JOB_MAX_RUNTIME_DEFAULT_MS)
    .describe("Teto de execução em ms. Padrão 30 min; máximo 60 min. Ao estourar, a árvore de processos é encerrada."),
})

export const deviceJobStatusInputSchema = z.object({
  deviceId: deviceIdSchema,
  jobId: z.string().min(1).max(DEVICE_JOB_ID_MAX_LENGTH).describe("Id do job retornado por device-job-start."),
  waitMs: z
    .number()
    .int()
    .min(DEVICE_JOB_WAIT_MIN_MS)
    .max(DEVICE_JOB_WAIT_MAX_MS)
    .default(DEVICE_JOB_WAIT_DEFAULT_MS)
    .describe(
      "Espera ativa: segura a chamada até o job sair de `running` ou até este teto (máximo 10 s). Use 5-10 s para acompanhar sem polling em rajada; 0 responde na hora.",
    ),
})

export const deviceJobOutputInputSchema = z.object({
  deviceId: deviceIdSchema,
  jobId: z.string().min(1).max(DEVICE_JOB_ID_MAX_LENGTH).describe("Id do job retornado por device-job-start."),
  cursor: z
    .number()
    .int()
    .min(0)
    .default(0)
    .describe("Cursor de leitura (contagem de caracteres UTF-16). Sempre comece em 0 para um job novo e use o nextCursor da resposta anterior."),
  maxBytes: z
    .number()
    .int()
    .min(DEVICE_JOB_OUTPUT_MIN_BYTES)
    .max(DEVICE_JOB_OUTPUT_MAX_BYTES)
    .default(DEVICE_JOB_OUTPUT_DEFAULT_BYTES)
    .describe("Teto de bytes UTF-8 para esta leitura."),
  waitMs: z
    .number()
    .int()
    .min(DEVICE_JOB_WAIT_MIN_MS)
    .max(DEVICE_JOB_WAIT_MAX_MS)
    .default(DEVICE_JOB_WAIT_DEFAULT_MS)
    .describe(
      "Espera ativa: segura a chamada até chegar saída nova além do cursor ou o job terminar (máximo 10 s). Use 5-10 s em vez de repetir a leitura em sequência.",
    ),
})

export const deviceJobCancelInputSchema = z.object({
  deviceId: deviceIdSchema,
  jobId: z.string().min(1).max(DEVICE_JOB_ID_MAX_LENGTH).describe("Id do job retornado por device-job-start."),
})

export const deviceJobListInputSchema = z.object({
  deviceId: deviceIdSchema,
})

type DeviceRow = {
  id: string
  name: string
  hostname: string | null
  platform: string
  architecture: string | null
  lastSeenAt: Date | null
  executionPolicy?: unknown
}

export type DeviceToolSummary = {
  id: string
  name: string
  hostname: string | null
  platform: string
  architecture: string | null
  status: DeviceStatus
  lastSeenAt: string | null
  confirmDestructive: boolean
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
    confirmDestructive: parseDeviceExecutionPolicy(device.executionPolicy)
      .confirmDestructive,
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
      executionPolicy: devices.executionPolicy,
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
    ...(output.result.found !== undefined
      ? { found: output.result.found }
      : {}),
    ...(output.result.query !== undefined
      ? { query: output.result.query }
      : {}),
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
    ...(output.result.write ? { write: output.result.write } : {}),
    ...(output.result.edit ? { edit: output.result.edit } : {}),
    ...(output.result.stat ? { stat: output.result.stat } : {}),
    ...(output.result.mkdir ? { mkdir: output.result.mkdir } : {}),
    ...(output.result.copy ? { copy: output.result.copy } : {}),
    ...(output.result.move ? { move: output.result.move } : {}),
    ...(output.result.delete ? { delete: output.result.delete } : {}),
    ...(output.result.patch ? { patch: output.result.patch } : {}),
    ...(output.result.run ? { run: output.result.run } : {}),
    ...(output.result.env ? { env: output.result.env } : {}),
    ...(output.result.shell ? { shell: output.result.shell } : {}),
    ...(output.result.job ? { job: output.result.job } : {}),
    ...(output.result.jobs ? { jobs: output.result.jobs } : {}),
    ...(output.result.jobOutput ? { jobOutput: output.result.jobOutput } : {}),
    ...(output.result.cancelled !== undefined
      ? { cancelled: output.result.cancelled }
      : {}),
    ...(output.result.windows ? { windows: output.result.windows } : {}),
    ...(output.result.window ? { window: output.result.window } : {}),
    ...(output.result.screenshot ? { screenshot: output.result.screenshot } : {}),
    ...(output.result.clipboard ? { clipboard: output.result.clipboard } : {}),
    ...(output.result.ui ? { ui: output.result.ui } : {}),
    ...(output.result.uiAction ? { uiAction: output.result.uiAction } : {}),
  }
}

export type DeviceToolContext = {
  chatId?: string
  executionMode?: ChatExecutionMode
}

async function runDeviceCommand(
  userId: string,
  deviceId: string,
  command: DeviceCommand,
  context?: DeviceToolContext,
) {
  const executionMode = context?.executionMode ?? "plan"
  const toolName = `device-${command.command}`
  const risk = classifyDeviceToolRisk(toolName, command.input)
  const timeoutMs = deviceCommandTimeoutMs(command)

  if (!risk || risk === "read") {
    const output = await sendDeviceCommand({ userId, deviceId, command, timeoutMs })
    return toCommandToolResult(deviceId, output)
  }

  let auditPolicy: ReturnType<typeof describeAuditPolicy>

  try {
    const guard = await assertDeviceCommandAllowed({
      userId,
      deviceId,
      executionMode,
      toolName,
      input: command.input,
    })

    auditPolicy = describeAuditPolicy(guard.policy)

    if (!guard.ok) {
      await recordDeviceAudit({
        deviceId,
        userId,
        chatId: context?.chatId,
        toolName,
        command: readDeviceToolCommand(toolName, command.input),
        risk,
        decision: "denied",
        policy: auditPolicy,
        mode: executionMode,
        errorCode: guard.code,
      })

      return { ok: false as const, code: guard.code, error: guard.error }
    }
  } catch {
    return {
      ok: false as const,
      code: "policy_unavailable",
      error:
        "Não foi possível verificar a política do dispositivo. Nenhum comando foi enviado.",
    }
  }

  const startedAt = Date.now()
  const output = await sendDeviceCommand({
    userId,
    deviceId,
    command,
    timeoutMs,
  })
  const durationMs = Date.now() - startedAt
  const failed = !output.ok || !output.result.ok

  await recordDeviceAudit({
    deviceId,
    userId,
    chatId: context?.chatId,
    toolName,
    command: readDeviceToolCommand(toolName, command.input),
    risk,
    decision: failed ? "failed" : "executed",
    policy: auditPolicy,
    mode: executionMode,
    durationMs,
    exitCode: output.ok && output.result.ok ? output.result.shell?.exitCode ?? null : null,
    errorCode: !output.ok
      ? output.code
      : output.result.ok
        ? null
        : output.result.code ?? "command_failed",
  })

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
  "Abre um aplicativo em um dispositivo online.",
  "Informe `appId` de um app retornado por device-list-apps ou device-find-app, ou `path` absoluto de um executável/atalho para apps fora da descoberta.",
  "Para passar argumentos (ex.: `zed .`, `code C:\\projeto`), use `args` com um item por argumento e informe `cwd` quando o argumento for um caminho relativo. Abrir com args/cwd pede aprovação no chat.",
  "Sem `cwd`, o app herda a pasta padrão do dispositivo (home), não a pasta do projeto: para abrir o projeto atual, passe o caminho em `args` ou em `cwd`.",
  "No Windows, a descoberta cobre atalhos do Menu Iniciar e o registro App Paths. Apps fora da descoberta podem ser cadastrados com device-register-app.",
  "Use device-find-app quando não souber o id exato; use `refresh: true` se o usuário acabou de instalar o app.",
  "Se a abertura falhar com `app_not_found`, tente `device-find-app` com outro termo ou `device-register-app` com o caminho informado pelo usuário. Se o driver não suportar o comando (`unsupported_platform` ou comando interno indisponível), use o terminal interno (`device-shell`): no Windows `Start-Process`, no macOS `open`, no Linux `xdg-open`. Explique ao usuário que está usando a alternativa via terminal.",
].join("\n")

const openPathDescription = [
  "Abre um arquivo ou pasta no aplicativo padrão do dispositivo, sem pedir aprovação.",
  "Use para abrir um PDF, imagem, documento ou uma pasta no Explorer/Finder.",
  "Não aceita executáveis, atalhos ou scripts: para isso use device-open-app, que pede aprovação.",
  "Informe o caminho absoluto. Caminhos inexistentes retornam `path_not_found`.",
].join("\n")

const registerAppDescription = [
  "Cadastra um aplicativo no catálogo local do dispositivo (driver), com nome, caminho absoluto e, opcionalmente, argumentos e diretório de trabalho padrão.",
  "Use quando o usuário informar um executável fora da descoberta automática ou pedir para sempre abrir um app com os mesmos argumentos.",
  "O caminho precisa existir no dispositivo. O cadastro não concede permissão: abrir o app continua seguindo a política do dispositivo.",
  "Use device-list-apps para descobrir o id retornado e device-remove-app para remover depois.",
].join("\n")

const removeAppDescription = [
  "Remove um aplicativo do catálogo local do dispositivo.",
  "Use o id retornado por device-list-apps ou device-register-app. Isso não desinstala nem apaga o executável; só esquece a entrada do catálogo.",
].join("\n")

const listAppsDescription = [
  "Lista os aplicativos que o driver consegue abrir em um dispositivo online.",
  "Inclui apps fixos, atalhos do Menu Iniciar, entradas do App Paths e os apps cadastrados no catálogo local do driver (`source: custom`).",
  "Use `query` para filtrar por nome, id ou caminho e `refresh: true` para refazer a descoberta após instalar algo.",
  "Use o `id` retornado em device-open-app.",
].join("\n")

const findAppDescription = [
  "Verifica se um aplicativo existe no PC e retorna as correspondências.",
  "Aceita nome, id ou parte do caminho; a resposta traz `found` e a lista de apps com id, nome, origem (`custom` para o catálogo do driver) e caminho quando disponível.",
  "Use antes de device-open-app quando não tiver certeza do id ou quando o usuário perguntar se um app está instalado.",
  "`refresh: true` refaz a descoberta (Menu Iniciar + App Paths) em vez de usar o cache.",
  "Se nada for encontrado, peça o caminho ao usuário e cadastre com device-register-app — não invente ids nem caminhos.",
].join("\n")

const getOsDescription = [
  "Retorna informações do sistema operacional do dispositivo: plataforma, tipo, release, versão e arquitetura.",
  "Use quando o usuário precisar saber a versão do Windows, macOS ou Linux, ou quando a plataforma da listagem não for suficiente.",
  "Requer um dispositivo online e o deviceId retornado por device-list.",
].join("\n")

const envDescription = [
  "Retorna o retrato do ambiente da máquina: plataforma, arquitetura, usuário, home, temp, diretório atual, shell padrão, shells instalados, runtimes (node, python, git, docker, etc.), elevação e locale.",
  "Use ANTES de montar qualquer script para não adivinhar caminhos, shell ou ferramentas instaladas.",
  "`capabilities` lista os comandos que este driver realmente executa nesta plataforma; não tente comandos fora dela.",
  "Requer um dispositivo online e o deviceId retornado por device-list.",
].join("\n")

const shellDescription = [
  "Executa um script de shell na máquina do usuário e retorna exitCode, stdout, stderr e duração.",
  "É a primitiva poderosa do plano de execução: use para rodar build, testes, git, scripts e qualquer fluxo que não tenha tool dedicada.",
  "O script roda a partir de um arquivo temporário; escolha `shell` (pwsh, powershell, cmd) ou deixe `auto`.",
  "Informe `cwd` para rodar em outra pasta; caminhos protegidos são recusados. Variáveis de ambiente do driver não são herdadas; use `env` se precisar de algo específico.",
  "A saída é limitada por `maxOutputBytes` (padrão 64 KB por stream, máximo 512 KB) com cabeça e cauda; `truncated` indica corte.",
  "Timeout padrão 30s (máximo 60s). Ao estourar, a árvore de processos é encerrada e `timedOut` vem true.",
  "A ação passa pela política do dispositivo: comandos longos ou destrutivos podem exigir aprovação no chat. Nunca rode scripts que fecham janelas/apps sem o usuário pedir.",
  "No Windows o shell do plano de execução é suportado nesta versão; macOS/Linux retornam `unsupported_platform`.",
].join("\n")

const jobStartDescription = [
  "Inicia um script de shell como job em segundo plano no dispositivo e retorna imediatamente o `jobId`.",
  "Use para build, testes, servidores de desenvolvimento, compilações longas ou qualquer processo que exceda os 60s do `device-shell`.",
  "O script roda a partir de um arquivo temporário; escolha `shell` (pwsh, powershell, cmd) ou deixe `auto`. Informe `cwd` para rodar em outra pasta; caminhos protegidos são recusados.",
  "O `maxRuntimeMs` padrão é 30 min (máximo 60 min); ao estourar, a árvore de processos é encerrada.",
  "Até 3 jobs rodam simultâneos por dispositivo. Se o limite estiver atingido, cancele um job existente com `device-job-cancel` ou espere terminar.",
  "Leia a saída aos poucos com `device-job-output` passando o `cursor` da resposta anterior; nunca releia tudo do zero.",
  "Passa pela política do dispositivo: `device-job-start` exige aprovação no Modo Construtor (risco execução) e é negado no Modo Leitura.",
  "No Windows o shell do plano de execução é suportado nesta versão; macOS/Linux retornam `unsupported_platform`.",
].join("\n")

const jobStatusDescription = [
  "Consulta o status de um job: `running`, `exited`, `killed` ou `failed`, com `exitCode`, `startedAt`, `durationMs`, `stdoutBytes`, `stderrBytes`, `timedOut` e `cancelled`.",
  "Use `waitMs` (5-10 s) para acompanhar sem polling em rajada: a chamada segura até o job sair de `running` ou o teto estourar.",
  "Um job que morre logo depois de iniciar aparece como `exited`/`failed` com `exitCode` — nunca afirme que está rodando sem conferir este status.",
].join("\n")

const jobOutputDescription = [
  "Lê a saída de um job de forma incremental por `cursor` (contagem de caracteres UTF-16 do fluxo combinado stdout+stderr).",
  "O cursor é por job: sempre comece em 0 para um job novo e, nas próximas leituras, passe o `nextCursor` da resposta anterior.",
  "Use `waitMs` (5-10 s) para esperar saída nova em vez de repetir a leitura em sequência.",
  "Informe `maxBytes` para limitar o tamanho desta leitura. O resultado traz `chunks[]` com `cursor`, `stream` (`stdout`/`stderr`) e `text`, além de `nextCursor`, `startCursor`, `status`, `exitCode` e `cancelled` — dá para dispensar o status na mesma rodada.",
  "Se `startCursor` for maior que o `cursor` pedido, o começo do buffer foi descartado (retenção de 1 MB) e você perdeu trechos antigos.",
  "Um job concluído fica retido por ~10 min; depois disso `device-job-status` e `device-job-output` retornam `job_not_found`.",
].join("\n")

const jobCancelDescription = [
  "Cancela um job em execução e mata a árvore de processos dele no dispositivo.",
  "Retorna `cancelled: true` quando um job em execução recebeu o sinal; `cancelled: false` significa que ele já havia terminado — nesse caso reporte o `status` real (`exited`, `failed` ou `killed`) e não diga que foi cancelado.",
  "Cancelar um job que você iniciou não exige aprovação adicional.",
].join("\n")

const jobListDescription = [
  "Lista todos os jobs do dispositivo (ativos e concluídos dentro da retenção de ~10 min), ordenados do mais recente para o mais antigo.",
  "Use para encontrar o `jobId` de um job em andamento ou para verificar quantos dos 3 slots de job estão ocupados.",
].join("\n")

const typeTextDescription = [
  "Digita texto na janela alvo do dispositivo.",
  "Use `device-list-windows` antes para escolher a janela e prefira informar `windowId`; sem ele, o texto vai para a janela que estiver em foco.",
  "Confirme com o usuário antes de digitar conteúdo sensível e evite senhas.",
].join("\n")

const pressKeyDescription = [
  "Pressiona uma tecla ou combinação na janela alvo do dispositivo.",
  "Use `device-list-windows` antes para escolher a janela e prefira informar `windowId`; sem ele, o comando vai para a janela que estiver em foco.",
  "Teclas: letras a-z, dígitos 0-9, enter, tab, escape, backspace, delete, space, insert, setas, home, end, pageup, pagedown e f1-f12.",
  "Modificadores: ctrl, alt, shift e meta. As combinações alt+f4 e ctrl+alt+delete são bloqueadas.",
  "Use com cuidado: atalhos podem fechar janelas ou alterar o sistema.",
].join("\n")

const readClipboardDescription = [
  "Lê o conteúdo atual da área de transferência (texto) de um dispositivo online.",
  "Use somente quando o usuário pedir explicitamente para ver, recuperar ou colar o que copiou.",
  "O clipboard pode conter senhas, tokens e dados sensíveis: não repita o conteúdo sem necessidade nem o envie para fora.",
  "A leitura é limitada a 100 mil caracteres; quando for cortada, o resultado traz `truncated: true` e o tamanho original em `length`.",
].join("\n")

const writeClipboardDescription = [
  "Escreve texto na área de transferência de um dispositivo online, substituindo o conteúdo atual.",
  "Use quando o usuário pedir para copiar um texto no PC para colar em outro lugar.",
  "Avise que a operação substitui o clipboard atual e confirme antes de sobrescrever conteúdo que o usuário possa querer manter.",
  "Limite de 100 mil caracteres; caracteres de controle não são aceitos (tab, CR e LF são permitidos).",
].join("\n")

const moveMouseDescription = [
  "Move o cursor do mouse de um dispositivo online para uma coordenada da tela.",
  "Prefira informar `screenshotId` junto com `x` e `y` normalizados de 0 a 1000 na imagem retornada por device-screenshot: 0 é a borda esquerda/topo e 1000 a borda direita/baixo. O servidor converte para pixels nativos; não converta manualmente.",
  "Sem `screenshotId`, `x` e `y` precisam ser pixels nativos do sistema (em multi-monitor, podem ser negativas).",
  "Mover o cursor não clica nem altera o conteúdo: use device-click depois, se o usuário pediu um clique.",
  "No macOS é necessário autorizar Acessibilidade; no Wayland retorna `unsupported_environment`.",
].join("\n")

const clickDescription = [
  "Clica em um ponto da tela de um dispositivo online.",
  "Prefira informar `screenshotId`, `x` e `y` normalizados de 0 a 1000 na imagem de device-screenshot; o servidor converte para a tela. Sem `screenshotId`, `x` e `y` são pixels nativos.",
  "Omita `x` e `y` (e `screenshotId`) para clicar onde o cursor está.",
  "`button`: left (padrão), right ou middle. `count`: 1 (padrão), 2 (duplo clique) ou 3.",
  "Sempre confirme com o usuário antes de clicar, principalmente em botões que salvam, enviam, apagam ou fecham algo. Depois do clique, capture a tela para verificar o resultado quando isso fizer sentido.",
  "Erros comuns: `screenshot_not_found` (captura expirou; capture de novo), `screenshot_device_mismatch`, `invalid_coordinates` (normalizado fora de 0–1000 ou sem screenshotId), `permission_denied` no macOS (Acessibilidade) e `unsupported_environment` no Wayland.",
].join("\n")

const scrollDescription = [
  "Rola a tela de um dispositivo online na direção indicada.",
  "Opcionalmente informe `screenshotId`, `x` e `y` normalizados de 0 a 1000 para posicionar o cursor sobre a área que deve rolar; o servidor converte para a tela.",
  "`direction`: up, down, left ou right. `amount`: 1 a 50 passos (padrão 3).",
  "Use device-screenshot antes para confirmar a área e depois para verificar o resultado.",
  "No macOS é necessário autorizar Acessibilidade; no Wayland retorna `unsupported_environment`.",
].join("\n")

const dragDescription = [
  "Arrasta de um ponto a outro na tela de um dispositivo online.",
  "Informe `from` e `to` com `x` e `y`. Com `screenshotId`, os pontos são normalizados de 0 a 1000 na imagem de device-screenshot e o servidor converte para a tela; sem ele, são pixels nativos do sistema.",
  "`button` define o botão mantido durante o arrasto (left, right ou middle). `durationMs` controla a velocidade (100–10.000 ms, padrão 500).",
  "Arrastar pode mover arquivos, selecionar texto ou reorganizar itens: confirme com o usuário antes e capture a tela depois para verificar.",
  "No macOS é necessário autorizar Acessibilidade; no Wayland retorna `unsupported_environment`.",
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

const writeFileDescription = [
  "Escreve conteúdo de texto em um arquivo do dispositivo (somente gravação).",
  "Cria o arquivo se não existir, sobrescreve se já existir.",
  "Use `device-list-files` ou `device-glob` para descobrir caminhos válidos.",
  "O arquivo não pode exceder 1 MB.",
].join("\n")

const editFileDescription = [
  "Substitui uma ocorrência exata de texto dentro de um arquivo do dispositivo.",
  "O texto antigo deve aparecer exatamente uma vez no arquivo.",
  "Use `device-read-file` para ler o conteúdo antes de editar.",
  "O arquivo resultante não pode exceder 1 MB.",
].join("\n")

const mkdirDescription = [
  "Cria um diretório no dispositivo.",
  "Com `recursive: true` (padrão) cria também os diretórios intermediários.",
  "Se o diretório já existir, retorna `created: false` sem erro.",
  "Use `device-stat` para confirmar o resultado.",
].join("\n")

const statDescription = [
  "Consulta metadados de um caminho do dispositivo sem seguir links simbólicos.",
  "Retorna tipo (file, directory, symlink, other), tamanho, datas, modo, se é link e o destino do link.",
  "Use antes de copiar, mover ou apagar para confirmar o que existe no caminho.",
].join("\n")

const copyDescription = [
  "Copia um arquivo ou diretório para outro caminho no dispositivo.",
  "Aceita caminhos absolutos; caminhos protegidos (instalação do Spectral, System32, WinSxS, Boot) são recusados.",
  "`overwrite: false` (padrão) falha se o arquivo de destino já existir.",
  "`recursive: true` (padrão) copia diretórios arquivo por arquivo; links simbólicos são ignorados.",
  "Não copie um diretório para dentro dele mesmo. Use `device-stat` para conferir o resultado.",
].join("\n")

const moveDescription = [
  "Move (renomeia) um arquivo ou diretório no dispositivo.",
  "Aceita caminhos absolutos; caminhos protegidos (instalação do Spectral, System32, WinSxS, Boot) são recusados.",
  "`overwrite: false` (padrão) falha se o destino já existir.",
  "Entre volumes diferentes o driver copia e apaga a origem automaticamente.",
  "Para renomear no mesmo diretório, use `from` e `to` com o mesmo diretório pai.",
].join("\n")

const deleteDescription = [
  "Apaga um arquivo ou diretório do dispositivo.",
  "Por padrão envia para a lixeira do Windows; `permanent: true` apaga de vez e deve ser usado apenas com confirmação explícita.",
  "Diretórios com conteúdo exigem `recursive: true`.",
  "Links simbólicos são removidos como links, nunca seguidos.",
  "Caminhos protegidos (instalação do Spectral, System32, WinSxS, Boot) não podem ser apagados (`protected_path`). Use `device-stat` depois para confirmar.",
].join("\n")

const applyPatchDescription = [
  "Aplica vários trechos exatos em um arquivo de uma vez, de forma atômica.",
  "Cada patch exige `oldText` e `newText`; por padrão o `oldText` deve aparecer exatamente uma vez.",
  "Use `replaceAll: true` para substituir todas as ocorrências de um trecho.",
  "Todos os patches são aplicados ou nenhum é gravado. CRLF e BOM são preservados.",
  "Máximo de 10 patches e 1 MB de resultado. Use `device-read-file` antes de montar os patches.",
].join("\n")

const runCommandDescription = [
  "Executa um comando no dispositivo (somente leitura/consulta).",
  "Apenas comandos da allowlist são permitidos (ex.: ls, dir, echo, ps, whoami, ping, etc.).",
  "Comandos destrutivos (rm, del, shutdown, sudo, etc.) são bloqueados.",
  "Saída limitada a 64 KB. Timeout configurável (padrão 15s, máximo 60s).",
  "Use com cuidado: qualquer comando pode afetar o sistema do dispositivo.",
].join("\n")

const listWindowsDescription = [
  "Lista as janelas abertas em um dispositivo online.",
  "Retorna título, processo, limites na tela e qual janela está em foco.",
  "Use antes de `device-type-text` ou `device-press-key` para escolher a janela certa em vez de digitar na janela ativa por acaso.",
  "Retorna até 20 janelas por padrão (máximo 30). Janelas minimizadas ficam de fora, a menos que `includeMinimized` seja true.",
].join("\n")

const focusWindowDescription = [
  "Foca uma janela específica de um dispositivo online.",
  "Informe o `windowId` retornado por `device-list-windows`.",
  "Se o sistema operacional bloquear o foco, retorna `focus_denied`; nesse caso peça ao usuário para clicar na janela.",
].join("\n")

const windowActionDescription = [
  "Minimiza, maximiza, restaura ou fecha uma janela específica de um dispositivo online.",
  "Informe o `windowId` retornado por `device-list-windows` e a `action` desejada.",
  "`restore` desfaz a minimização e o estado maximizado, devolvendo a janela ao tamanho normal.",
  "`close` envia um pedido de fechamento gracioso: o aplicativo pode abrir um diálogo para salvar alterações em vez de encerrar imediatamente. Não há força bruta nem encerramento por processo.",
  "Use apenas em janelas que o usuário pediu para controlar; nunca feche janelas do sistema ou aplicativos sem relação com o pedido.",
].join("\n")

const inspectUiDescription = [
  "Inspeciona a árvore de acessibilidade (UI Automation) de uma janela e retorna os controles com nome, papel, limites e centro exato.",
  "Use esta tool antes de clicar em abas, botões, menus, campos e outros controles nativos: ela evita estimar pixels a partir da captura.",
  "Informe o `windowId` retornado por device-list-windows. `find` filtra por trecho do nome ou AutomationId; `role` filtra pelo papel (Button, TabItem, MenuItem, Edit, CheckBox, etc.).",
  "Cada elemento traz `runtimeId`, `bounds` e `center` em pixels nativos, estado (focado/selecionado/expandido), `actions` suportadas e `value` com o texto atual quando houver (null em campos de senha).",
  "Se o alvo aparece depois de um clique (menu, pasta, página carregando), passe `waitMs` (ex.: 2000): a tool reenumera a árvore até encontrar em vez de devolver vazio na hora.",
  "Use o `runtimeId` em device-ui-action. O runtimeId é temporário: se a inspeção falhar com `element_not_found`, inspecione de novo antes de agir.",
  "Suportado no Windows. Em macOS e Linux retorna `unsupported_platform`: use captura de tela + device-click como fallback.",
].join("\n")

const uiActionDescription = [
  "Executa uma ação de acessibilidade em um controle retornado por device-inspect-ui, sem mover o cursor nem depender de coordenadas visuais.",
  "Ações: `invoke` (pressionar botão/item), `select` (selecionar aba/item), `toggle` (marcar/desmarcar), `expand`/`collapse` (abrir/fechar), `focus` (focar o controle) e `setValue` (escrever texto no controle, com `value`).",
  "Para abas e itens de lista, use `select`: `focus` apenas concentra o foco de teclado e não ativa. Se o resultado vier com `hint`, siga a ação sugerida em vez de reinspectionar.",
  "Prefira `setValue` para campos com `actions: setValue` (barra de endereço, busca, caixa de texto nativo): ele escreve direto no controle e não depende de keystrokes na janela em foco.",
  "Campos de senha são bloqueados: `setValue` retorna `password_field_blocked` e a inspeção não expõe o valor. Nunca tente contornar isso; peça ao usuário para digitar a senha.",
  "Use o `runtimeId` exato do elemento e a mesma `windowId` usada na inspeção. Escolha uma ação presente em `actions`; se vier `pattern_not_supported`, use outra ação ou device-click como fallback.",
  "Em navegadores, títulos de abas mudam com frequência e podem recriar o elemento. O padrão de `waitMs` já reencontra o runtimeId por até 1,5s antes de devolver `element_not_found`; aumente até 10000 quando o app estiver lento.",
  "Confirme com o usuário antes de `invoke` em controles destrutivos (fechar, excluir, enviar, salvar, sair) e nunca feche abas ou janelas reais sem autorização explícita.",
  "O resultado retorna o estado do elemento depois da ação (focado, selecionado, expandido) e quanto tempo esperou. Quando o elemento sumir porque a ação o removeu (ex.: fechar aba), o resultado traz o último estado conhecido.",
  "Suportado no Windows. Em macOS e Linux retorna `unsupported_platform`.",
].join("\n")

const screenshotDescription = [
  "Captura e envia ao modelo uma imagem da tela de um dispositivo online.",
  "Alvos: sem parâmetro, captura a tela inteira (todos os monitores); `windowId` foca a janela e captura só ela; `monitor` captura um monitor (índice começa em 0); `region` captura um retângulo. Use apenas um alvo por chamada.",
  "`region` sem `screenshotId` usa pixels nativos do sistema. Com `screenshotId`, `region` usa coordenadas normalizadas inteiras de 0 a 1000 da captura de referência: use isso para recortar e ampliar um alvo pequeno (coarse-to-fine).",
  "A saída inclui id, largura, altura, escala do SO, monitor, região, formato e tamanho. Use esse id como `screenshotId` nas tools de mouse para enviar coordenadas normalizadas de 0 a 1000.",
  "Em capturas de região o servidor eleva `maxWidth` até a largura nativa da região: a imagem não é reduzida e cada pixel corresponde a um pixel nativo.",
  "Fluxo recomendado para alvos pequenos: 1) capture a tela inteira ou a janela com `windowId`; 2) localize o alvo e capture um recorte com `screenshotId` + `region` normalizado; 3) clique com `screenshotId` do recorte + `x`/`y` normalizados; 4) capture de novo para conferir se o efeito esperado ocorreu.",
  "A imagem não é salva no histórico do chat; ela fica disponível apenas por tempo limitado e é anexada ao modelo na mesma rodada.",
  "Use após uma ação para verificar o resultado antes de continuar. Nunca declare sucesso sem uma captura de verificação quando a ação era visual.",
  "Privacidade: só capture quando o usuário pedir ou quando for necessário para confirmar uma ação que ele autorizou. Nunca capture senhas, dados sensíveis ou conteúdo sem relação com o pedido.",
  "Erros comuns: `screen_unstable` (captura uniforme: tela bloqueada ou conteúdo não renderizado; recapture), `window_bounds_unavailable`, `screen_permission_denied` no macOS (autorize Gravação de Tela), `unsupported_environment` no Wayland, `dependency_missing` no Linux (instale ImageMagick/xrandr) e `monitor_not_found` para índice inválido.",
].join("\n")

export function createDeviceTools(
  userId: string,
  context?: DeviceToolContext,
) {
  const executionContext = context ?? {}
  const runCommand = (deviceId: string, command: DeviceCommand) =>
    runDeviceCommand(userId, deviceId, command, executionContext)

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
      execute: async ({ deviceId, url }) => {
        try {
          return await runCommand(deviceId, {
            command: "open-url",
            input: { url },
          })
        } catch (error) {
          return {
            ok: false as const,
            code: "tool_execution_error",
            error:
              error instanceof Error
                ? error.message
                : "Erro desconhecido ao executar device-open-url.",
          }
        }
      },
    }),
    [DEVICE_OPEN_APP_TOOL_NAME]: tool({
      description: openAppDescription,
      inputSchema: deviceOpenAppInputSchema,
      execute: async ({ deviceId, appId, path, args, cwd }) => {
        try {
          if (path) {
            return await runCommand(deviceId, {
              command: "open-app",
              input: {
                path,
                ...(args && args.length > 0 ? { args } : {}),
                ...(cwd ? { cwd } : {}),
              },
            })
          }

          if (!appId) {
            return {
              ok: false as const,
              code: "invalid_app",
              error: 'Informe "appId" ou "path" para abrir um aplicativo.',
            }
          }

          return await runCommand(deviceId, {
            command: "open-app",
            input: {
              appId,
              ...(args && args.length > 0 ? { args } : {}),
              ...(cwd ? { cwd } : {}),
            },
          })
        } catch (error) {
          return {
            ok: false as const,
            code: "tool_execution_error",
            error:
              error instanceof Error
                ? error.message
                : "Erro desconhecido ao executar device-open-app.",
          }
        }
      },
    }),
    [DEVICE_OPEN_PATH_TOOL_NAME]: tool({
      description: openPathDescription,
      inputSchema: deviceOpenPathInputSchema,
      execute: async ({ deviceId, path }) => {
        try {
          return await runCommand(deviceId, {
            command: "open-path",
            input: { path },
          })
        } catch (error) {
          return {
            ok: false as const,
            code: "tool_execution_error",
            error:
              error instanceof Error
                ? error.message
                : "Erro desconhecido ao executar device-open-path.",
          }
        }
      },
    }),
    [DEVICE_REGISTER_APP_TOOL_NAME]: tool({
      description: registerAppDescription,
      inputSchema: deviceRegisterAppInputSchema,
      execute: async ({ deviceId, name, path, args, cwd }) => {
        try {
          return await runCommand(deviceId, {
            command: "register-app",
            input: {
              name,
              path,
              ...(args && args.length > 0 ? { args } : {}),
              ...(cwd ? { cwd } : {}),
            },
          })
        } catch (error) {
          return {
            ok: false as const,
            code: "tool_execution_error",
            error:
              error instanceof Error
                ? error.message
                : "Erro desconhecido ao executar device-register-app.",
          }
        }
      },
    }),
    [DEVICE_REMOVE_APP_TOOL_NAME]: tool({
      description: removeAppDescription,
      inputSchema: deviceRemoveAppInputSchema,
      execute: async ({ deviceId, appId }) => {
        try {
          return await runCommand(deviceId, {
            command: "remove-app",
            input: { appId },
          })
        } catch (error) {
          return {
            ok: false as const,
            code: "tool_execution_error",
            error:
              error instanceof Error
                ? error.message
                : "Erro desconhecido ao executar device-remove-app.",
          }
        }
      },
    }),
    [DEVICE_LIST_APPS_TOOL_NAME]: tool({
      description: listAppsDescription,
      inputSchema: deviceListAppsInputSchema,
      execute: async ({ deviceId, query, refresh, limit }) => {
        try {
          return await runCommand(deviceId, {
            command: "list-apps",
            input: {
              ...(query !== undefined && query.length > 0 ? { query } : {}),
              ...(refresh !== undefined ? { refresh } : {}),
              limit,
            },
          })
        } catch (error) {
          return {
            ok: false as const,
            code: "tool_execution_error",
            error:
              error instanceof Error
                ? error.message
                : "Erro desconhecido ao executar device-list-apps.",
          }
        }
      },
    }),
    [DEVICE_FIND_APP_TOOL_NAME]: tool({
      description: findAppDescription,
      inputSchema: deviceFindAppInputSchema,
      execute: async ({ deviceId, query, refresh, limit }) => {
        try {
          const result = await runCommand(deviceId, {
            command: "find-app",
            input: {
              query,
              ...(refresh !== undefined ? { refresh } : {}),
              limit,
            },
          })

          if (!result.ok) {
            return result
          }

          return {
            ...result,
            query,
            found: (result.apps?.length ?? 0) > 0,
          }
        } catch (error) {
          return {
            ok: false as const,
            code: "tool_execution_error",
            error:
              error instanceof Error
                ? error.message
                : "Erro desconhecido ao executar device-find-app.",
          }
        }
      },
    }),
    [DEVICE_GET_OS_TOOL_NAME]: tool({
      description: getOsDescription,
      inputSchema: deviceGetOsInputSchema,
      execute: async ({ deviceId }) => {
        try {
          return await runCommand(deviceId, {
            command: "get-os",
            input: {},
          })
        } catch (error) {
          return {
            ok: false as const,
            code: "tool_execution_error",
            error:
              error instanceof Error
                ? error.message
                : "Erro desconhecido ao executar device-get-os.",
          }
        }
      },
    }),
    [DEVICE_ENV_TOOL_NAME]: tool({
      description: envDescription,
      inputSchema: deviceEnvInputSchema,
      execute: async ({ deviceId }) => {
        try {
          return await runCommand(deviceId, {
            command: "get-env",
            input: {},
          })
        } catch (error) {
          return {
            ok: false as const,
            code: "tool_execution_error",
            error:
              error instanceof Error
                ? error.message
                : "Erro desconhecido ao executar device-env.",
          }
        }
      },
    }),
    [DEVICE_SHELL_TOOL_NAME]: tool({
      description: shellDescription,
      inputSchema: deviceShellInputSchema,
      execute: async ({ deviceId, ...input }) => {
        try {
          return await runCommand(
            deviceId,
            parseDeviceCommand("shell", input),
          )
        } catch (error) {
          return {
            ok: false as const,
            code: "tool_execution_error",
            error:
              error instanceof Error
                ? error.message
                : "Erro desconhecido ao executar device-shell.",
          }
        }
      },
    }),
    [DEVICE_JOB_START_TOOL_NAME]: tool({
      description: jobStartDescription,
      inputSchema: deviceJobStartInputSchema,
      execute: async ({ deviceId, ...input }) => {
        try {
          return await runCommand(
            deviceId,
            parseDeviceCommand("job-start", input),
          )
        } catch (error) {
          return {
            ok: false as const,
            code: "tool_execution_error",
            error:
              error instanceof Error
                ? error.message
                : "Erro desconhecido ao executar device-job-start.",
          }
        }
      },
    }),
    [DEVICE_JOB_STATUS_TOOL_NAME]: tool({
      description: jobStatusDescription,
      inputSchema: deviceJobStatusInputSchema,
      execute: async ({ deviceId, jobId, waitMs = DEVICE_JOB_WAIT_DEFAULT_MS }) => {
        try {
          return await runCommand(deviceId, {
            command: "job-status",
            input: { jobId, waitMs },
          })
        } catch (error) {
          return {
            ok: false as const,
            code: "tool_execution_error",
            error:
              error instanceof Error
                ? error.message
                : "Erro desconhecido ao executar device-job-status.",
          }
        }
      },
    }),
    [DEVICE_JOB_OUTPUT_TOOL_NAME]: tool({
      description: jobOutputDescription,
      inputSchema: deviceJobOutputInputSchema,
      execute: async ({ deviceId, jobId, cursor = 0, maxBytes = DEVICE_JOB_OUTPUT_DEFAULT_BYTES, waitMs = DEVICE_JOB_WAIT_DEFAULT_MS }) => {
        try {
          return await runCommand(deviceId, {
            command: "job-output",
            input: { jobId, cursor, maxBytes, waitMs },
          })
        } catch (error) {
          return {
            ok: false as const,
            code: "tool_execution_error",
            error:
              error instanceof Error
                ? error.message
                : "Erro desconhecido ao executar device-job-output.",
          }
        }
      },
    }),
    [DEVICE_JOB_CANCEL_TOOL_NAME]: tool({
      description: jobCancelDescription,
      inputSchema: deviceJobCancelInputSchema,
      execute: async ({ deviceId, jobId }) => {
        try {
          return await runCommand(deviceId, {
            command: "job-cancel",
            input: { jobId },
          })
        } catch (error) {
          return {
            ok: false as const,
            code: "tool_execution_error",
            error:
              error instanceof Error
                ? error.message
                : "Erro desconhecido ao executar device-job-cancel.",
          }
        }
      },
    }),
    [DEVICE_JOB_LIST_TOOL_NAME]: tool({
      description: jobListDescription,
      inputSchema: deviceJobListInputSchema,
      execute: async ({ deviceId }) => {
        try {
          return await runCommand(deviceId, {
            command: "job-list",
            input: {},
          })
        } catch (error) {
          return {
            ok: false as const,
            code: "tool_execution_error",
            error:
              error instanceof Error
                ? error.message
                : "Erro desconhecido ao executar device-job-list.",
          }
        }
      },
    }),
    [DEVICE_TYPE_TEXT_TOOL_NAME]: tool({
      description: typeTextDescription,
      inputSchema: deviceTypeTextInputSchema,
      execute: async ({ deviceId, text, windowId }) => {
        try {
          return await runCommand(deviceId, {
            command: "type-text",
            input: { text, ...(windowId ? { windowId } : {}) },
          })
        } catch (error) {
          return {
            ok: false as const,
            code: "tool_execution_error",
            error:
              error instanceof Error
                ? error.message
                : "Erro desconhecido ao executar device-type-text.",
          }
        }
      },
    }),
    [DEVICE_PRESS_KEY_TOOL_NAME]: tool({
      description: pressKeyDescription,
      inputSchema: devicePressKeyInputSchema,
      execute: async ({ deviceId, key, modifiers, windowId }) => {
        try {
          return await runCommand(deviceId, {
            command: "press-key",
            input: {
              key,
              modifiers: modifiers ?? [],
              ...(windowId ? { windowId } : {}),
            },
          })
        } catch (error) {
          return {
            ok: false as const,
            code: "tool_execution_error",
            error:
              error instanceof Error
                ? error.message
                : "Erro desconhecido ao executar device-press-key.",
          }
        }
      },
    }),
    [DEVICE_READ_CLIPBOARD_TOOL_NAME]: tool({
      description: readClipboardDescription,
      inputSchema: deviceReadClipboardInputSchema,
      execute: async ({ deviceId }) => {
        try {
          return await runCommand(deviceId, {
            command: "read-clipboard",
            input: {},
          })
        } catch (error) {
          return {
            ok: false as const,
            code: "tool_execution_error",
            error:
              error instanceof Error
                ? error.message
                : "Erro desconhecido ao executar device-read-clipboard.",
          }
        }
      },
    }),
    [DEVICE_WRITE_CLIPBOARD_TOOL_NAME]: tool({
      description: writeClipboardDescription,
      inputSchema: deviceWriteClipboardInputSchema,
      execute: async ({ deviceId, text }) => {
        try {
          return await runCommand(deviceId, {
            command: "write-clipboard",
            input: { text },
          })
        } catch (error) {
          return {
            ok: false as const,
            code: "tool_execution_error",
            error:
              error instanceof Error
                ? error.message
                : "Erro desconhecido ao executar device-write-clipboard.",
          }
        }
      },
    }),
    [DEVICE_MOVE_MOUSE_TOOL_NAME]: tool({
      description: moveMouseDescription,
      inputSchema: deviceMoveMouseInputSchema,
      execute: async ({ deviceId, x, y, screenshotId }) => {
        try {
          const resolved = await resolveMousePoints(deviceId, screenshotId, [
            { x, y },
          ])

          if (!resolved.ok) {
            return resolved
          }

          const point = resolved.points[0]

          if (!point) {
            return {
              ok: false as const,
              code: "invalid_coordinates",
              error: "Não foi possível resolver as coordenadas do mouse.",
            }
          }

          return await runCommand(
            deviceId,
            parseDeviceCommand("move-mouse", point),
          )
        } catch (error) {
          return {
            ok: false as const,
            code: "tool_execution_error",
            error:
              error instanceof Error
                ? error.message
                : "Erro desconhecido ao executar device-move-mouse.",
          }
        }
      },
    }),
    [DEVICE_CLICK_TOOL_NAME]: tool({
      description: clickDescription,
      inputSchema: deviceClickInputSchema,
      execute: async ({ deviceId, screenshotId, ...input }) => {
        try {
          const resolved = await resolveMousePoints(
            deviceId,
            screenshotId,
            input.x !== undefined && input.y !== undefined
              ? [{ x: input.x, y: input.y }]
              : [],
          )

          if (!resolved.ok) {
            return resolved
          }

          const point = input.x !== undefined ? resolved.points[0] : undefined

          if (input.x !== undefined && !point) {
            return {
              ok: false as const,
              code: "invalid_coordinates",
              error: "Não foi possível resolver as coordenadas do clique.",
            }
          }

          return await runCommand(
            deviceId,
            parseDeviceCommand("click", {
              ...input,
              ...(point ? point : {}),
            }),
          )
        } catch (error) {
          return {
            ok: false as const,
            code: "tool_execution_error",
            error:
              error instanceof Error
                ? error.message
                : "Erro desconhecido ao executar device-click.",
          }
        }
      },
    }),
    [DEVICE_SCROLL_TOOL_NAME]: tool({
      description: scrollDescription,
      inputSchema: deviceScrollInputSchema,
      execute: async ({ deviceId, screenshotId, ...input }) => {
        try {
          const resolved = await resolveMousePoints(
            deviceId,
            screenshotId,
            input.x !== undefined && input.y !== undefined
              ? [{ x: input.x, y: input.y }]
              : [],
          )

          if (!resolved.ok) {
            return resolved
          }

          const point = input.x !== undefined ? resolved.points[0] : undefined

          if (input.x !== undefined && !point) {
            return {
              ok: false as const,
              code: "invalid_coordinates",
              error: "Não foi possível resolver as coordenadas da rolagem.",
            }
          }

          return await runCommand(
            deviceId,
            parseDeviceCommand("scroll", {
              ...input,
              ...(point ? point : {}),
            }),
          )
        } catch (error) {
          return {
            ok: false as const,
            code: "tool_execution_error",
            error:
              error instanceof Error
                ? error.message
                : "Erro desconhecido ao executar device-scroll.",
          }
        }
      },
    }),
    [DEVICE_DRAG_TOOL_NAME]: tool({
      description: dragDescription,
      inputSchema: deviceDragInputSchema,
      execute: async ({ deviceId, screenshotId, ...input }) => {
        try {
          const resolved = await resolveMousePoints(deviceId, screenshotId, [
            input.from,
            input.to,
          ])

          if (!resolved.ok) {
            return resolved
          }

          const [from, to] = resolved.points

          if (!from || !to) {
            return {
              ok: false as const,
              code: "invalid_coordinates",
              error: "Não foi possível resolver as coordenadas do arrasto.",
            }
          }

          return await runCommand(
            deviceId,
            parseDeviceCommand("drag", { ...input, from, to }),
          )
        } catch (error) {
          return {
            ok: false as const,
            code: "tool_execution_error",
            error:
              error instanceof Error
                ? error.message
                : "Erro desconhecido ao executar device-drag.",
          }
        }
      },
    }),
    [DEVICE_LIST_FILES_TOOL_NAME]: tool({
      description: listFilesDescription,
      inputSchema: deviceListFilesInputSchema,
      execute: async ({ deviceId, ...input }) => {
        try {
          return await runCommand(deviceId, {
            command: "list-files",
            input,
          })
        } catch (error) {
          return {
            ok: false as const,
            code: "tool_execution_error",
            error:
              error instanceof Error
                ? error.message
                : "Erro desconhecido ao executar device-list-files.",
          }
        }
      },
    }),
    [DEVICE_READ_FILE_TOOL_NAME]: tool({
      description: readFileDescription,
      inputSchema: deviceReadFileInputSchema,
      execute: async ({ deviceId, ...input }) => {
        try {
          return await runCommand(deviceId, {
            command: "read-file",
            input,
          })
        } catch (error) {
          return {
            ok: false as const,
            code: "tool_execution_error",
            error:
              error instanceof Error
                ? error.message
                : "Erro desconhecido ao executar device-read-file.",
          }
        }
      },
    }),
    [DEVICE_GLOB_TOOL_NAME]: tool({
      description: globDescription,
      inputSchema: deviceGlobInputSchema,
      execute: async ({ deviceId, ...input }) => {
        try {
          return await runCommand(deviceId, {
            command: "glob",
            input,
          })
        } catch (error) {
          return {
            ok: false as const,
            code: "tool_execution_error",
            error:
              error instanceof Error
                ? error.message
                : "Erro desconhecido ao executar device-glob.",
          }
        }
      },
    }),
    [DEVICE_GREP_TOOL_NAME]: tool({
      description: grepDescription,
      inputSchema: deviceGrepInputSchema,
      execute: async ({ deviceId, ...input }) => {
        try {
          return await runCommand(deviceId, {
            command: "grep",
            input,
          })
        } catch (error) {
          return {
            ok: false as const,
            code: "tool_execution_error",
            error:
              error instanceof Error
                ? error.message
                : "Erro desconhecido ao executar device-grep.",
          }
        }
      },
    }),
    [DEVICE_CHECK_ADMIN_TOOL_NAME]: tool({
      description: checkAdminDescription,
      inputSchema: deviceCheckAdminInputSchema,
      execute: async ({ deviceId }) => {
        try {
          return await runCommand(deviceId, {
            command: "check-admin",
            input: {},
          })
        } catch (error) {
          return {
            ok: false as const,
            code: "tool_execution_error",
            error:
              error instanceof Error
                ? error.message
                : "Erro desconhecido ao executar device-check-admin.",
          }
        }
      },
    }),
    [DEVICE_WRITE_FILE_TOOL_NAME]: tool({
      description: writeFileDescription,
      inputSchema: deviceWriteFileInputSchema,
      execute: async ({ deviceId, ...input }) => {
        try {
          return await runCommand(deviceId, {
            command: "write-file",
            input,
          })
        } catch (error) {
          return {
            ok: false as const,
            code: "tool_execution_error",
            error:
              error instanceof Error
                ? error.message
                : "Erro desconhecido ao executar device-write-file.",
          }
        }
      },
    }),
    [DEVICE_EDIT_FILE_TOOL_NAME]: tool({
      description: editFileDescription,
      inputSchema: deviceEditFileInputSchema,
      execute: async ({ deviceId, ...input }) => {
        try {
          return await runCommand(deviceId, {
            command: "edit-file",
            input,
          })
        } catch (error) {
          return {
            ok: false as const,
            code: "tool_execution_error",
            error:
              error instanceof Error
                ? error.message
                : "Erro desconhecido ao executar device-edit-file.",
          }
        }
      },
    }),
    [DEVICE_MKDIR_TOOL_NAME]: tool({
      description: mkdirDescription,
      inputSchema: deviceMkdirInputSchema,
      execute: async ({ deviceId, ...input }) => {
        try {
          return await runCommand(deviceId, {
            command: "mkdir",
            input,
          })
        } catch (error) {
          return {
            ok: false as const,
            code: "tool_execution_error",
            error:
              error instanceof Error
                ? error.message
                : "Erro desconhecido ao executar device-mkdir.",
          }
        }
      },
    }),
    [DEVICE_STAT_TOOL_NAME]: tool({
      description: statDescription,
      inputSchema: deviceStatInputSchema,
      execute: async ({ deviceId, ...input }) => {
        try {
          return await runCommand(deviceId, {
            command: "stat",
            input,
          })
        } catch (error) {
          return {
            ok: false as const,
            code: "tool_execution_error",
            error:
              error instanceof Error
                ? error.message
                : "Erro desconhecido ao executar device-stat.",
          }
        }
      },
    }),
    [DEVICE_COPY_TOOL_NAME]: tool({
      description: copyDescription,
      inputSchema: deviceCopyInputSchema,
      execute: async ({ deviceId, ...input }) => {
        try {
          return await runCommand(deviceId, {
            command: "copy",
            input,
          })
        } catch (error) {
          return {
            ok: false as const,
            code: "tool_execution_error",
            error:
              error instanceof Error
                ? error.message
                : "Erro desconhecido ao executar device-copy.",
          }
        }
      },
    }),
    [DEVICE_MOVE_TOOL_NAME]: tool({
      description: moveDescription,
      inputSchema: deviceMoveInputSchema,
      execute: async ({ deviceId, ...input }) => {
        try {
          return await runCommand(deviceId, {
            command: "move",
            input,
          })
        } catch (error) {
          return {
            ok: false as const,
            code: "tool_execution_error",
            error:
              error instanceof Error
                ? error.message
                : "Erro desconhecido ao executar device-move.",
          }
        }
      },
    }),
    [DEVICE_DELETE_TOOL_NAME]: tool({
      description: deleteDescription,
      inputSchema: deviceDeleteInputSchema,
      execute: async ({ deviceId, ...input }) => {
        try {
          return await runCommand(deviceId, {
            command: "delete",
            input,
          })
        } catch (error) {
          return {
            ok: false as const,
            code: "tool_execution_error",
            error:
              error instanceof Error
                ? error.message
                : "Erro desconhecido ao executar device-delete.",
          }
        }
      },
    }),
    [DEVICE_APPLY_PATCH_TOOL_NAME]: tool({
      description: applyPatchDescription,
      inputSchema: deviceApplyPatchInputSchema,
      execute: async ({ deviceId, ...input }) => {
        try {
          return await runCommand(deviceId, {
            command: "apply-patch",
            input,
          })
        } catch (error) {
          return {
            ok: false as const,
            code: "tool_execution_error",
            error:
              error instanceof Error
                ? error.message
                : "Erro desconhecido ao executar device-apply-patch.",
          }
        }
      },
    }),
    [DEVICE_RUN_COMMAND_TOOL_NAME]: tool({
      description: runCommandDescription,
      inputSchema: deviceRunCommandInputSchema,
      execute: async ({ deviceId, ...input }) => {
        try {
          return await runCommand(deviceId, {
            command: "run-command",
            input,
          })
        } catch (error) {
          return {
            ok: false as const,
            code: "tool_execution_error",
            error:
              error instanceof Error
                ? error.message
                : "Erro desconhecido ao executar device-run-command.",
          }
        }
      },
    }),
    [DEVICE_LIST_WINDOWS_TOOL_NAME]: tool({
      description: listWindowsDescription,
      inputSchema: deviceListWindowsInputSchema,
      execute: async ({ deviceId, ...input }) => {
        try {
          return await runCommand(deviceId, {
            command: "list-windows",
            input,
          })
        } catch (error) {
          return {
            ok: false as const,
            code: "tool_execution_error",
            error:
              error instanceof Error
                ? error.message
                : "Erro desconhecido ao executar device-list-windows.",
          }
        }
      },
    }),
    [DEVICE_FOCUS_WINDOW_TOOL_NAME]: tool({
      description: focusWindowDescription,
      inputSchema: deviceFocusWindowInputSchema,
      execute: async ({ deviceId, windowId }) => {
        try {
          return await runCommand(deviceId, {
            command: "focus-window",
            input: { windowId },
          })
        } catch (error) {
          return {
            ok: false as const,
            code: "tool_execution_error",
            error:
              error instanceof Error
                ? error.message
                : "Erro desconhecido ao executar device-focus-window.",
          }
        }
      },
    }),
    [DEVICE_WINDOW_ACTION_TOOL_NAME]: tool({
      description: windowActionDescription,
      inputSchema: deviceWindowActionInputSchema,
      execute: async ({ deviceId, windowId, action }) => {
        try {
          return await runCommand(
            deviceId,
            parseDeviceCommand(`${action}-window`, { windowId }),
          )
        } catch (error) {
          return {
            ok: false as const,
            code: "tool_execution_error",
            error:
              error instanceof Error
                ? error.message
                : "Erro desconhecido ao executar device-window-action.",
          }
        }
      },
    }),
    [DEVICE_INSPECT_UI_TOOL_NAME]: tool({
      description: inspectUiDescription,
      inputSchema: deviceInspectUiInputSchema,
      execute: async ({ deviceId, ...input }) => {
        try {
          return await runCommand(deviceId, {
            command: "inspect-ui",
            input,
          })
        } catch (error) {
          return {
            ok: false as const,
            code: "tool_execution_error",
            error:
              error instanceof Error
                ? error.message
                : "Erro desconhecido ao executar device-inspect-ui.",
          }
        }
      },
      toModelOutput: async ({ output }) => {
        if (!output.ok) {
          return {
            type: "text",
            value: [
              `Falha ao inspecionar a interface: ${output.code ?? "command_failed"}.`,
              output.error ?? "O dispositivo não detalhou o erro.",
            ].join(" "),
          }
        }

        const ui = output.ui

        if (!ui) {
          return {
            type: "text",
            value:
              "O dispositivo respondeu sem os dados da inspeção de interface.",
          }
        }

        const lines = [
          `Janela ${ui.windowId} "${ui.windowTitle}": ${ui.elements.length} elemento(s) retornado(s), ${ui.scanned} nó(s) varrido(s)${ui.waitedMs > 0 ? `, esperou ${ui.waitedMs}ms pelo alvo` : ""}${ui.truncated ? ", resultado truncado" : ""}.`,
        ]

        for (const element of ui.elements) {
          const states = [
            element.enabled ? "habilitado" : "desabilitado",
            element.focused ? "focado" : null,
            element.selected === true
              ? "selecionado"
              : element.selected === false
                ? "não selecionado"
                : null,
            element.expanded === true
              ? "expandido"
              : element.expanded === false
                ? "colapsado"
                : null,
            element.offscreen ? "fora da tela" : null,
          ].filter((value): value is string => value !== null)
          const runtime = element.runtimeId
            ? `runtimeId=${element.runtimeId}`
            : "sem runtimeId"
          const center = element.center
            ? `centro=${element.center.x},${element.center.y}`
            : "sem centro"
          const actions =
            element.actions.length > 0
              ? `ações=${element.actions.join("|")}`
              : "sem ações de acessibilidade"
          const value =
            element.value === null ? null : `valor="${element.value}"`

          lines.push(
            `- [${element.role || "?"}] "${element.name}" (${[runtime, center, actions, value, states.join(", ")]
              .filter((part): part is string => part !== null)
              .join("; ")})`,
          )
        }

        lines.push(
          "Use device-ui-action com o runtimeId para agir sem mover o cursor. Se o alvo não estiver na lista, refine find/role, aumente depth/maxResults ou passe waitMs quando o conteúdo ainda estiver carregando.",
        )

        return { type: "text", value: lines.join("\n") }
      },
    }),
    [DEVICE_UI_ACTION_TOOL_NAME]: tool({
      description: uiActionDescription,
      inputSchema: deviceUiActionInputSchema,
      execute: async ({ deviceId, windowId, runtimeId, action, value, waitMs }) => {
        try {
          return await runCommand(
            deviceId,
            parseDeviceCommand("ui-action", {
              windowId,
              runtimeId,
              action,
              waitMs,
              ...(value === undefined ? {} : { value }),
            }),
          )
        } catch (error) {
          return {
            ok: false as const,
            code: "tool_execution_error",
            error:
              error instanceof Error
                ? error.message
                : "Erro desconhecido ao executar device-ui-action.",
          }
        }
      },
      toModelOutput: async ({ output }) => {
        if (!output.ok) {
          return {
            type: "text",
            value: [
              `Falha ao executar a ação de interface: ${output.code ?? "command_failed"}.`,
              output.error ?? "O dispositivo não detalhou o erro.",
            ].join(" "),
          }
        }

        const result = output.uiAction

        if (!result) {
          return {
            type: "text",
            value: "O dispositivo respondeu sem os dados da ação de interface.",
          }
        }

        const states = [
          result.element.enabled ? "habilitado" : "desabilitado",
          result.element.focused ? "focado" : null,
          result.element.selected === true
            ? "selecionado"
            : result.element.selected === false
              ? "não selecionado"
              : null,
          result.element.expanded === true
            ? "expandido"
            : result.element.expanded === false
              ? "colapsado"
              : null,
        ].filter((value): value is string => value !== null)

        return {
          type: "text",
          value: [
            `Ação "${result.action}" aplicada em [${result.element.role || "?"}] "${result.element.name}" na janela ${result.windowId}.`,
            result.element.runtimeId
              ? `runtimeId=${result.element.runtimeId}.`
              : "O elemento não expõe runtimeId.",
            `Estado após a ação (ou último conhecido, se o elemento foi removido): ${states.join(", ")}.`,
            result.element.value === null
              ? null
              : `Valor atual do controle: "${result.element.value}".`,
            result.waitedMs > 0
              ? `O runtimeId só apareceu depois de ${result.waitedMs}ms; a árvore estava mudando.`
              : null,
            result.hint ?? null,
            "Confirme o efeito esperado: capture a tela ou inspecione a interface de novo quando a ação puder ter mudado a árvore.",
          ]
            .filter((line): line is string => line !== null)
            .join(" "),
        }
      },
    }),
    [DEVICE_SCREENSHOT_TOOL_NAME]: tool({
      description: screenshotDescription,
      inputSchema: deviceScreenshotInputSchema,
      execute: async ({
        deviceId,
        screenshotId,
        windowId,
        region,
        ...input
      }): Promise<DeviceScreenshotToolOutput> => {
        try {
          const resolvedRegion = await resolveScreenshotRegion(
            deviceId,
            screenshotId,
            region,
          )

          if (!resolvedRegion.ok) {
            return resolvedRegion
          }

          const targetRegion = resolvedRegion.region
          const maxWidth = targetRegion
            ? Math.max(
                input.maxWidth,
                Math.min(targetRegion.width, DEVICE_SCREENSHOT_MAX_WIDTH_MAX),
              )
            : input.maxWidth

          const output = await sendDeviceCommand({
            userId,
            deviceId,
            command: parseDeviceCommand("screenshot", {
              ...input,
              maxWidth,
              ...(targetRegion ? { region: targetRegion } : {}),
              ...(windowId ? { windowId } : {}),
            }),
            timeoutMs: SCREENSHOT_COMMAND_TIMEOUT_MS,
          })

          if (!output.ok) {
            return { ok: false, code: output.code, error: output.error }
          }

          if (!output.result.ok) {
            return {
              ok: false,
              code: output.result.code ?? "command_failed",
              error: output.result.error,
            }
          }

          const screenshot = output.result.screenshot
          const imageBase64 = output.result.imageBase64

          if (!screenshot || !imageBase64) {
            return {
              ok: false,
              code: "invalid_response",
              error: "O dispositivo não retornou a captura de tela.",
            }
          }

          await saveScreenshot({
            id: screenshot.id,
            deviceId,
            format: screenshot.format,
            base64: imageBase64,
            width: screenshot.width,
            height: screenshot.height,
            region: screenshot.region,
          })

          return { ok: true, deviceId, screenshot }
        } catch (error) {
          return {
            ok: false,
            code: "tool_execution_error",
            error:
              error instanceof Error
                ? error.message
                : "Erro desconhecido ao executar device-screenshot.",
          }
        }
      },
      toModelOutput: async ({ output }) => {
        if (!output.ok) {
          return {
            type: "text",
            value: [
              `Falha ao capturar a tela: ${output.code ?? "command_failed"}.`,
              output.error ?? "O dispositivo não detalhou o erro.",
            ].join(" "),
          }
        }

        const { screenshot } = output
        const stored = await getScreenshot(screenshot.id)
        const scaleX = screenshot.region.width / screenshot.width
        const scaleY = screenshot.region.height / screenshot.height
        const downscaled = scaleX > 1.05 || scaleY > 1.05
        const summary = [
          `Captura ${screenshot.id} de ${output.deviceId}: ${screenshot.width}x${screenshot.height}px, ${screenshot.format.toUpperCase()}, ${Math.round(screenshot.byteLength / 1024)} KB.`,
          screenshot.monitor !== null
            ? `Monitor ${screenshot.monitor}.`
            : "Sem índice de monitor (tela inteira, janela ou região).",
          `Região de origem: x=${screenshot.region.x}, y=${screenshot.region.y}, ${screenshot.region.width}x${screenshot.region.height}. Escala do SO: ${screenshot.scale}.`,
          `Para clicar ou arrastar, use screenshotId="${screenshot.id}" com x/y inteiros normalizados de 0 a 1000 (0 = borda esquerda/topo; 1000 = borda direita/baixo). O servidor converte para a tela; não converta manualmente.`,
          `Para ampliar um alvo pequeno, chame device-screenshot novamente com screenshotId="${screenshot.id}" e region normalizado (x, y, width, height de 0 a 1000).`,
          `Se precisar de pixels nativos, converta: nativoX = ${screenshot.region.x} + imagemX * ${Math.round(scaleX * 10_000) / 10_000}; nativoY = ${screenshot.region.y} + imagemY * ${Math.round(scaleY * 10_000) / 10_000}.`,
          downscaled
            ? `A imagem foi reduzida em relação à região nativa (fator ${Math.round(scaleX * 100) / 100}x). Para alvos pequenos, capture um recorte com region para não perder detalhe.`
            : "A imagem não foi reduzida: cada pixel da imagem corresponde a um pixel nativo.",
        ].join(" ")

        if (!stored) {
          return {
            type: "text",
            value: `${summary} A imagem não está mais disponível para visualização.`,
          }
        }

        return {
          type: "content",
          value: [
            {
              type: "text",
              text: `${summary} A imagem está anexada a seguir; use-a para decidir o próximo passo e confirme o resultado com o usuário.`,
            },
            {
              type: "file",
              mediaType: stored.format === "png" ? "image/png" : "image/jpeg",
              data: { type: "data", data: stored.bytes.toString("base64") },
            },
          ],
        }
      },
    }),
  }
}
