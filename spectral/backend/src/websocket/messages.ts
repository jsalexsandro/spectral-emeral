import { z } from "zod"

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

export const clientMessageSchema = z.discriminatedUnion("type", [
  authenticateMessageSchema,
  proofMessageSchema,
  heartbeatMessageSchema,
  disconnectMessageSchema,
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
