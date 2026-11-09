import { and, eq, isNull } from "drizzle-orm"
import { auth } from "@/auth"
import { db } from "@/db"
import { devices } from "@/db/schema"
import { getScreenshot } from "@/lib/devices/screenshot-store"

type RouteContext = {
  params: Promise<{ id: string; screenshotId: string }>
}

export async function GET(_request: Request, { params }: RouteContext) {
  const session = await auth()

  if (!session?.user?.id) {
    return Response.json({ error: "unauthorized" }, { status: 401 })
  }

  const { id, screenshotId } = await params

  try {
    const [device] = await db
      .select({ id: devices.id })
      .from(devices)
      .where(
        and(
          eq(devices.id, id),
          eq(devices.userId, session.user.id),
          isNull(devices.revokedAt),
        ),
      )
      .limit(1)

    if (!device) {
      return Response.json({ error: "device_not_found" }, { status: 404 })
    }

    const screenshot = await getScreenshot(screenshotId)

    if (!screenshot || screenshot.deviceId !== id) {
      return Response.json({ error: "screenshot_not_found" }, { status: 404 })
    }

    return new Response(new Uint8Array(screenshot.bytes), {
      headers: {
        "content-type":
          screenshot.format === "png" ? "image/png" : "image/jpeg",
        "content-length": String(screenshot.bytes.byteLength),
        "cache-control": "private, max-age=600",
        "content-disposition": "inline",
        "x-content-type-options": "nosniff",
      },
    })
  } catch {
    return Response.json({ error: "internal_error" }, { status: 500 })
  }
}
