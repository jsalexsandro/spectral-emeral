export const SYSTEM_PROMPT_VERSION = 27

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
  {
    version: 16,
    date: "2026-11-05",
    summary:
      "Substitui o catálogo de componentes de renderUi por HTML sanitizado via renderHtml, com Tailwind safelist e ações tipadas em botões.",
  },
  {
    version: 17,
    date: "2026-11-06",
    summary:
      "Adiciona widgets dinâmicos ao renderHtml: script opcional em iframe sandbox, API spectral (action, theme, onThemeChange) e tags interativas com regra de ação apenas por gesto do usuário.",
  },
  {
    version: 18,
    date: "2026-11-06",
    summary:
      "Adiciona a ação openDeviceApp para abrir apps da allowlist em PCs pareados a partir de widgets, com device-list-apps antes da geração e pergunta ao usuário quando há mais de um dispositivo online.",
  },
  {
    version: 19,
    date: "2026-11-06",
    summary:
      "Adiciona a tool get-theme para consultar o tema atual (light, dark ou system) antes de usar setTheme, evitando trocar para um tema já ativo. O tema chega do cliente no corpo de /api/chat e também é injetado no system prompt.",
  },
  {
    version: 20,
    date: "2026-11-06",
    summary:
      "Melhora o planejamento multi-passo com o status failed para etapas, validação de no máximo uma etapa current no updatePlan e stop condition para falhas repetidas do plano.",
  },
  {
    version: 22,
    date: "2026-11-08",
    summary:
      "Adiciona a tool device-window-action para minimizar, maximizar, restaurar e fechar janelas de dispositivos pareados, com fechamento gracioso e uso obrigatório do windowId retornado por device-list-windows.",
  },
  {
    version: 23,
    date: "2026-11-09",
    summary:
      "Adiciona a tool device-screenshot para capturar a tela inteira, um monitor ou uma região e anexar a imagem ao modelo, com limites de tamanho, privacidade e tradução dos erros de permissão e ambiente.",
  },
  {
    version: 24,
    date: "2026-11-09",
    summary:
      "Adiciona as tools device-read-clipboard e device-write-clipboard para ler e substituir o texto da área de transferência dos dispositivos, com limite de tamanho, aviso de privacidade e tradução dos erros de dependência e ambiente.",
  },
  {
    version: 25,
    date: "2026-11-09",
    summary:
      "Adiciona as tools de mouse device-move-mouse, device-click, device-scroll e device-drag para controlar o cursor dos dispositivos, com confirmação antes de ações destrutivas e tradução dos erros de permissão e ambiente.",
  },
  {
    version: 26,
    date: "2026-11-09",
    summary:
      "Corrige a conversão de coordenadas do mouse: as tools aceitam screenshotId e recebem x/y em pixels da imagem, o servidor converte para pixels nativos com a região da captura, e o prompt passa a preferir regiões estreitas e atalhos de teclado para alvos pequenos.",
  },
  {
    version: 27,
    date: "2026-11-09",
    summary:
      "Troca as coordenadas de mouse para normalizadas 0–1000 quando há screenshotId, adiciona captura por windowId com foco atômico, recorte coarse-to-fine com region normalizado, detecção de captura uniforme (screen_unstable), DPI awareness v2 nas janelas e verificação visual obrigatória após ações.",
  },
]
