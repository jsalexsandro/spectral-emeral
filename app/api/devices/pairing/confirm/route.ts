import { and, eq, isNull } from "drizzle-orm"
import { auth } from "@/auth"
import { db } from "@/db"
import { devicePairingSessions, devices } from "@/db/schema"
import {
  hashPairingCode,
  normalizePairingCode,
  sanitizeDeviceName,
} from "@/lib/devices/protocol"
import { toDeviceSummary } from "@/lib/devices/presenter"
import { checkRateLimit } from "@/lib/devices/rate-limit"
import type { PairingErrorCode } from "@/lib/devices/types"
import { confirmPairingSchema } from "@/lib/validations/device"

type ConfirmResult =
  | { ok: false; error: PairingErrorCode }
  | { ok: true; device: typeof devices.$inferSelect }

function pairingError(code: PairingErrorCode, status: number) {
  return Response.json({ error: code }, { status })
}

export async function POST(request: Request) {
  const session = await auth()

  if (!session?.user?.id) {
    return Response.json({ error: "unauthorized" }, { status: 401 })
  }

  const rateLimit = checkRateLimit(
    `pairing-confirm:${session.user.id}`,
    5,
    60_000,
  )

  if (!rateLimit.ok) {
    return Response.json(
      { error: "rate_limited" },
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

  const parsed = confirmPairingSchema.safeParse(payload)

  if (!parsed.success) {
    return Response.json({ error: "invalid_code" }, { status: 400 })
  }

  const code = normalizePairingCode(parsed.data.code)

  try {
    const result = await db.transaction(async (tx): Promise<ConfirmResult> => {
      const codeHash = hashPairingCode(code)

      const [pairing] = await tx
        .select()
        .from(devicePairingSessions)
        .where(eq(devicePairingSessions.codeHash, codeHash))
        .for("update")
        .limit(1)

      if (!pairing) {
        return { ok: false, error: "invalid_code" as const }
      }

      if (pairing.consumedAt) {
        return { ok: false, error: "used_code" as const }
      }

      if (pairing.expiresAt.getTime() <= Date.now()) {
        return { ok: false, error: "expired_code" as const }
      }

      const [existing] = await tx
        .select({ id: devices.id })
        .from(devices)
        .where(
          and(
            eq(devices.userId, session.user.id),
            eq(devices.fingerprint, pairing.fingerprint),
            isNull(devices.revokedAt),
          ),
        )
        .limit(1)

      if (existing) {
        return { ok: false, error: "already_paired" as const }
      }

      const now = new Date()

      const [device] = await tx
        .insert(devices)
        .values({
          userId: session.user.id,
          name: sanitizeDeviceName(pairing.hostname),
          hostname: pairing.hostname,
          platform: pairing.platform,
          architecture: pairing.architecture,
          publicKey: pairing.publicKey,
          fingerprint: pairing.fingerprint,
          lastSeenAt: null,
          updatedAt: now,
        })
        .returning()

      await tx
        .update(devicePairingSessions)
        .set({ consumedAt: now, deviceId: device.id })
        .where(eq(devicePairingSessions.id, pairing.id))

      return { ok: true, device }
    })

    if (!result.ok) {
      const status =
        result.error === "invalid_code"
          ? 404
          : result.error === "expired_code"
            ? 410
            : 409

      return pairingError(result.error, status)
    }

    return Response.json({ device: toDeviceSummary(result.device) })
  } catch {
    return Response.json({ error: "internal_error" }, { status: 500 })
  }
}
