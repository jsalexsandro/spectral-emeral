import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core"

export const devices = pgTable(
  "Device",
  {
    id: text("id").primaryKey(),
    userId: text("userId").notNull(),
    name: text("name").notNull(),
    hostname: text("hostname"),
    platform: text("platform").notNull(),
    architecture: text("architecture"),
    publicKey: text("publicKey").notNull(),
    fingerprint: text("fingerprint").notNull(),
    lastSeenAt: timestamp("lastSeenAt", { mode: "date" }),
    revokedAt: timestamp("revokedAt", { mode: "date" }),
    defaultWorkingDirectory: text("defaultWorkingDirectory"),
    createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
  },
  (device) => ({
    fingerprintIdx: index("Device_fingerprint_idx").on(device.fingerprint),
  }),
)
