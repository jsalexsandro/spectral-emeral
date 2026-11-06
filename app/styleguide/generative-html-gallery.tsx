"use client"

import { toast } from "@/components/ui/sonner"
import {
  ActionRunnerProvider,
  RenderHtmlPart,
  type RenderHtmlPartData,
} from "@/components/ai-ui"
import type { ActionRunner } from "@/lib/ai/actions/catalog"
import { HTML_UI_VERSION } from "@/lib/ai/ui/html-policy"

const runAction: ActionRunner = async (action) => {
  if (action.type === "toast") {
    toast(action.title, { description: action.description })
  } else if (action.type === "sendMessage") {
    toast("Mensagem sugerida", { description: action.text })
  } else {
    toast(`Ação: ${action.type}`)
  }

  return { ok: true }
}

const dashboardHtml = `
<div class="rounded-xl border border-border bg-card p-4 shadow-soft">
  <div class="flex items-center justify-between gap-3">
    <div>
      <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Receita</p>
      <p class="mt-1 font-mono text-2xl font-semibold tabular-nums">R$ 128.430</p>
    </div>
    <span class="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">+12,4%</span>
  </div>
  <div class="mt-4 grid grid-cols-2 gap-3">
    <div class="rounded-lg bg-muted p-3">
      <p class="text-xs text-muted-foreground">Processado</p>
      <p class="mt-1 font-mono text-lg font-semibold tabular-nums">1.284</p>
    </div>
    <div class="rounded-lg bg-muted p-3">
      <p class="text-xs text-muted-foreground">Pendente</p>
      <p class="mt-1 font-mono text-lg font-semibold tabular-nums">36</p>
    </div>
  </div>
  <div class="mt-4 flex flex-wrap gap-2">
    <button type="button" class="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90" data-spectral-action='{"type":"navigate","path":"/app"}'>Abrir app</button>
    <button type="button" class="rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted" data-spectral-action='{"type":"sendMessage","text":"Detalhe os pagamentos pendentes"}'>Ver pendências</button>
  </div>
</div>
`

const tableHtml = `
<div class="overflow-x-auto rounded-xl border border-border">
  <table class="w-full border-collapse text-sm">
    <thead class="bg-muted">
      <tr>
        <th class="border-b border-border px-3 py-2 text-left font-medium text-muted-foreground">Modelo</th>
        <th class="border-b border-border px-3 py-2 text-left font-medium text-muted-foreground">Provedor</th>
        <th class="border-b border-border px-3 py-2 text-right font-medium text-muted-foreground">Entrada</th>
        <th class="border-b border-border px-3 py-2 text-right font-medium text-muted-foreground">Saída</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="border-b border-border px-3 py-2">GPT-OSS 20B</td>
        <td class="border-b border-border px-3 py-2">Groq</td>
        <td class="border-b border-border px-3 py-2 text-right font-mono tabular-nums">0,075</td>
        <td class="border-b border-border px-3 py-2 text-right font-mono tabular-nums">0,300</td>
      </tr>
      <tr>
        <td class="px-3 py-2">Claude Sonnet</td>
        <td class="px-3 py-2">Anthropic</td>
        <td class="px-3 py-2 text-right font-mono tabular-nums">3,000</td>
        <td class="px-3 py-2 text-right font-mono tabular-nums">15,000</td>
      </tr>
    </tbody>
  </table>
</div>
`

const calloutHtml = `
<div class="rounded-xl border border-primary/20 bg-primary/5 p-4">
  <p class="text-sm font-semibold text-primary">Tudo certo</p>
  <p class="mt-1 text-sm text-muted-foreground">A chave da OpenAI foi validada e o modelo já aparece na seleção rápida.</p>
</div>
`

const unsafeHtml = `
<div class="rounded-xl border border-destructive/30 bg-destructive/5 p-4 fixed z-50" onclick="alert('xss')">
  <p class="text-sm font-semibold text-destructive">Exemplo de sanitização</p>
  <p class="mt-1 text-sm text-muted-foreground">Scripts, estilos inline, classes de overlay e handlers são removidos.</p>
  <script>alert("xss")</script>
  <a href="javascript:alert('xss')">Link perigoso</a>
</div>
`

const counterHtml = `
<div class="rounded-xl border border-border bg-card p-4">
  <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Contador</p>
  <p class="mt-1 font-mono text-2xl font-semibold tabular-nums" data-counter>0</p>
  <div class="mt-3 flex flex-wrap gap-2">
    <button type="button" class="rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted" data-step="-1">−1</button>
    <button type="button" class="rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted" data-step="1">+1</button>
    <button type="button" class="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90" data-spectral-action='{"type":"toast","title":"Contador preservado"}'>Avisar</button>
  </div>
</div>
`

