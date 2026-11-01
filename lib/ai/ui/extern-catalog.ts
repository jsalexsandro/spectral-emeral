import { z } from "zod"

export const EXTERN_UI_TOOL_NAME = "externUi" as const

const boundedText = (max: number) => z.string().trim().min(1).max(max)
const optionalText = (max: number) => z.string().trim().min(1).max(max).optional()

export const externToastPropsSchema = z.object({
  title: boundedText(120),
  description: optionalText(500),
  variant: z.enum(["default", "success", "warning", "error", "info"]).default("default"),
  duration: z.number().int().min(1000).max(10_000).optional(),
})

export const externUiInputSchema = z.discriminatedUnion("component", [
  z.object({
    component: z.literal("toast"),
    props: externToastPropsSchema,
  }),
])

export type ExternToastProps = z.infer<typeof externToastPropsSchema>
export type ExternUiInput = z.infer<typeof externUiInputSchema>
