import { z } from "zod"

export const configSections = ["general", "account", "byok"] as const

export type ConfigSection = (typeof configSections)[number]

export const configSectionSchema = z.enum(configSections)
