import { auth } from "@/auth"
import { sendDeviceCommand } from "@/lib/devices/command-client"
import {
  checkJobRateLimit,
  ownsDevice,
  rateLimitedResponse,
  unwrapJobCommand,
} from "@/lib/devices/job-api"
import { startDeviceJobSchema } from "@/lib/validations/device"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: RouteContext) {
  const session = await auth()

  if (!session?.user?.id) {
    return Response.json({ error: "unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const userId = session.user.id
  const rateLimit = checkJobRateLimit(`job-list:${userId}:${id}`)

  if (!rateLimit.ok) {
    return rateLimitedResponse(rateLimit.retryAfterMs)
  }

  try {
    if (!(await ownsDevice(id, userId))) {
      return Response.json({ error: "device_not_found" }, { status: 404 })
    }

    const output = await sendDeviceCommand({
      userId,
      deviceId: id,
      command: { command: "job-list", input: {} },
    })

    const command = unwrapJobCommand(output)

    if (command instanceof Response) {
      return command
    }

    return Response.json({
      ok: true,
      jobs: command.result.jobs ?? [],
    })
  } catch {
    return Response.json({ error: "internal_error" }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  const session = await auth()

  if (!session?.user?.id) {
    return Response.json({ error: "unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const userId = session.user.id
  const rateLimit = checkJobRateLimit(`job-start:${userId}:${id}`)

  if (!rateLimit.ok) {
    return rateLimitedResponse(rateLimit.retryAfterMs)
  }

  let payload: unknown

  try {
    payload = await request.json()
  } catch {
    return Response.json({ error: "invalid_payload" }, { status: 400 })
  }

  const parsed = startDeviceJobSchema.safeParse(payload)

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
    if (!(await ownsDevice(id, userId))) {
      return Response.json({ error: "device_not_found" }, { status: 404 })
    }

    const output = await sendDeviceCommand({
      userId,
      deviceId: id,
      command: { command: "job-start", input: parsed.data },
    })

    const command = unwrapJobCommand(output)

    if (command instanceof Response) {
      return command
    }

    return Response.json({
      ok: true,
      job: command.result.job,
    })
  } catch {
    return Response.json({ error: "internal_error" }, { status: 500 })
  }
}
