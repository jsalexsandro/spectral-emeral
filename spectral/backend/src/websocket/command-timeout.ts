/**
 * Tempo que o transporte espera por um comando. O driver recebe `timeoutMs`
 * como orçamento de execução, então o backend precisa de uma folga para
 * receber o resultado depois do kill da árvore de processos. Sem a folga, um
 * shell que usa o orçamento inteiro empata com o timer do backend e vira
 * `command_timeout` mesmo tendo terminado.
 */
export const TRANSPORT_GRACE_MS = 5_000

export const MIN_COMMAND_TIMEOUT_MS = 1_000
export const MAX_COMMAND_TIMEOUT_MS = 60_000

/** Normaliza o orçamento do driver para o intervalo suportado. */
export function clampCommandTimeoutMs(
  timeoutMs: number | undefined,
  fallbackMs: number,
): number {
  const value = timeoutMs ?? fallbackMs

  if (!Number.isFinite(value)) {
    return fallbackMs
  }

  return Math.min(
    MAX_COMMAND_TIMEOUT_MS,
    Math.max(MIN_COMMAND_TIMEOUT_MS, Math.trunc(value)),
  )
}

/** Quanto o transporte deve esperar antes de desistir do comando. */
export function commandTransportTimeoutMs(
  timeoutMs: number | undefined,
  fallbackMs: number,
): number {
  return clampCommandTimeoutMs(timeoutMs, fallbackMs) + TRANSPORT_GRACE_MS
}
