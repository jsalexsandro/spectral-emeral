import {
  index,
  integer,
  jsonb,
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
    defaultWorkingDirectory: text("defaultWorkingDirectory"),
    /**
     * Apps cadastrados pelo usuário para este dispositivo:
     * `[{ name, path }]`. Usados por `device-open-app` para abrir executáveis
     * fora da descoberta automática.
     */
    customApps: jsonb("customApps").$type<{ name: string; path: string }[]>(),
    /**
     * Preferência de confirmação do dispositivo. Estrutura:
     * `{ confirmDestructive: boolean, confirmInstall?: boolean, updatedAt?: string }`.
     * A ausência de `confirmInstall` equivale a exigir confirmação para
     * instalações (padrão seguro).
     */
    executionPolicy: jsonb("executionPolicy").$type<{
      confirmDestructive: boolean
      confirmInstall?: boolean
      updatedAt?: string
    }>(),
    /** Coluna aposentada: mantida para não divergir da migration 0009. */
    notes: text("notes"),
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

/**
 * Trilha de auditoria do plano de execução. Nunca grava stdout/stderr brutos:
 * apenas metadados suficientes para reconstruir quem pediu, o que decidiu e
 * qual foi o resultado.
 */
export const deviceAuditEvents = pgTable(
  "DeviceAuditEvent",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    deviceId: text("deviceId")
      .notNull()
      .references(() => devices.id, { onDelete: "cascade" }),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    chatId: text("chatId"),
    toolName: text("toolName").notNull(),
    command: text("command"),
    risk: text("risk").notNull(),
    /** approval-requested | approved | denied | executed | failed */
    decision: text("decision").notNull(),
    policy: text("policy").notNull(),
    mode: text("mode").notNull(),
    durationMs: integer("durationMs"),
    exitCode: integer("exitCode"),
    errorCode: text("errorCode"),
    createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  },
  (event) => ({
    deviceCreatedAtIdx: index(
      "DeviceAuditEvent_deviceId_createdAt_idx",
    ).on(event.deviceId, event.createdAt),
    userCreatedAtIdx: index("DeviceAuditEvent_userId_createdAt_idx").on(
      event.userId,
      event.createdAt,
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
