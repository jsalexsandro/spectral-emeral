"use client"

import { useState } from "react"
import Link from "next/link"
import {
  ArrowRight,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  Trash2,
} from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { ByokProvider } from "@/lib/ai/providers"

type ProviderConfigComponentProps = {
  provider: ByokProvider | null
  onOpenChange: (open: boolean) => void
  onSaved: (provider: ByokProvider) => void
}

export function ProviderConfigComponent({
  provider,
  onOpenChange,
  onSaved,
}: ProviderConfigComponentProps) {
  const [apiKey, setApiKey] = useState("")
  const [showKey, setShowKey] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [removeOpen, setRemoveOpen] = useState(false)

  const providerId = provider?.id ?? null
  const [lastProviderId, setLastProviderId] = useState(providerId)

  // Padrão recomendado pelo React para resetar o formulário quando o alvo
  // muda: ajustar o estado durante a renderização, sem efeito.
  if (providerId !== lastProviderId) {
    setLastProviderId(providerId)
    setApiKey("")
    setShowKey(false)
    setIsSaving(false)
    setIsRemoving(false)
    setError(null)
    setRemoveOpen(false)
  }

  if (!provider) {
    return null
  }

  const currentProvider = provider
  const canSave = apiKey.trim().length >= 8 && !isSaving && !isRemoving
  const inputId = `api-key-${provider.id}`

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!canSave) {
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const response = await fetch(`/api/byok/${currentProvider.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      })

      if (!response.ok) {
        throw new Error("Falha ao salvar")
      }

      const data = (await response.json()) as { maskedKey?: string | null }

      onSaved({
        ...currentProvider,
        configured: true,
        maskedKey: data.maskedKey ?? null,
        updatedAt: new Date().toISOString(),
      })
    } catch {
      setError("Não foi possível salvar a chave. Tente novamente.")
    } finally {
      setIsSaving(false)
    }
  }

  async function handleRemove() {
    setIsRemoving(true)
    setError(null)

    try {
      const response = await fetch(`/api/byok/${currentProvider.id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Falha ao remover")
      }

      setRemoveOpen(false)
      onSaved({
        ...currentProvider,
        configured: false,
        maskedKey: null,
        updatedAt: null,
      })
    } catch {
      setError("Não foi possível remover a chave. Tente novamente.")
    } finally {
      setIsRemoving(false)
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{provider.name}</DialogTitle>
          <DialogDescription>{provider.description}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <a
            href={provider.docsUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex w-fit items-center gap-1 text-xs font-medium text-primary underline-offset-4 hover:underline"
          >
            Obter chave no provedor
            <ExternalLink className="size-3" />
          </a>
          <Link
            href={`/provider/${provider.id}/models`}
            className="inline-flex w-fit items-center gap-1 text-xs font-medium text-primary underline-offset-4 hover:underline"
          >
            Ver modelos disponíveis
            <ArrowRight className="size-3" />
          </Link>
        </div>

        {provider.configured && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 p-3">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Chave atual</p>
              <p className="truncate font-mono text-sm">
                {provider.maskedKey ?? "••••"}
              </p>
            </div>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => setRemoveOpen(true)}
              disabled={isRemoving}
            >
              {isRemoving ? <Loader2 className="animate-spin" /> : <Trash2 />}
              Remover
            </Button>
          </div>
        )}

        <form className="space-y-3" onSubmit={handleSave}>
          <div className="space-y-2">
            <Label htmlFor={inputId}>
              {provider.configured ? "Nova chave" : "Chave de API"}
            </Label>
            <div className="relative">
              <Input
                id={inputId}
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder={provider.placeholder}
                autoComplete="off"
                spellCheck={false}
                maxLength={512}
                className="h-10 pr-10 font-mono text-xs"
              />
              <button
                type="button"
                onClick={() => setShowKey((value) => !value)}
                aria-label={showKey ? "Ocultar chave" : "Mostrar chave"}
                className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-ring"
              >
                {showKey ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              A chave é armazenada criptografada e não é exibida novamente.
            </p>
          </div>

          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" size="lg" disabled={!canSave}>
              {isSaving ? (
                <>
                  <Loader2 className="animate-spin" />
                  Salvando
                </>
              ) : provider.configured ? (
                "Substituir chave"
              ) : (
                "Salvar chave"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>

      <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover chave da {provider.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              O Spectral deixará de usar esta chave para o provedor.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                void handleRemove()
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}