const counterScript = `
var output = document.querySelector("[data-counter]");
var value = 0;

document.addEventListener("click", function (event) {
  var button = event.target.closest("[data-step]");

  if (!button) return;

  value += Number(button.getAttribute("data-step"));
  output.textContent = String(value);
});
`

const themeHtml = `
<div class="rounded-xl border border-border bg-card p-4">
  <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Tema atual</p>
  <p class="mt-1 text-sm font-medium text-foreground" data-theme>claro</p>
</div>
`

const themeScript = `
var label = document.querySelector("[data-theme]");

spectral.onThemeChange(function (theme) {
  label.textContent = theme === "dark" ? "escuro" : "claro";
});
`

const sandboxHtml = `
<div class="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
  <p class="text-sm font-semibold text-destructive">Sondas de sandbox</p>
  <ul class="mt-2 list-disc list-inside text-xs text-muted-foreground" data-results></ul>
</div>
`

const sandboxScript = `
var results = document.querySelector("[data-results]");

function probe(label, fn) {
  var item = document.createElement("li");

  try {
    fn();
    item.textContent = label + ": permitido";
  } catch (error) {
    item.textContent = label + ": bloqueado";
  }

  results.appendChild(item);
}

probe("window.parent.document", function () {
  var parent = window.parent;

  if (parent === window) throw new Error("sem pai");
  return parent.document.body;
});

probe("localStorage", function () {
  return window.localStorage.getItem("spectral");
});

probe("document.cookie", function () {
  var value = document.cookie;

  if (!value) throw new Error("sem cookie");
  return value;
});
`

const fixtures = [
  {
    title: "Dashboard",
    description: "Layout com métricas, cores semânticas e botões com ações tipadas.",
    html: dashboardHtml,
  },
  {
    title: "Tabela",
    description: "Tabela responsiva com classes Tailwind permitidas.",
    html: tableHtml,
  },
  {
    title: "Destaque",
    description: "Callout curto usando tokens do tema.",
    html: calloutHtml,
  },
  {
    title: "Contador interativo",
    description:
      "Widget v2: o script altera o estado local e dispara uma ação tipada pelo runtime.",
    html: counterHtml,
    script: counterScript,
  },
  {
    title: "Tema do app",
    description:
      "O runtime expõe o tema atual ao widget e reage à troca em tempo real.",
    html: themeHtml,
    script: themeScript,
  },
  {
    title: "Sandbox",
    description:
      "Sondas tentam acessar o app e o storage. O iframe com origem opaca bloqueia as três.",
    html: sandboxHtml,
    script: sandboxScript,
  },
  {
    title: "Sanitização",
    description:
      "HTML bruto com script, onclick, javascript: e classe fixed. O renderer remove tudo que não é permitido.",
    html: unsafeHtml,
  },
] as const

function successPart(html: string, script?: string): RenderHtmlPartData {
  return {
    state: "output-available",
    output: {
      uiVersion: HTML_UI_VERSION,
      html,
      ...(script ? { script } : {}),
    },
  }
}

const stateFixtures: { label: string; part: RenderHtmlPartData }[] = [
  { label: "Carregando", part: { state: "input-streaming" } },
  {
    label: "Erro",
    part: {
      state: "output-error",
      errorText: "A tool retornou um erro de validação.",
    },
  },
  {
    label: "Versão futura",
    part: {
      state: "output-available",
      output: { uiVersion: HTML_UI_VERSION + 1, html: calloutHtml },
    },
  },
]

export function GenerativeHtmlGallery() {
  return (
    <ActionRunnerProvider run={runAction}>
      <div className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-2">
          {fixtures.map((fixture) => (
            <div key={fixture.title} className="space-y-3">
              <div>
                <p className="text-sm font-medium">{fixture.title}</p>
                <p className="text-xs text-muted-foreground">
                  {fixture.description}
                </p>
              </div>
              <RenderHtmlPart
                part={successPart(
                  fixture.html,
                  "script" in fixture ? fixture.script : undefined,
                )}
              />
              <details className="rounded-lg border bg-muted/30 p-3">
                <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                  Ver código
                </summary>
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all font-mono text-[11px] text-muted-foreground">
                  {fixture.html.trim()}
                  {"script" in fixture && fixture.script
                    ? `\n\n// script\n${fixture.script.trim()}`
                    : ""}
                </pre>
              </details>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium">Estados do renderer</p>
          <div className="grid gap-3 md:grid-cols-3">
            {stateFixtures.map(({ label, part }) => (
              <div key={label} className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase">
                  {label}
                </p>
                <RenderHtmlPart part={part} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </ActionRunnerProvider>
  )
}
