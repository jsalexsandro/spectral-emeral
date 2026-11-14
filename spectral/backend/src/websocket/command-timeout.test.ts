import { describe, expect, it } from "vitest"
import {
  MAX_COMMAND_TIMEOUT_MS,
  MIN_COMMAND_TIMEOUT_MS,
  TRANSPORT_GRACE_MS,
  clampCommandTimeoutMs,
  commandTransportTimeoutMs,
} from "./command-timeout.js"

describe("command transport timeout", () => {
  it("clampa o orçamento do driver no intervalo suportado", () => {
    expect(clampCommandTimeoutMs(undefined, 15_000)).toBe(15_000)
    expect(clampCommandTimeoutMs(Number.NaN, 15_000)).toBe(15_000)
    expect(clampCommandTimeoutMs(0, 15_000)).toBe(MIN_COMMAND_TIMEOUT_MS)
    expect(clampCommandTimeoutMs(45_000, 15_000)).toBe(45_000)
    expect(clampCommandTimeoutMs(600_000, 15_000)).toBe(MAX_COMMAND_TIMEOUT_MS)
  })

  it("espera o orçamento inteiro mais a folga de transporte", () => {
    // Um shell de 60s precisa de tempo para o driver matar a árvore e
    // responder; sem a folga o backend devolveria `command_timeout`.
    expect(commandTransportTimeoutMs(60_000, 15_000)).toBe(
      60_000 + TRANSPORT_GRACE_MS,
    )
    expect(commandTransportTimeoutMs(45_000, 15_000)).toBe(
      45_000 + TRANSPORT_GRACE_MS,
    )
    expect(commandTransportTimeoutMs(undefined, 15_000)).toBe(
      15_000 + TRANSPORT_GRACE_MS,
    )
  })
})
