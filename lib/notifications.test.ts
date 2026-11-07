import { describe, expect, it } from "vitest"
import {
  buildNotificationPreview,
  resolveNotificationChannel,
} from "./notifications"

describe("resolveNotificationChannel", () => {
  const base = {
    enabled: true,
    permission: "granted" as const,
    supported: true,
  }

  it("usa notificação nativa quando a aba está em segundo plano", () => {
    expect(
      resolveNotificationChannel({ ...base, visibilityState: "hidden" }),
    ).toBe("native")
  })

  it("usa toast in-app quando a aba está visível", () => {
    expect(
      resolveNotificationChannel({ ...base, visibilityState: "visible" }),
    ).toBe("in-app")
  })

  it("não notifica quando a preferência está desativada", () => {
    expect(
      resolveNotificationChannel({
        ...base,
        enabled: false,
        visibilityState: "hidden",
      }),
    ).toBe("none")
  })

  it("não notifica sem permissão concedida", () => {
    expect(
      resolveNotificationChannel({
        ...base,
        permission: "default",
        visibilityState: "hidden",
      }),
    ).toBe("none")

    expect(
      resolveNotificationChannel({
        ...base,
        permission: "denied",
        visibilityState: "visible",
      }),
    ).toBe("none")
  })

  it("não notifica quando o navegador não oferece suporte", () => {
    expect(
      resolveNotificationChannel({
        ...base,
        supported: false,
        visibilityState: "hidden",
      }),
    ).toBe("none")
  })
})

describe("buildNotificationPreview", () => {
  it("normaliza espaços e quebras de linha", () => {
    expect(buildNotificationPreview("  Olá\n\nmundo   teste  ")).toBe(
      "Olá mundo teste",
    )
  })

  it("retorna vazio para texto vazio", () => {
    expect(buildNotificationPreview("   \n  ")).toBe("")
  })

  it("mantém textos curtos intactos", () => {
    expect(buildNotificationPreview("Resposta pronta")).toBe("Resposta pronta")
  })

  it("trunca textos longos com reticências", () => {
    const preview = buildNotificationPreview("a".repeat(120))

    expect(preview).toHaveLength(101)
    expect(preview.endsWith("…")).toBe(true)
  })

  it("respeita o limite customizado", () => {
    expect(buildNotificationPreview("abcdefghij", 5)).toBe("abcde…")
  })
})
