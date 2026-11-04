import { and, eq, isNull } from "drizzle-orm"
import { auth } from "@/auth"
import { db } from "@/db"
import { devices } from "@/db/schema"
import { toDeviceSummary } from "@/lib/devices/presenter"
import { renameDeviceSchema } from "@/lib/validations/device"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: RouteContext) {
  const session = await auth()

  if (!session?.user?.id) {
    return Response.json({ error: "unauthorized" }, { status: 401 })
  }

  const { id } = await params

  try {
    const [device] = await db
      .select()
      .from(devices)
      .where(and(eq(devices.id, id), eq(devices.userId, session.user.id)))
      .limit(1)

    if (!device) {
      return Response.json({ error: "device_not_found" }, { status: 404 })
    }

    return Response.json({
      device: toDeviceSummary(device),
      revokedAt: device.revokedAt?.toISOString() ?? null,
    })
  } catch {
    return Response.json({ error: "internal_error" }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const session = await auth()

  if (!session?.user?.id) {
    return Response.json({ error: "unauthorized" }, { status: 401 })
  }

  const { id } = await params

  let payload: unknown

  try {
    payload = await request.json()
  } catch {
    return Response.json({ error: "invalid_payload" }, { status: 400 })
  }

  const parsed = renameDeviceSchema.safeParse(payload)

  if (!parsed.success) {
    return Response.json(
      {
        error: "invalid_payload",
        issues: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    )
  }

  try {
    const [updated] = await db
      .update(devices)
      .set({
        ...(parsed.data.name !== undefined && { name: parsed.data.name }),
        ...(parsed.data.defaultWorkingDirectory !== undefined && {
          defaultWorkingDirectory: parsed.data.defaultWorkingDirectory,
        }),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(devices.id, id),
          eq(devices.userId, session.user.id),
          isNull(devices.revokedAt),
        ),
      )
      .returning()

    if (!updated) {
      return Response.json({ error: "device_not_found" }, { status: 404 })
    }

    return Response.json({ device: toDeviceSummary(updated) })
  } catch {
    return Response.json({ error: "internal_error" }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const session = await auth()

  if (!session?.user?.id) {
    return Response.json({ error: "unauthorized" }, { status: 401 })
  }

  const { id } = await params

  try {
    const now = new Date()

    const [revoked] = await db
      .update(devices)
      .set({ revokedAt: now, updatedAt: now })
      .where(
        and(
          eq(devices.id, id),
          eq(devices.userId, session.user.id),
          isNull(devices.revokedAt),
        ),
      )
      .returning({ id: devices.id })

    if (!revoked) {
      return Response.json({ error: "device_not_found" }, { status: 404 })
    }

    return Response.json({ ok: true })
  } catch {
    return Response.json({ error: "internal_error" }, { status: 500 })
  }
}
