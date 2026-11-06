import { and, eq, isNull } from "drizzle-orm"
import { auth } from "@/auth"
import { db } from "@/db"
import { devices } from "@/db/schema"
import { sendDeviceCommand } from "@/lib/devices/command-client"
import { checkRateLimit } from "@/lib/devices/rate-limit"
import { openDeviceAppSchema } from "@/lib/validations/device"

type RouteContext = { params: Promise<{ id: string }> }

const RATE_LIMIT_MAX = 10
const RATE_LIMIT_WINDOW_MS = 10_000

function statusForCommandError(code: string): number {
  switch (code) {
    case "device_not_found":
      return 404
    case "device_offline":
    case "device_busy":
    case "device_disconnected":
    case "command_failed":
    case "invalid_app":
      return 409
    case "command_timeout":
      return 504
    default:
      return 502
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  const session = await auth()

  if (!session?.user?.id) {
    return Response.json({ error: "unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const userId = session.user.id
  const rateLimit = checkRateLimit(
    `open-app:${userId}:${id}`,
    RATE_LIMIT_MAX,
    RATE_LIMIT_WINDOW_MS,
  )

  if (!rateLimit.ok) {
    return Response.json(
      {
        error: "rate_limited",
        message: "Muitas tentativas. Aguarde um instante.",
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(
            Math.max(1, Math.ceil(rateLimit.retryAfterMs / 1000)),
          ),
        },
      },
    )
  }

  let payload: unknown

  try {
    payload = await request.json()
  } catch {
    return Response.json({ error: "invalid_payload" }, { status: 400 })
  }

  const parsed = openDeviceAppSchema.safeParse(payload)

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
    const [device] = await db
      .select({ id: devices.id })
      .from(devices)
      .where(
        and(
          eq(devices.id, id),
          eq(devices.userId, userId),
          isNull(devices.revokedAt),
        ),
      )
      .limit(1)

    if (!device) {
      return Response.json({ error: "device_not_found" }, { status: 404 })
    }

    const output = await sendDeviceCommand({
      userId,
      deviceId: id,
      command: {
        command: "open-app",
        input: { appId: parsed.data.appId },
      },
    })

    if (!output.ok) {
      return Response.json(
        { error: output.code, message: output.error },
        { status: statusForCommandError(output.code) },
      )
    }

    if (!output.result.ok) {
      const code = output.result.code ?? "command_failed"

      return Response.json(
        { error: code, message: output.result.error },
        { status: statusForCommandError(code) },
      )
    }

    return Response.json({
      ok: true,
      ...(output.result.output ? { output: output.result.output } : {}),
    })
  } catch {
    return Response.json({ error: "internal_error" }, { status: 500 })
  }
}
