export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")

  if (forwarded) {
    const [first] = forwarded.split(",")
    const value = first?.trim()

    if (value) {
      return value
    }
  }

  return request.headers.get("x-real-ip")?.trim() || "unknown"
}
