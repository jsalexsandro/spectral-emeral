import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  CircleHelp,
  MoreHorizontal,
  Plus,
  Search,
  Sparkles,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuHeading,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { GenerativeHtmlGallery } from "./generative-html-gallery";

export const metadata: Metadata = {
  title: "Design system",
  description: "Tokens, tipografia e componentes base do Spectral AI.",
};

const colors = [
  { name: "background", className: "bg-background" },
  { name: "card", className: "bg-card" },
  { name: "muted", className: "bg-muted" },
  { name: "secondary", className: "bg-secondary" },
  { name: "accent", className: "bg-accent" },
  { name: "primary", className: "bg-primary" },
  { name: "foreground", className: "bg-foreground" },
  { name: "muted-foreground", className: "bg-muted-foreground" },
  { name: "border", className: "bg-border" },
  { name: "ring", className: "bg-ring" },
  { name: "destructive", className: "bg-destructive" },
];

const emeraldScale = [
  { name: "50", className: "bg-emerald-50" },
  { name: "100", className: "bg-emerald-100" },
  { name: "300", className: "bg-emerald-300" },
  { name: "500", className: "bg-emerald-500" },
  { name: "600", className: "bg-emerald-600" },
  { name: "700", className: "bg-emerald-700" },
  { name: "900", className: "bg-emerald-900" },
];

const radii = [
  { name: "sm", className: "rounded-sm" },
  { name: "md", className: "rounded-md" },
  { name: "lg", className: "rounded-lg" },
  { name: "xl", className: "rounded-xl" },
  { name: "2xl", className: "rounded-2xl" },
];

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 space-y-6">
      <div className="space-y-1">
        <h2 className="font-heading text-2xl font-semibold tracking-tight">
          {title}
        </h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

