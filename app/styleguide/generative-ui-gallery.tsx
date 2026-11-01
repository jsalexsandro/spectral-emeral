import {
  RenderUiPart,
  renderAiUiComponent,
  type RenderUiPartData,
} from "@/components/ai-ui"
import {
  UI_CATALOG_VERSION,
  type RenderUiInput,
} from "@/lib/ai/ui/catalog"

const successFixtures: { label: string; input: RenderUiInput }[] = [
  {
    label: "callout",
    input: {
      component: "callout",
      props: {
        tone: "success",
        title: "Análise concluída",
        body: "Os dados foram comparados e nenhuma inconsistência crítica foi encontrada.",
      },
    },
  },
  {
    label: "infoCard",
    input: {
      component: "infoCard",
      props: {
        title: "Plano Pro",
        subtitle: "Cobrança mensal",
        description:
          "Inclui uso compartilhado, histórico ilimitado e suporte prioritário.",
        items: [
          { label: "Assentos", value: "12" },
          { label: "Renovação", value: "23 de novembro" },
          { label: "Status", value: "Ativo" },
        ],
      },
    },
  },
  {
    label: "statGrid",
    input: {
      component: "statGrid",
      props: {
        title: "Resumo do período",
        stats: [
          { label: "Receita", value: "R$ 128.430", hint: "+12,4%" },
          { label: "Clientes", value: "1.284", hint: "+86 novos" },
          { label: "Churn", value: "1,8%", hint: "-0,3 p.p." },
        ],
      },
    },
  },
  {
    label: "dataTable",
    input: {
      component: "dataTable",
      props: {
        title: "Comparativo de planos",
        columns: ["Plano", "Preço", "Limite"],
        rows: [
          ["Starter", "R$ 29", "5 usuários"],
          ["Pro", "R$ 89", "25 usuários"],
          ["Business", "Sob consulta", "Ilimitado"],
        ],
        caption: "Valores ilustrativos para validação visual.",
      },
    },
  },
  {
    label: "timeline",
    input: {
      component: "timeline",
      props: {
        title: "Andamento da migração",
        items: [
          { title: "Inventário", status: "done" },
          {
            title: "Migração dos dados",
            description: "Em execução com 68% concluído.",
            status: "current",
          },
          { title: "Validação final", status: "pending" },
        ],
      },
    },
  },
  {
    label: "sourceList",
    input: {
      component: "sourceList",
      props: {
        title: "Fontes consultadas",
        sources: [
          {
            title: "Documentação oficial",
            url: "https://example.com/docs",
            snippet: "Referência utilizada para confirmar os limites do plano.",
          },
          {
            title: "Central de ajuda",
            url: "https://example.com/help",
          },
        ],
      },
    },
  },
  {
    label: "panel",
    input: {
      component: "panel",
      props: {
        title: "Ação rápida recomendada",
        children: [
          {
            type: "text",
            value: "Deseja aplicar esta otimização agora?",
            variant: "p",
          },
          {
            type: "div",
            className: "flex flex-row gap-2",
            children: [
              {
                type: "button",
                label: "Confirmar",
                variant: "default",
                action: { type: "sendMessage", text: "Confirmar" },
              },
              {
                type: "button",
                label: "Cancelar",
                variant: "outline",
                action: {
                  type: "toast",
                  title: "Ação cancelada",
                  variant: "info",
                },
              },
            ],
          },
        ],
      },
    },
  },
]

const stateFixtures: { label: string; part: RenderUiPartData }[] = [
  {
    label: "loading",
    part: { state: "input-streaming" },
  },
  {
    label: "waiting",
    part: {
      state: "input-available",
      input: {
        component: "statGrid",
        props: {
          stats: [
            { label: "Receita", value: "R$ 128.430" },
            { label: "Clientes", value: "1.284" },
          ],
        },
      },
    },
  },
  {
    label: "error",
    part: {
      state: "output-error",
      errorText: "Os dados recebidos não correspondem a um componente válido.",
    },
  },
  {
    label: "success",
    part: {
      state: "output-available",
      output: {
        uiVersion: UI_CATALOG_VERSION,
        component: "callout",
        props: {
          tone: "info",
          title: "Tudo certo",
          body: "O componente foi validado e renderizado com sucesso.",
        },
      },
    },
  },
]

export function GenerativeUiGallery() {
  return (
    <div className="space-y-10">
      <div className="space-y-4">
        <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
          Componentes permitidos
        </p>
        <div className="grid gap-4 lg:grid-cols-2">
          {successFixtures.map(({ label, input }) => (
            <div key={label} className="space-y-2">
              <p className="font-mono text-xs text-muted-foreground">{label}</p>
              {renderAiUiComponent(input)}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
          Estados do renderer
        </p>
        <div className="grid gap-4 lg:grid-cols-2">
          {stateFixtures.map(({ label, part }) => (
            <div key={label} className="space-y-2">
              <p className="font-mono text-xs text-muted-foreground">{label}</p>
              <RenderUiPart part={part} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
