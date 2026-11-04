import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, ArrowRight, ExternalLink } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  formatPricePerMillion,
  formatReleaseDate,
  formatTokenCount,
  getProviderModelCatalog,
  modelStatusLabels,
  type AIModel,
  type ModelStatus,
} from "@/lib/ai/models"
import { aiProviders, isProviderId } from "@/lib/ai/providers"
import { cn } from "@/lib/utils"

type ProviderModelsPageProps = {
  params: Promise<{ provider: string }>
}

const statusVariants: Record<
  ModelStatus,
  "default" | "secondary" | "outline"
> = {
  available: "default",
  preview: "secondary",
  deprecated: "outline",
}

export function generateStaticParams() {
  return aiProviders.map((provider) => ({ provider: provider.id }))
}

export async function generateMetadata({
  params,
}: ProviderModelsPageProps): Promise<Metadata> {
  const { provider } = await params

  if (!isProviderId(provider)) {
    return { title: "Provedor não encontrado" }
  }

  const catalog = getProviderModelCatalog(provider)

  if (!catalog) {
    return { title: "Provedor não encontrado" }
  }

  return {
    title: `Modelos ${catalog.name}`,
    description: `Modelos ${catalog.name} suportados pelo Spectral AI.`,
  }
}

export default async function ProviderModelsPage({
  params,
}: ProviderModelsPageProps) {
  const { provider } = await params

  if (!isProviderId(provider)) {
    notFound()
  }

  const catalog = getProviderModelCatalog(provider)

  if (!catalog) {
    notFound()
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10">
      <header className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Início
          </Link>
          <Link
            href="/app"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Abrir painel
            <ArrowRight className="size-4" />
          </Link>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">Catálogo de modelos</Badge>
              <Badge variant="secondary">
                {catalog.models.length}{" "}
                {catalog.models.length === 1 ? "modelo" : "modelos"}
              </Badge>
            </div>
            <h1 className="font-heading text-3xl font-semibold tracking-tight">
              {catalog.name}
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              {catalog.description}
            </p>
          </div>

          <a
            href={catalog.docsUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Documentação do provedor
            <ExternalLink className="size-3.5" />
          </a>
        </div>
      </header>

      <nav aria-label="Provedores" className="flex flex-wrap gap-2">
        {aiProviders.map((item) => (
          <Link
            key={item.id}
            href={`/provider/${item.id}/models`}
            aria-current={item.id === catalog.id ? "page" : undefined}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring",
              item.id === catalog.id
                ? "border-primary/30 bg-primary/10 font-medium text-primary"
                : "border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            {item.name}
          </Link>
        ))}
      </nav>

      {catalog.models.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
          Nenhum modelo cadastrado para este provedor.
        </p>
      ) : (
        <section className="space-y-3">
          {catalog.models.map((model) => (
            <ModelCard key={model.id} model={model} />
          ))}
        </section>
      )}

      <footer className="border-t border-border pt-4 text-xs text-muted-foreground">
        Preços em dólares por milhão de tokens. Metadados sujeitos a alterações
        pelos provedores.
      </footer>
    </main>
  )
}

function ModelCard({ model }: { model: AIModel }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          {model.name}
          <Badge variant={statusVariants[model.status]}>
            {modelStatusLabels[model.status]}
          </Badge>
        </CardTitle>
        <CardDescription className="font-mono text-xs">
          {model.id}
        </CardDescription>
        <CardAction>
          <span className="text-xs text-muted-foreground">
            {formatReleaseDate(model.releasedAt)}
          </span>
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{model.description}</p>
        <Separator />
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="space-y-0.5">
            <dt className="text-xs text-muted-foreground">Contexto</dt>
            <dd className="font-mono text-sm">
              {formatTokenCount(model.contextWindow)} tokens
            </dd>
          </div>
          <div className="space-y-0.5">
            <dt className="text-xs text-muted-foreground">Saída máxima</dt>
            <dd className="font-mono text-sm">
              {model.maxOutputTokens
                ? `${formatTokenCount(model.maxOutputTokens)} tokens`
                : "—"}
            </dd>
          </div>
          <div className="space-y-0.5">
            <dt className="text-xs text-muted-foreground">Entrada / 1M</dt>
            <dd className="font-mono text-sm">
              {formatPricePerMillion(model.pricing.inputPerMillion)}
            </dd>
          </div>
          <div className="space-y-0.5">
            <dt className="text-xs text-muted-foreground">Saída / 1M</dt>
            <dd className="font-mono text-sm">
              {formatPricePerMillion(model.pricing.outputPerMillion)}
            </dd>
          </div>
        </dl>
        {model.rateLimits && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">
              Limites de referência
            </span>
            <span>
              {formatTokenCount(model.rateLimits.requestsPerMinute)} RPM
            </span>
            <span>{formatTokenCount(model.rateLimits.requestsPerDay)} RPD</span>
            <span>{formatTokenCount(model.rateLimits.tokensPerMinute)} TPM</span>
            <span>{formatTokenCount(model.rateLimits.tokensPerDay)} TPD</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
