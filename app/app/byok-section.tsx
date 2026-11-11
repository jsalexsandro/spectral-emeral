"use client"

import { useEffect, useMemo, useState } from "react"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import type { ByokProvider } from "@/lib/ai/providers"
import { AiProvidersCardComponent } from "./ai-providers-card"
import { ProviderConfigComponent } from "./provider-config-component"

export function ByokSection() {
  const [providers, setProviders] = useState<ByokProvider[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<ByokProvider | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  // As atualizações de estado só acontecem nos callbacks assíncronos, nunca no
  // corpo do efeito.
  useEffect(() => {
    const controller = new AbortController()

    fetch("/api/byok", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Falha ao carregar")
        }

        const data = (await response.json()) as { providers: ByokProvider[] }

        if (!controller.signal.aborted) {
          setProviders(data.providers)
          setHasError(false)
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setHasError(true)
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      })

    return () => controller.abort()
  }, [reloadKey])

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()

    if (!term) {
      return providers
    }

    return providers.filter((provider) =>
      [provider.name, provider.id, provider.description]
        .join(" ")
        .toLowerCase()
        .includes(term),
    )
  }, [providers, query])

  function handleSaved(updated: ByokProvider) {
    setProviders((current) =>
      current.map((provider) =>
        provider.id === updated.id ? updated : provider,
      ),
    )
    setSelected(null)
  }

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h3 className="font-heading text-base font-semibold">BYOK</h3>
        <p className="text-sm text-muted-foreground">
          Use suas próprias chaves de API no Spectral.
        </p>
      </header>

      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Pesquisar provedores"
          aria-label="Pesquisar provedores"
          className="h-10 pl-9"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((item) => (
            <Skeleton key={item} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : hasError ? (
        <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
          <p>Não foi possível carregar os provedores.</p>
          <button
            type="button"
            onClick={() => {
              setIsLoading(true)
              setReloadKey((current) => current + 1)
            }}
            className="mt-1 font-medium text-primary underline-offset-4 hover:underline"
          >
            Tentar novamente
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
          Nenhum provedor encontrado para “{query.trim()}”.
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((provider) => (
            <AiProvidersCardComponent
              key={provider.id}
              provider={provider}
              onConfigure={() => setSelected(provider)}
            />
          ))}
        </div>
      )}

      <ProviderConfigComponent
        provider={selected}
        onOpenChange={(open) => {
          if (!open) {
            setSelected(null)
          }
        }}
        onSaved={handleSaved}
      />
    </div>
  )
}
