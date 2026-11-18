import { z } from "zod"
import {
  DEVICE_APP_ARGS_MAX,
  DEVICE_APP_ARG_MAX_LENGTH,
  DEVICE_APP_ID_PATTERN,
  DEVICE_APP_NAME_MAX_LENGTH,
  DEVICE_PATH_MAX_LENGTH,
  isAbsoluteAppPath,
} from "@/lib/devices/commands"
import {
  DEVICE_CUSTOM_APPS_MAX,
  DEVICE_CUSTOM_APP_NAME_MAX_LENGTH,
} from "@/lib/devices/custom-apps"
import { DEVICE_NAME_MAX_LENGTH } from "@/lib/devices/constants"
import {
  DEVICE_JOB_ID_MAX_LENGTH,
  DEVICE_JOB_LABEL_MAX_LENGTH,
  DEVICE_JOB_MAX_RUNTIME_DEFAULT_MS,
  DEVICE_JOB_MAX_RUNTIME_MIN_MS,
  DEVICE_JOB_MAX_RUNTIME_MS,
  DEVICE_JOB_OUTPUT_DEFAULT_BYTES,
  DEVICE_JOB_OUTPUT_MAX_BYTES,
  DEVICE_JOB_OUTPUT_MIN_BYTES,
  DEVICE_JOB_WAIT_DEFAULT_MS,
  DEVICE_JOB_WAIT_MAX_MS,
  DEVICE_JOB_WAIT_MIN_MS,
  DEVICE_SHELL_ENV_NAME_MAX_LENGTH,
  DEVICE_SHELL_ENV_VALUE_MAX_LENGTH,
  DEVICE_SHELL_KINDS,
  DEVICE_SHELL_SCRIPT_MAX_LENGTH,
} from "@/spectral/shared/device-commands"

const hostnameSchema = z
  .string()
  .trim()
  .max(255, "Hostname muito longo")
  .optional()

const platformSchema = z
  .string()
  .trim()
  .min(1, "Informe a plataforma")
  .max(80, "Plataforma muito longa")

const architectureSchema = z
  .string()
  .trim()
  .max(40, "Arquitetura muito longa")
  .optional()

const devicePathSchema = z
  .string()
  .trim()
  .max(1024, "Caminho muito longo")
  .optional()
  .refine(
    (value) => {
      if (!value) {
        return true
      }
      return !/[\u0000-\u001f\u007f]/.test(value)
    },
    "O caminho contém caracteres inválidos.",
  )

export const createPairingSchema = z.object({
  publicKey: z
    .string()
    .trim()
    .min(40, "Chave pública inválida")
    .max(2_048, "Chave pública muito longa"),
  hostname: hostnameSchema,
  platform: platformSchema,
  architecture: architectureSchema,
})

export const confirmPairingSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Informe o código")
    .max(16, "Código inválido"),
})

const customAppPathSchema = z
  .string()
  .trim()
  .min(1, "Informe o caminho do aplicativo")
  .max(1024, "Caminho muito longo")
  .refine(isAbsoluteAppPath, "Use um caminho absoluto para o executável.")
  .refine(
    (value) => !/[\u0000-\u001f\u007f]/.test(value),
    "O caminho contém caracteres inválidos.",
  )

const customAppSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Informe um nome")
    .max(DEVICE_CUSTOM_APP_NAME_MAX_LENGTH, "Nome muito longo"),
  path: customAppPathSchema,
})

export const renameDeviceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Informe um nome")
    .max(DEVICE_NAME_MAX_LENGTH, "Nome muito longo")
    .optional(),
  defaultWorkingDirectory: z
    .union([devicePathSchema, z.null()])
    .describe("Pasta padrão do dispositivo para execução de comandos."),
  confirmDestructive: z
    .boolean()
    .describe("Pedir confirmação para ações destrutivas ou de sistema.")
    .optional(),
  confirmInstall: z
    .boolean()
    .describe(
      "Permitir instalações de software sem confirmação caso a caso em Poder Total.",
    )
    .optional(),
  customApps: z
    .array(customAppSchema)
    .max(DEVICE_CUSTOM_APPS_MAX, "Muitos aplicativos personalizados.")
    .refine((apps) => {
      const names = new Set<string>()

      for (const app of apps) {
        const key = app.name.toLowerCase()

        if (names.has(key)) {
          return false
        }

        names.add(key)
      }

      return true
    }, "Os nomes dos aplicativos devem ser únicos.")
    .describe("Apps fora da descoberta automática, com nome e caminho.")
    .optional(),
}).refine(
  (data) =>
    data.name !== undefined ||
    data.defaultWorkingDirectory !== undefined ||
    data.confirmDestructive !== undefined ||
    data.confirmInstall !== undefined ||
    data.customApps !== undefined,
  {
    message: "Informe ao menos um campo para atualizar.",
    path: ["name"],
  },
)

