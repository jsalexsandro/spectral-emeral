export const SYSTEM_PROMPT_VERSION = 15

export type SystemPromptChange = {
  version: number
  date: string
  summary: string
}

export const systemPromptChangelog: readonly SystemPromptChange[] = [
  {
    version: 1,
    date: "2026-10-30",
    summary:
      "Prompt base inicial com identidade, estilo, capacidades, segurança e contexto do usuário.",
  },
  {
    version: 2,
    date: "2026-10-30",
    summary:
      "Anuncia a tool nativa fetchUrl e orienta uso responsável, citação da fonte e limites de rede.",
  },
  {
    version: 3,
    date: "2026-10-30",
    summary:
      "Anuncia a tool renderUi, o catálogo de componentes generativos e as regras de uso, citação e não duplicação de dados.",
  },
  {
    version: 4,
    date: "2026-10-30",
    summary:
      "Adiciona execução em etapas com a tool updatePlan, planejamento antes de tarefas multi-passo e replanejamento após falhas.",
  },
  {
    version: 5,
    date: "2026-10-30",
    summary:
      "Diferencia componentes específicos de componentes primitivos e orienta sua combinação para layouts customizados.",
  },
  {
    version: 6,
    date: "2026-11-01",
    summary:
      "Remove a tool chatState e o nó stateText, simplificando os primitivos para apenas text, button e div.",
  },
  {
    version: 7,
    date: "2026-11-01",
    summary:
      "Separa UI de ações: renderUi para conteúdo, runAction para efeitos, panel no lugar de chatUi e ações tipadas em botões.",
  },
  {
    version: 8,
    date: "2026-11-03",
    summary:
      "Adiciona a seção de dispositivos e anuncia as tools device-list e device-online-list, restritas à consulta.",
  },
  {
    version: 9,
    date: "2026-11-03",
    summary:
      "Anuncia o canal de comando e as tools de controle de dispositivos (abrir URL/app, listar apps, digitar e pressionar teclas), com regras de confirmação e allowlist.",
  },
  {
    version: 10,
    date: "2026-11-03",
    summary:
      "Adiciona a tool device-get-os para consultar plataforma, release, versão e arquitetura do dispositivo.",
  },
  {
    version: 11,
    date: "2026-11-03",
    summary:
      "Adiciona tools de leitura de arquivos nos dispositivos (device-list-files, device-read-file, device-glob e device-grep), restritas à pasta de usuário com sandbox e denylist.",
  },
  {
    version: 12,
    date: "2026-11-03",
    summary:
      "Adiciona tools de gravação e edição de arquivos (device-write-file e device-edit-file) com sandbox e denylist.",
  },
  {
    version: 13,
    date: "2026-11-04",
    summary:
      "Adiciona tools de consulta de provedores e modelos (provider-list-all, provider-list-configured, model-list-by-provider e model-list-enabled), sem exposição de chaves.",
  },
  {
    version: 14,
    date: "2026-11-04",
    summary:
      "Reforça o roteamento para tools de catálogo antes de renderUi e limita a repetição de renderUi por resposta.",
  },
  {
    version: 15,
    date: "2026-11-04",
    summary:
      "Adiciona a tool model-set-enabled para ativar/desativar modelos na seleção rápida, com validação de provedor configurado.",
  },
]
