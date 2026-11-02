import { db } from "@/db"
import { devicePairingSessions } from "@/db/schema"
import {
  PAIRING_TTL_MS,
  generatePairingCode,
  getPublicKeyFingerprint,
  hashPairingCode,
} from "@/lib/devices/protocol"
import { checkRateLimit } from "@/lib/devices/rate-limit"
import { getClientIp } from "@/lib/devices/request"
import { createPairingSchema } from "@/lib/validations/device"

const POLL_INTERVAL_MS = 3_000
const MAX_ATTEMPTS = 3

export async function POST(request: Request) {
  const ip = getClientIp(request)
  const rateLimit = checkRateLimit(`pairing:${ip}`, 10, 60_000)

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

  const parsed = createPairingSchema.safeParse(payload)

  if (!parsed.success) {
    return Response.json(
      {
        error: "invalid_payload",
        issues: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    )
  }

  const { publicKey, hostname, platform, architecture } = parsed.data
  let fingerprint: string

  try {
    fingerprint = getPublicKeyFingerprint(publicKey)
  } catch {
    return Response.json({ error: "invalid_public_key" }, { status: 400 })
  }

  const expiresAt = new Date(Date.now() + PAIRING_TTL_MS)

  try {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      const code = generatePairingCode()
      const codeHash = hashPairingCode(code)

      try {
        const [session] = await db
          .insert(devicePairingSessions)
          .values({
            codeHash,
            publicKey,
            fingerprint,
            hostname: hostname ?? null,
            platform,
            architecture: architecture ?? null,
            expiresAt,
          })
          .returning({ id: devicePairingSessions.id })

        return Response.json({
          sessionId: session.id,
          code,
          expiresAt: expiresAt.toISOString(),
          pollIntervalMs: POLL_INTERVAL_MS,
        })
      } catch (error) {
        const isUniqueViolation =
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          (error as { code?: string }).code === "23505"

        if (!isUniqueViolation) {
          throw error
        }
      }
    }

    return Response.json({ error: "internal_error" }, { status: 500 })
  } catch {
    return Response.json({ error: "internal_error" }, { status: 500 })
  }
}