export const openDeviceAppSchema = z.object({
  appId: z
    .string()
    .trim()
    .toLowerCase()
    .regex(DEVICE_APP_ID_PATTERN, "Identificador de aplicativo inválido.")
    .optional(),
  path: z
    .string()
    .trim()
    .min(1)
    .max(DEVICE_PATH_MAX_LENGTH)
    .refine(isAbsoluteAppPath, {
      message: "Use um caminho absoluto para o executável ou atalho.",
    })
    .optional(),
  args: z
    .array(
      z
        .string()
        .min(1)
        .max(DEVICE_APP_ARG_MAX_LENGTH)
        .refine((value) => !/[\u0000-\u001f\u007f]/.test(value), {
          message: "O argumento não pode conter caracteres de controle.",
        }),
    )
    .max(DEVICE_APP_ARGS_MAX)
    .optional(),
  cwd: z
    .string()
    .trim()
    .min(1)
    .max(DEVICE_PATH_MAX_LENGTH)
    .refine(isAbsoluteAppPath, {
      message: "Use um caminho absoluto para o diretório de trabalho.",
    })
    .optional(),
}).refine(
  (data) =>
    (data.appId ?? data.path) !== undefined &&
    !(data.appId && data.path),
  {
    message: 'Informe "appId" ou "path", mas não os dois.',
    path: ["appId"],
  },
)

export const registerDeviceAppSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Informe o nome do aplicativo")
    .max(DEVICE_APP_NAME_MAX_LENGTH, "Nome muito longo"),
  path: z
    .string()
    .trim()
    .min(1)
    .max(DEVICE_PATH_MAX_LENGTH)
    .refine(isAbsoluteAppPath, {
      message: "Use um caminho absoluto para o executável ou atalho.",
    }),
  args: z
    .array(
      z
        .string()
        .min(1)
        .max(DEVICE_APP_ARG_MAX_LENGTH)
        .refine((value) => !/[\u0000-\u001f\u007f]/.test(value), {
          message: "O argumento não pode conter caracteres de controle.",
        }),
    )
    .max(DEVICE_APP_ARGS_MAX)
    .optional(),
  cwd: z
    .string()
    .trim()
    .min(1)
    .max(DEVICE_PATH_MAX_LENGTH)
    .refine(isAbsoluteAppPath, {
      message: "Use um caminho absoluto para o diretório de trabalho.",
    })
    .optional(),
})

export const removeDeviceAppSchema = z.object({
  appId: z
    .string()
    .trim()
    .toLowerCase()
    .regex(DEVICE_APP_ID_PATTERN, "Identificador de aplicativo inválido."),
})

const jobIdSchema = z
  .string()
  .trim()
  .min(1, "Informe o job.")
  .max(DEVICE_JOB_ID_MAX_LENGTH, "Id do job muito longo.")

const jobWaitMsSchema = z.coerce
  .number()
  .int()
  .min(DEVICE_JOB_WAIT_MIN_MS)
  .max(DEVICE_JOB_WAIT_MAX_MS)
  .default(DEVICE_JOB_WAIT_DEFAULT_MS)

export const startDeviceJobSchema = z.object({
  script: z
    .string()
    .trim()
    .min(1, "Informe o script")
    .max(DEVICE_SHELL_SCRIPT_MAX_LENGTH, "Script muito longo"),
  shell: z.enum(DEVICE_SHELL_KINDS).default("auto"),
  cwd: z
    .string()
    .trim()
    .max(DEVICE_PATH_MAX_LENGTH, "Caminho muito longo")
    .optional(),
  env: z
    .record(
      z.string().max(DEVICE_SHELL_ENV_NAME_MAX_LENGTH),
      z.string().max(DEVICE_SHELL_ENV_VALUE_MAX_LENGTH),
    )
    .optional(),
  label: z
    .string()
    .trim()
    .max(DEVICE_JOB_LABEL_MAX_LENGTH, "Rótulo muito longo")
    .optional(),
  maxRuntimeMs: z
    .number()
    .int()
    .min(DEVICE_JOB_MAX_RUNTIME_MIN_MS)
    .max(DEVICE_JOB_MAX_RUNTIME_MS)
    .default(DEVICE_JOB_MAX_RUNTIME_DEFAULT_MS),
})

export const deviceJobQuerySchema = z.object({
  view: z.enum(["status", "output"]).default("status"),
  cursor: z.coerce.number().int().min(0).default(0),
  maxBytes: z.coerce
    .number()
    .int()
    .min(DEVICE_JOB_OUTPUT_MIN_BYTES)
    .max(DEVICE_JOB_OUTPUT_MAX_BYTES)
    .default(DEVICE_JOB_OUTPUT_DEFAULT_BYTES),
  waitMs: jobWaitMsSchema,
})

export const deviceJobIdSchema = jobIdSchema

export type CreatePairingInput = z.infer<typeof createPairingSchema>
export type ConfirmPairingInput = z.infer<typeof confirmPairingSchema>
export type RenameDeviceInput = z.infer<typeof renameDeviceSchema>
export type RegisterDeviceAppInput = z.infer<typeof registerDeviceAppSchema>
export type RemoveDeviceAppInput = z.infer<typeof removeDeviceAppSchema>
