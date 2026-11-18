import { auth } from "@/auth"
import { sendDeviceCommand } from "@/lib/devices/command-client"
import {
  checkJobRateLimit,
  ownsDevice,
  rateLimitedResponse,
  unwrapJobCommand,
} from "@/lib/devices/job-api"
import {
  deviceJobIdSchema,
  deviceJobQuerySchema,
} from "@/lib/validations/device"

type RouteContext = {
  params: Promise<{ id: string; jobId: string }>
}

export async function GET(request: Request, { params }: RouteContext) {
  const session = await auth()

  if (!session?.user?.id) {
    return Response.json({ error: "unauthorized" }, { status: 401 })
  }

  const { id, jobId } = await params
  const userId = session.user.id
  const rateLimit = checkJobRateLimit(`job-read:${userId}:${id}:${jobId}`)

  if (!rateLimit.ok) {
    return rateLimitedResponse(rateLimit.retryAfterMs)
  }

  const idResult = deviceJobIdSchema.safeParse(jobId)

  if (!idResult.success) {
    return Response.json({ error: "invalid_job_id" }, { status: 400 })
  }

  const url = new URL(request.url)
  const queryResult = deviceJobQuerySchema.safeParse({
    view: url.searchParams.get("view") ?? "status",
    cursor: url.searchParams.get("cursor") ?? 0,
    maxBytes: url.searchParams.get("maxBytes") ?? undefined,
    waitMs: url.searchParams.get("waitMs") ?? undefined,
  })

  if (!queryResult.success) {
    return Response.json(
      {
        error: "invalid_query",
        issues: queryResult.error.flatten().fieldErrors,
      },
      { status: 400 },
    )
  }

  const { view, cursor, maxBytes, waitMs } = queryResult.data

  try {
    if (!(await ownsDevice(id, userId))) {
      return Response.json({ error: "device_not_found" }, { status: 404 })
    }

    const output = await sendDeviceCommand({
      userId,
      deviceId: id,
      command:
        view === "output"
          ? {
              command: "job-output",
              input: { jobId: idResult.data, cursor, maxBytes, waitMs },
            }
          : {
              command: "job-status",
              input: { jobId: idResult.data, waitMs },
            },
    })

    const command = unwrapJobCommand(output)

    if (command instanceof Response) {
      return command
    }

    return Response.json({
      ok: true,
      ...(view === "output"
        ? { jobOutput: command.result.jobOutput }
        : { job: command.result.job }),
    })
  } catch {
    return Response.json({ error: "internal_error" }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const session = await auth()

  if (!session?.user?.id) {
    return Response.json({ error: "unauthorized" }, { status: 401 })
  }

  const { id, jobId } = await params
  const userId = session.user.id
  const rateLimit = checkJobRateLimit(`job-cancel:${userId}:${id}:${jobId}`)

  if (!rateLimit.ok) {
    return rateLimitedResponse(rateLimit.retryAfterMs)
  }

  const idResult = deviceJobIdSchema.safeParse(jobId)

  if (!idResult.success) {
    return Response.json({ error: "invalid_job_id" }, { status: 400 })
  }

  try {
    if (!(await ownsDevice(id, userId))) {
      return Response.json({ error: "device_not_found" }, { status: 404 })
    }

    const output = await sendDeviceCommand({
      userId,
      deviceId: id,
      command: { command: "job-cancel", input: { jobId: idResult.data } },
    })

    const command = unwrapJobCommand(output)

    if (command instanceof Response) {
      return command
    }

    return Response.json({
      ok: true,
      cancelled: command.result.cancelled ?? false,
      job: command.result.job,
    })
  } catch {
    return Response.json({ error: "internal_error" }, { status: 500 })
  }
}