export default function StyleguidePage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-14 px-6 py-12">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" data-icon="inline-start" />
            Voltar
          </Link>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            Design system
          </h1>
          <p className="max-w-2xl text-muted-foreground">
            Os fundamentos visuais do Spectral AI: cores, tipografia, raios e
            componentes prontos para o dashboard.
          </p>
        </div>
        <Badge
          variant="outline"
          className="w-fit gap-1.5 border-primary/20 bg-primary/5 text-primary"
        >
          <Sparkles className="size-3" />
          Spectral Emerald
        </Badge>
      </header>

      <Separator />

      <Section
        id="cores"
        title="Cores"
        description="Branco e off-whites esverdeados com esmeralda como cor de ação."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {colors.map(({ name, className }) => (
            <div key={name} className="space-y-2">
              <div
                className={cn(
                  "h-16 rounded-lg ring-1 ring-border",
                  className,
                )}
              />
              <p className="font-mono text-xs text-muted-foreground">
                {name}
              </p>
            </div>
          ))}
        </div>

        <div className="rounded-xl border bg-card p-5 shadow-soft">
          <p className="mb-3 text-xs font-medium tracking-wider text-muted-foreground uppercase">
            Escala esmeralda
          </p>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
            {emeraldScale.map(({ name, className }) => (
              <div key={name} className="space-y-2">
                <div
                  className={cn(
                    "h-12 rounded-md ring-1 ring-black/5",
                    className,
                  )}
                />
                <p className="font-mono text-xs text-muted-foreground">
                  {name}
                </p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Separator />

      <Section
        id="tipografia"
        title="Tipografia"
        description="Geist Sans para interface, Geist Mono para números e código."
      >
        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <div className="space-y-4 rounded-xl border bg-card p-6 shadow-soft">
            <h3 className="font-heading text-4xl font-semibold tracking-tight">
              Display 36
            </h3>
            <h3 className="font-heading text-3xl font-semibold tracking-tight">
              Título 30
            </h3>
            <h3 className="font-heading text-2xl font-semibold tracking-tight">
              Seção 24
            </h3>
            <h3 className="font-heading text-lg font-medium">Subtítulo 18</h3>
            <p className="text-base leading-relaxed">
              Corpo de texto em 16px para leitura confortável. Use no conteúdo
              principal e nas descrições longas.
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Texto de apoio em 14px. Ideal para metadados, legendas e estados
              secundários.
            </p>
            <p className="text-xs text-muted-foreground">
              Legenda em 12px para informações auxiliares.
            </p>
          </div>

          <div className="flex flex-col justify-between gap-6 rounded-xl border bg-muted/40 p-6">
            <div>
              <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                Números e código
              </p>
              <p className="mt-3 font-mono text-3xl font-semibold tabular-nums">
                R$ 128.430
              </p>
              <p className="mt-1 font-mono text-sm text-muted-foreground">
                +12,4% no período
              </p>
            </div>
            <div className="rounded-lg border bg-background p-3">
              <p className="font-mono text-xs text-muted-foreground">
                spectral.config.ts
              </p>
              <p className="mt-2 font-mono text-sm">
                <span className="text-primary">const</span> theme ={" "}
                <span className="text-emerald-700">&quot;emerald&quot;</span>;
              </p>
            </div>
          </div>
        </div>
      </Section>

      <Separator />

      <Section
        id="componentes"
        title="Componentes"
        description="Primitivos do shadcn/ui já alinhados aos tokens do projeto."
      >
        <div className="space-y-10">
          <div className="space-y-4">
            <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
              Botões
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button>
                <Plus data-icon="inline-start" />
                Novo projeto
              </Button>
              <Button variant="secondary">Secundário</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive">Excluir</Button>
              <Button variant="link">
                Ver detalhes
                <ArrowRight data-icon="inline-end" />
              </Button>
              <Button disabled>Desabilitado</Button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="xs">Extra small</Button>
              <Button size="sm">Small</Button>
              <Button size="lg">Large</Button>
              <Button size="icon" aria-label="Adicionar">
                <Plus />
              </Button>
              <Button variant="outline" size="icon" aria-label="Mais ações">
                <MoreHorizontal />
              </Button>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                Formulário
              </p>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="voce@empresa.com"
                />
                <p className="text-xs text-muted-foreground">
                  Enviaremos o acesso ao painel para este endereço.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="search">Buscar</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="search"
                    className="pl-8"
                    placeholder="Buscar projetos..."
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="invalid">Campo inválido</Label>
                <Input
                  id="invalid"
                  aria-invalid
                  placeholder="valor@invalido"
                />
                <p className="text-xs text-destructive">
                  Informe um e-mail válido.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                Badges e avatares
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Badge>Ativo</Badge>
                <Badge variant="secondary">Beta</Badge>
                <Badge variant="outline">Rascunho</Badge>
                <Badge variant="destructive">Erro</Badge>
                <Badge variant="ghost">Ghost</Badge>
                <Badge variant="link">Saiba mais</Badge>
              </div>
              <div className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-soft">
                <Avatar size="lg">
                  <AvatarFallback>SA</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    Spectral Assistant
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    assistente@spectral.ai
                  </p>
                </div>
                <Badge variant="outline" className="gap-1">
                  <Check className="size-3" />
                  Online
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Avatar>
                  <AvatarFallback>AN</AvatarFallback>
                </Avatar>
                <Avatar>
                  <AvatarFallback>MA</AvatarFallback>
                </Avatar>
                <Avatar>
                  <AvatarFallback>JS</AvatarFallback>
                </Avatar>
                <span className="text-xs text-muted-foreground">
                  Equipe ativa
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
              Cards
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Receita processada</CardTitle>
                  <CardDescription>Últimos 30 dias</CardDescription>
                  <CardAction>
                    <Badge variant="secondary">+12,4%</Badge>
                  </CardAction>
                </CardHeader>
                <CardContent>
                  <p className="font-heading text-3xl font-semibold tabular-nums">
                    R$ 128.430
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Comparado a R$ 114.290 no período anterior.
                  </p>
                </CardContent>
                <CardFooter className="justify-between">
                  <span className="text-xs text-muted-foreground">
                    Atualizado agora
                  </span>
                  <Button variant="ghost" size="sm">
                    Ver relatório
                    <ArrowRight data-icon="inline-end" />
                  </Button>
                </CardFooter>
              </Card>

              <Card size="sm">
                <CardHeader>
                  <CardTitle>Processando dados</CardTitle>
                  <CardDescription>
                    O assistente está analisando os últimos eventos.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Skeleton className="size-9 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3 w-32" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                  </div>
                  <Skeleton className="h-20 w-full rounded-lg" />
                </CardContent>
                <CardFooter>
                  <span className="text-xs text-muted-foreground">
                    Isso leva só alguns segundos.
                  </span>
                </CardFooter>
              </Card>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                Menu e tooltip
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className={buttonVariants({ variant: "outline" })}
                  >
                    Ações
                    <ChevronDown data-icon="inline-end" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuHeading>Projeto</DropdownMenuHeading>
                    <DropdownMenuItem>
                      Editar
                      <DropdownMenuShortcut>⌘E</DropdownMenuShortcut>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      Duplicar
                      <DropdownMenuShortcut>⌘D</DropdownMenuShortcut>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive">
                      Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Tooltip>
                  <TooltipTrigger
                    aria-label="Ajuda"
                    className={buttonVariants({
                      variant: "outline",
                      size: "icon",
                    })}
                  >
                    <CircleHelp />
                  </TooltipTrigger>
                  <TooltipContent>Central de ajuda do Spectral AI</TooltipContent>
                </Tooltip>
              </div>
              <div className="rounded-xl border bg-card p-4 shadow-soft">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Eventos</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    24
                  </span>
                </div>
                <Separator className="my-3" />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Última sincronização</span>
                  <span className="font-mono">12:42</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                Raios e elevação
              </p>
              <div className="grid grid-cols-5 gap-2">
                {radii.map(({ name, className }) => (
                  <div key={name} className="space-y-2">
                    <div
                      className={cn(
                        "h-14 border border-primary/20 bg-primary/10",
                        className,
                      )}
                    />
                    <p className="text-center font-mono text-xs text-muted-foreground">
                      {name}
                    </p>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border bg-card p-4 shadow-soft">
                <p className="text-sm font-medium">shadow-soft</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Elevação discreta para cards e superfícies em destaque.
                </p>
              </div>
            </div>
          </div>
        </div>
      </Section>

      <Separator />

      <Section
        id="generative-html"
        title="Generative HTML"
        description="HTML sanitizado que a IA pode renderizar no chat, com Tailwind e ações tipadas."
      >
        <Suspense
          fallback={
            <div className="rounded-xl border border-border/70 bg-muted/40 p-4 text-sm text-muted-foreground">
              Carregando exemplos de HTML...
            </div>
          }
        >
          <GenerativeHtmlGallery />
        </Suspense>
      </Section>

      <Separator />

      <Section
        id="dark"
        title="Tema escuro"
        description="Os tokens escuros já estão preparados. O toggle entra em um próximo passo."
      >
        <div className="dark rounded-2xl border bg-background p-6 text-foreground shadow-soft">
          <div className="flex flex-wrap items-center gap-3">
            <Button>Botão primário</Button>
            <Button variant="outline">Outline</Button>
            <Badge variant="secondary">Prévia</Badge>
            <Badge variant="outline">Tema escuro</Badge>
          </div>
          <div className="mt-5 max-w-md">
            <Card>
              <CardHeader>
                <CardTitle>Card no tema escuro</CardTitle>
                <CardDescription>
                  Superfícies, bordas e texto com contraste preservado.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="font-mono text-2xl font-semibold tabular-nums">
                  R$ 128.430
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </Section>
    </main>
  );
}
