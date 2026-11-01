"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Bot, ChevronDown, SlidersHorizontal } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuHeading,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  getQuickModels,
  type InstantModelPreference,
} from "@/lib/ai/instant-models"
import { aiModels, getModelKey } from "@/lib/ai/models"
import { aiProviders, isProviderId, type ProviderId } from "@/lib/ai/providers"

type ModelSelectProps = {
  value: string
  onChange: (value: string) => void
  configuredProviders: readonly ProviderId[]
  instantPreferences: readonly InstantModelPreference[]
}

export function ModelSelect({
  value,
  onChange,
  configuredProviders,
  instantPreferences,
}: ModelSelectProps) {
  const [open, setOpen] = useState(false)
  const [providers, setProviders] =
    useState<readonly ProviderId[]>(configuredProviders)
  const [preferences, setPreferences] =
    useState<readonly InstantModelPreference[]>(instantPreferences)

  useEffect(() => {
    if (!open) {
      return
    }

    let cancelled = false

    async function refreshSelection() {
      try {
        const [byokResponse, preferencesResponse] = await Promise.all([
          fetch("/api/byok", { cache: "no-store" }),
          fetch("/api/instant-models", { cache: "no-store" }),
        ])

        if (cancelled) {
          return
        }

        if (byokResponse.ok) {
          const data = (await byokResponse.json()) as {
            providers?: { id: string; configured: boolean }[]
          }

          const next = (data.providers ?? [])
            .filter(
              (provider) => provider.configured && isProviderId(provider.id),
            )
            .map((provider) => provider.id as ProviderId)

          setProviders(next)
        }

        if (preferencesResponse.ok) {
          const data = (await preferencesResponse.json()) as {
            models?: {
              provider?: string
              modelId?: string
              enabled?: boolean
            }[]
          }

          const next = (data.models ?? []).flatMap((preference) => {
            if (
              typeof preference.provider !== "string" ||
              !isProviderId(preference.provider) ||
              typeof preference.modelId !== "string" ||
              typeof preference.enabled !== "boolean"
            ) {
              return []
            }

            return [
              {
                provider: preference.provider,
                modelId: preference.modelId,
                enabled: preference.enabled,
              },
            ]
          })

          setPreferences(next)
        }
      } catch {
        return
      }
    }

    void refreshSelection()

    return () => {
      cancelled = true
    }
  }, [open])

  const quickModels = useMemo(
    () => getQuickModels(providers, preferences),
    [providers, preferences],
  )

  const selectedModel = useMemo(
    () => aiModels.find((model) => getModelKey(model) === value),
    [value],
  )

  useEffect(() => {
    if (quickModels.length === 0) {
      return
    }

    const hasMatchingModel = quickModels.some(
      (model) => getModelKey(model) === value,
    )

    if (!hasMatchingModel && typeof value === "string" && value.includes(":")) {
      onChange(getModelKey(quickModels[0]))
    }
  }, [quickModels, value, onChange])

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        aria-label="Selecionar modelo"
        title="Selecionar modelo"
        className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-transparent px-2.5 text-xs font-medium text-foreground outline-none transition-colors hover:bg-accent focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Bot aria-hidden className="size-4 text-muted-foreground" />
        <span className="max-w-36 truncate">
          {selectedModel?.name ?? "Modelo"}
        </span>
        <ChevronDown
          aria-hidden
          className="size-3.5 text-muted-foreground"
        />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" side="top" sideOffset={8} className="w-72">
        <DropdownMenuHeading>Usar modelo</DropdownMenuHeading>

        {quickModels.length === 0 ? (
          <p className="px-2 py-1.5 text-xs text-muted-foreground">
            Nenhum modelo rápido ativo. Use “Selecionar modelos” abaixo.
          </p>
        ) : (
          <DropdownMenuRadioGroup
            value={value}
            onValueChange={(next) => onChange(String(next))}
          >
            {aiProviders.map((provider) => {
              const models = quickModels.filter(
                (model) => model.provider === provider.id,
              )

              if (models.length === 0) {
                return null
              }

              return (
                <DropdownMenuGroup key={provider.id}>
                  <DropdownMenuLabel>{provider.name}</DropdownMenuLabel>
                  {models.map((model) => (
                    <DropdownMenuRadioItem
                      key={getModelKey(model)}
                      value={getModelKey(model)}
                      closeOnClick
                    >
                      <span className="truncate">{model.name}</span>
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuGroup>
              )
            })}
          </DropdownMenuRadioGroup>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          render={<Link href="/providers/select-model" />}
          closeOnClick
        >
          <SlidersHorizontal />
          Selecionar modelos
        </DropdownMenuItem>

        {providers.length === 0 && (
          <p className="px-2 py-1.5 text-xs text-muted-foreground">
            Configure uma chave em BYOK para usar seus provedores.
          </p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
