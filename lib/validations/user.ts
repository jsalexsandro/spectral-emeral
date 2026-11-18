import { z } from "zod";

const nameSchema = z
  .string()
  .trim()
  .min(2, "Informe seu nome")
  .max(80, "Nome muito longo");

const nicknameSchema = z
  .string()
  .trim()
  .max(40, "Apelido muito longo");

export const updateProfileSchema = z
  .object({
    name: nameSchema.optional(),
    nickname: nicknameSchema.nullable().optional(),
    allowModelFallbackOnFailure: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.nickname !== undefined ||
      data.allowModelFallbackOnFailure !== undefined,
    {
      message: "Nenhum campo para atualizar",
      path: ["name"],
    },
  );

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
