import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import { createId } from "@paralleldrive/cuid2"
import { users } from "./auth"

export const devices = pgTable(
  "Device",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    hostname: text("hostname"),
    platform: text("platform").notNull(),
    architecture: text("architecture"),
    publicKey: text("publicKey").notNull(),
    fingerprint: text("fingerprint").notNull(),
    lastSeenAt: timestamp("lastSeenAt", { mode: "date" }),
    revokedAt: timestamp("revokedAt", { mode: "date" }),
    createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
  },
  (device) => ({
    userIdIdx: index("Device_userId_idx").on(device.userId),
    fingerprintIdx: index("Device_fingerprint_idx").on(device.fingerprint),
    userRevokedIdx: index("Device_userId_revokedAt_idx").on(
      device.userId,
      device.revokedAt,
    ),
  }),
)

export const devicePairingSessions = pgTable(
  "DevicePairingSession",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    codeHash: text("codeHash").notNull(),
    deviceId: text("deviceId").references(() => devices.id, {
      onDelete: "set null",
    }),
    publicKey: text("publicKey").notNull(),
    fingerprint: text("fingerprint").notNull(),
    hostname: text("hostname"),
    platform: text("platform").notNull(),
    architecture: text("architecture"),
    expiresAt: timestamp("expiresAt", { mode: "date" }).notNull(),
    consumedAt: timestamp("consumedAt", { mode: "date" }),
    createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  },
  (session) => ({
    codeHashUnique: uniqueIndex(
      "DevicePairingSession_codeHash_key",
    ).on(session.codeHash),
    expiresAtIdx: index("DevicePairingSession_expiresAt_idx").on(
      session.expiresAt,
    ),
    fingerprintIdx: index("DevicePairingSession_fingerprint_idx").on(
      session.fingerprint,
    ),
  }),
)
