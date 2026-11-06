import { z } from "zod"
import { DEVICE_APP_ID_PATTERN } from "@/lib/devices/commands"
import { DEVICE_NAME_MAX_LENGTH } from "@/lib/devices/constants"

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

export const renameDeviceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Informe um nome")
    .max(DEVICE_NAME_MAX_LENGTH, "Nome muito longo")
    .optional(),
  defaultWorkingDirectory: devicePathSchema.describe(
    "Pasta padrão do dispositivo para execução de comandos.",
  ),
}).refine(
  (data) => data.name !== undefined || data.defaultWorkingDirectory !== undefined,
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
    .regex(DEVICE_APP_ID_PATTERN, "Identificador de aplicativo inválido."),
})

export type CreatePairingInput = z.infer<typeof createPairingSchema>
export type ConfirmPairingInput = z.infer<typeof confirmPairingSchema>
export type RenameDeviceInput = z.infer<typeof renameDeviceSchema>
