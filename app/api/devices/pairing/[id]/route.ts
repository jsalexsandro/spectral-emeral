import { eq } from "drizzle-orm"
import { db } from "@/db"
import { devicePairingSessions } from "@/db/schema"
import type { PairingStatusResult } from "@/lib/devices/types"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params

  try {
    const [session] = await db
      .select({
        consumedAt: devicePairingSessions.consumedAt,
        expiresAt: devicePairingSessions.expiresAt,
        deviceId: devicePairingSessions.deviceId,
      })
      .from(devicePairingSessions)
      .where(eq(devicePairingSessions.id, id))
      .limit(1)

    if (!session) {
      return Response.json({ error: "session_not_found" }, { status: 404 })
    }

    if (session.consumedAt) {
      if (!session.deviceId) {
        return Response.json({ status: "expired" } satisfies PairingStatusResult)
      }

      return Response.json({
        status: "paired",
        deviceId: session.deviceId,
      } satisfies PairingStatusResult)
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      return Response.json({ status: "expired" } satisfies PairingStatusResult)
    }

    return Response.json({ status: "pending" } satisfies PairingStatusResult)
  } catch {
    return Response.json({ error: "internal_error" }, { status: 500 })
  }
}
