import { z } from "zod"
import type { DeviceCommand } from "../../../shared/device-commands.js"

export const authenticateMessageSchema = z.object({
  type: z.literal("device:authenticate"),
  deviceId: z.string().min(1).max(128),
  fingerprint: z.string().min(1).max(128),
})

export const proofMessageSchema = z.object({
  type: z.literal("device:authenticate:proof"),
  signature: z.string().min(1).max(256),
})

export const heartbeatMessageSchema = z.object({
  type: z.literal("device:heartbeat"),
})

export const disconnectMessageSchema = z.object({
  type: z.literal("device:disconnect"),
})

export const commandResultMessageSchema = z.object({
  type: z.literal("device:command:result"),
  id: z.string().min(1).max(128),
  result: z.discriminatedUnion("ok", [
    z.object({
      ok: z.literal(true),
      output: z.string().max(4096).optional(),
      apps: z
        .array(
          z.object({
            id: z.string().min(1).max(64),
            name: z.string().min(1).max(128),
          }),
        )
        .max(200)
        .optional(),
      os: z
        .object({
          platform: z.string().min(1).max(64),
          type: z.string().min(1).max(64),
          release: z.string().min(1).max(128),
          version: z.string().min(1).max(256),
          architecture: z.string().min(1).max(64),
          elevated: z.boolean().optional(),
        })
        .optional(),
      entries: z
        .array(
          z.object({
            name: z.string().min(1).max(255),
            path: z.string().min(1).max(1024),
            type: z.enum(["file", "directory", "symlink", "other"]),
            size: z.number().int().nonnegative().nullable(),
            modifiedAt: z.string().max(64).nullable(),
          }),
        )
        .max(500)
        .optional(),
      file: z
        .object({
          path: z.string().min(1).max(1024),
          content: z.string().max(80_000),
          startLine: z.number().int().nonnegative(),
          endLine: z.number().int().nonnegative(),
          totalLines: z.number().int().nonnegative(),
          truncated: z.boolean(),
          size: z.number().int().nonnegative(),
        })
        .optional(),
      paths: z.array(z.string().min(1).max(1024)).max(200).optional(),
      matches: z
        .array(
          z.object({
            path: z.string().min(1).max(1024),
            line: z.number().int().nonnegative(),
            column: z.number().int().nonnegative(),
            text: z.string().max(300),
          }),
        )
        .max(200)
        .optional(),
      truncated: z.boolean().optional(),
      total: z.number().int().nonnegative().optional(),
      filesScanned: z.number().int().nonnegative().optional(),
      admin: z.boolean().optional(),
      write: z
        .object({
          path: z.string().min(1).max(1024),
          size: z.number().int().nonnegative(),
          created: z.boolean(),
        })
        .optional(),
      edit: z
        .object({
          path: z.string().min(1).max(1024),
          replacements: z.number().int().nonnegative(),
          oldTextLength: z.number().int().nonnegative(),
          newTextLength: z.number().int().nonnegative(),
        })
        .optional(),
    }),
    z.object({
      ok: z.literal(false),
      error: z.string().min(1).max(1000),
      code: z.string().min(1).max(64).optional(),
    }),
  ]),
})

export const clientMessageSchema = z.discriminatedUnion("type", [
  authenticateMessageSchema,
  proofMessageSchema,
  heartbeatMessageSchema,
  disconnectMessageSchema,
  commandResultMessageSchema,
])

export type ClientMessage = z.infer<typeof clientMessageSchema>

export type ServerMessage =
  | { type: "device:challenge"; challenge: string; expiresAt: string }
  | {
      type: "device:authenticated"
      deviceId: string
      serverTime: string
      heartbeatIntervalMs: number
      heartbeatTimeoutMs: number
    }
  | { type: "device:heartbeat:ack"; serverTime: string }
  | {
      type: "device:command"
      id: string
      command: DeviceCommand["command"]
      input: DeviceCommand["input"]
    }
  | { type: "device:error"; code: string; message: string }

export const closeCodes = {
  replaced: 4001,
  heartbeatTimeout: 4002,
  authTimeout: 4003,
  revokedDevice: 4004,
  unknownDevice: 4005,
  authFailed: 4006,
  rateLimited: 4007,
  invalidMessage: 4008,
  internalError: 4009,
  shuttingDown: 4010,
} as const
