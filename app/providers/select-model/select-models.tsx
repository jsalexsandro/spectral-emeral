"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Check, Loader2, Search } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  isInstantModelEnabled,
  upsertInstantPreference,
  type InstantModelPreference,
} from "@/lib/ai/instant-models"
import {
  formatPricePerMillion,
  formatTokenCount,
  getModelKey,
  type AIModel,
} from "@/lib/ai/models"
import type { AIProvider } from "@/lib/ai/providers"
import { cn } from "@/lib/utils"

export type ModelGroup = {
  provider: AIProvider
  models: readonly AIModel[]
}

type SelectModelsProps = {
  groups: readonly ModelGroup[]
  preferences: readonly InstantModelPreference[]
  allowModelFallbackOnFailure: boolean
}

export function SelectModels({
  groups,
  preferences: initialPreferences,
  allowModelFallbackOnFailure: initialAllowFallback,
}: SelectModelsProps) {
  const [preferences, setPreferences] = useState(initialPreferences)
  const [pendingKeys, setPendingKeys] = useState<readonly string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [allowFallback, setAllowFallback] = useState(initialAllowFallback)
  const [savingFallback, setSavingFallback] = useState(false)

  const filteredGroups = useMemo(() => {
    const term = query.trim().toLowerCase()

    if (!term) {
      return groups
    }

    return groups
      .map(({ provider, models }) => ({
        provider,
        models: models.filter((model) =>
          [
            model.name,
            model.id,
            model.description,
            provider.name,
            provider.id,
            `${provider.id}/${model.id}`,
          ]
            .join(" ")
            .toLowerCase()
            .includes(term),
        ),
      }))
      .filter((group) => group.models.length > 0)
  }, [groups, query])

  async function handleToggle(model: AIModel, enabled: boolean) {
    const key = getModelKey(model)

    if (pendingKeys.includes(key)) {
      return
    }

    setError(null)
    setPreferences((current) =>
      upsertInstantPreference(current, {
        provider: model.provider,
        modelId: model.id,
        enabled,
      }),
    )
    setPendingKeys((current) => [...current, key])

    try {
      const response = await fetch("/api/instant-models", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: model.provider,
          modelId: model.id,
          enabled,
        }),
      })

      if (!response.ok) {
        throw new Error("Falha ao salvar")
      }
    } catch {
      setPreferences((current) =>
        upsertInstantPreference(current, {
          provider: model.provider,
          modelId: model.id,
          enabled: !enabled,
        }),
      )
      setError("Não foi possível salvar a preferência. Tente novamente.")
    } finally {
      setPendingKeys((current) => current.filter((item) => item !== key))
    }
  }

  async function handleFallbackToggle(enabled: boolean) {
    if (savingFallback) {
      return
    }

    const previous = allowFallback
    setAllowFallback(enabled)
    setSavingFallback(true)
    setError(null)

    try {
      const response = await fetch("/api/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allowModelFallbackOnFailure: enabled }),
      })

      if (!response.ok) {
        throw new Error("Falha ao salvar")
      }
    } catch {
      setAllowFallback(previous)
      setError(
        "Não foi possível salvar a preferência de alternância. Tente novamente.",
      )
    } finally {
      setSavingFallback(false)
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-10">
      <header className="space-y-4">
        <Link
          href="/app"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "-ml-2.5 w-fit",
          )}
        >
          <ArrowLeft />
          Voltar ao chat
        </Link>
        <div className="space-y-2">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Selecione seus modelos
          </h1>
          <p className="text-sm text-muted-foreground">
            Ative os modelos que devem aparecer na seleção rápida do chat.
            Modelos desativados continuam disponíveis no catálogo.
          </p>
        </div>
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Procurar modelo"
            aria-label="Procurar modelo"
            className="h-10 pl-9"
          />
        </div>
      </header>

      <section className="space-y-3 rounded-xl border border-border bg-card p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <h2 className="font-heading text-base font-semibold">
              Alternância entre modelos
            </h2>
            <p className="text-sm text-muted-foreground">
              Permitir alternação entre modelos em caso de falha?
            </p>
            <p className="text-xs text-muted-foreground">
              Quando ativado, se o modelo selecionado falhar, o Spectral tenta
              automaticamente o próximo modelo rápido ativado com chave
              configurada.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={allowFallback}
            aria-label="Permitir alternação entre modelos em caso de falha"
            disabled={savingFallback}
            onClick={() => void handleFallbackToggle(!allowFallback)}
            className={cn(
              "relative mt-1 inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
              allowFallback
                ? "border-primary bg-primary"
                : "border-border bg-muted",
            )}
          >
            <span
              className={cn(
                "pointer-events-none flex size-4 items-center justify-center rounded-full bg-background transition-transform",
                allowFallback ? "translate-x-6" : "translate-x-1",
              )}
            >
              {savingFallback ? (
                <Loader2 className="size-3 animate-spin text-muted-foreground" />
              ) : allowFallback ? (
                <Check className="size-3 text-primary" />
              ) : null}
            </span>
          </button>
        </div>
      </section>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {groups.length === 0 ? (
        <div className="space-y-1 rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Nenhum modelo disponível.</p>
          <p>Configure uma chave em BYOK no chat para usar seus provedores.</p>
        </div>
      ) : filteredGroups.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
          Nenhum modelo encontrado para “{query.trim()}”.
        </p>
      ) : (
        filteredGroups.map(({ provider, models }) => (
          <section key={provider.id} className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h2 className="font-heading text-base font-semibold">
                {provider.name}
              </h2>
              <span className="text-xs text-muted-foreground">
                {provider.description}
              </span>
            </div>
            <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
              {models.map((model) => {
                const key = getModelKey(model)
                const enabled = isInstantModelEnabled(model, preferences)
                const isPending = pendingKeys.includes(key)

                return (
                  <div key={key} className="flex items-start gap-4 p-4">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <p className="text-sm font-medium">{model.name}</p>
                        <span className="font-mono text-xs text-muted-foreground">
                          {provider.id}/{model.id}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {model.description}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {formatTokenCount(model.contextWindow)} de contexto ·{" "}
                        {formatPricePerMillion(model.pricing.inputPerMillion)}{" "}
                        entrada ·{" "}
                        {formatPricePerMillion(model.pricing.outputPerMillion)}{" "}
                        saída
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={enabled}
                      aria-label={`${enabled ? "Desativar" : "Ativar"} ${model.name}`}
                      disabled={isPending}
                      onClick={() => void handleToggle(model, !enabled)}
                      className={cn(
                        "relative mt-1 inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
                        enabled
                          ? "border-primary bg-primary"
                          : "border-border bg-muted",
                      )}
                    >
                      <span
                        className={cn(
                          "pointer-events-none flex size-4 items-center justify-center rounded-full bg-background transition-transform",
                          enabled ? "translate-x-6" : "translate-x-1",
                        )}
                      >
                        {isPending ? (
                          <Loader2 className="size-3 animate-spin text-muted-foreground" />
                        ) : enabled ? (
                          <Check className="size-3 text-primary" />
                        ) : null}
                      </span>
                    </button>
                  </div>
                )
              })}
            </div>
          </section>
        ))
      )}
    </main>
  )
}
