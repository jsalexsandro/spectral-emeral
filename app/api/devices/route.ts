import { and, desc, eq, isNull } from "drizzle-orm"
import { auth } from "@/auth"
import { db } from "@/db"
import { devices } from "@/db/schema"
import { toDeviceSummary } from "@/lib/devices/presenter"

export async function GET() {
  const session = await auth()

  if (!session?.user?.id) {
    return Response.json({ error: "unauthorized" }, { status: 401 })
  }

  try {
    const rows = await db
      .select()
      .from(devices)
      .where(
        and(
          eq(devices.userId, session.user.id),
          isNull(devices.revokedAt),
        ),
      )
      .orderBy(desc(devices.createdAt))

    return Response.json({ devices: rows.map(toDeviceSummary) })
  } catch {
    return Response.json({ error: "internal_error" }, { status: 500 })
  }
}
