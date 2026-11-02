import { and, eq, isNull } from "drizzle-orm"
import { db } from "../db/index.js"
import { devices } from "../db/schema.js"

export type DeviceRecord = {
  id: string
  userId: string
  publicKey: string
  fingerprint: string
  revokedAt: Date | null
}

export async function findDeviceById(
  id: string,
): Promise<DeviceRecord | null> {
  const [device] = await db
    .select({
      id: devices.id,
      userId: devices.userId,
      publicKey: devices.publicKey,
      fingerprint: devices.fingerprint,
      revokedAt: devices.revokedAt,
    })
    .from(devices)
    .where(eq(devices.id, id))
    .limit(1)

  return device ?? null
}

export async function touchDevice(id: string): Promise<boolean> {
  const now = new Date()

  const [updated] = await db
    .update(devices)
    .set({ lastSeenAt: now })
    .where(and(eq(devices.id, id), isNull(devices.revokedAt)))
    .returning({ id: devices.id })

  return Boolean(updated)
}
