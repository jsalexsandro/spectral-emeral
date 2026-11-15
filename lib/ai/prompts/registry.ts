export const SYSTEM_PROMPT_VERSION = 37

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
  {
    version: 28,
    date: "2026-11-10",
    summary:
      "Adiciona o caminho determinístico por UI Automation: device-inspect-ui retorna controles com runtimeId, bounds nativo e ações suportadas, e device-ui-action executa invoke/select/toggle/expand/collapse/focus sem mover o cursor. O prompt passa a preferir UIA para controles nativos e mantém captura + clique como fallback.",
  },
  {
    version: 29,
    date: "2026-11-10",
    summary:
      "Torna o caminho UIA resiliente a apps assíncronos: inspect-ui e ui-action aceitam waitMs e reenumeram a árvore até o alvo aparecer, ui-action ganha setValue (ValuePattern) para campos de texto e devolve hint quando focus é usado num elemento selecionável que exige select.",
  },
  {
    version: 30,
    date: "2026-11-11",
    summary:
      "Substitui o teto de execução por dispositivo e o ciclo de três modos do chat por um modelo simples: Modo Leitura e Modo Construtor alternados com Shift+Tab, e uma preferência por dispositivo entre Pedir confirmação e Poder Total para ações destrutivas ou de sistema.",
  },
  {
    version: 31,
    date: "2026-11-11",
    summary:
      "Adiciona as operações de arquivo que faltavam para operar a máquina como o Claude Code: device-mkdir, device-stat, device-copy, device-move, device-delete (lixeira por padrão) e device-apply-patch atômico com preservação de CRLF/BOM. As raízes do sandbox passam a incluir a pasta padrão do dispositivo.",
  },
  {
    version: 32,
    date: "2026-11-12",
    summary:
      "Descobre aplicativos instalados no Windows (Menu Iniciar e App Paths) e aceita apps personalizados por dispositivo. device-find-app verifica se um app existe e device-open-app abre por id descoberto ou caminho absoluto, substituindo a allowlist fixa.",
  },
  {
    version: 33,
    date: "2026-11-12",
    summary:
      "device-open-app aceita argumentos (args) e diretório de trabalho (cwd) para abrir apps como `zed .` e `zed x`; abertura com args pede aprovação como lançamento (risco launch). Novo device-open-path para abrir arquivo/pasta no app padrão sem aprovação, sem aceitar executáveis. Catálogo de apps passa a viver no driver (~/.spectral/driver/apps.json) com device-register-app e device-remove-app, acessível via device-list-apps (source: custom); cadastro manual em Configurações é retirado. Se a API interna não estiver disponível, o modelo usa o terminal interno (device-shell): Start-Process no Windows, open no macOS e xdg-open no Linux.",
  },
  {
    version: 34,
    date: "2026-11-13",
    summary:
      "Adiciona jobs de execução em segundo plano: device-job-start inicia um script e retorna jobId imediatamente; device-job-status, device-job-output (leitura incremental por cursor), device-job-cancel e device-job-list gerenciam o ciclo de vida. Até 3 jobs simultâneos por dispositivo, maxRuntimeMs padrão de 30 min (máximo 60 min) e cancelamento mata a árvore de processos. Jobs acima de 60s devem ser usados em vez de device-shell; o modelo faz polling com device-job-output sem reler a saída inteira.",
  },
  {
    version: 35,
    date: "2026-11-14",
    summary:
      "O driver opera na maquina inteira: nao ha mais restricao de cwd ou caminho fora do home para shell, arquivos e jobs. Escrita em disco fora do diretorio de referencia do usuario eh classificada como destrutiva e pede aprovacao no Modo Construtor (liberado em Poder Total). Caminhos protegidos (instalacao do Spectral, System32, WinSxS, Boot) nunca podem ser apagados nem usados como cwd. Negacao de credenciais (.ssh, .env, cookies, chaves) continua ativa.",
  },
  {
    version: 36,
    date: "2026-11-14",
    summary:
      "Jobs ganham espera ativa: device-job-status e device-job-output aceitam waitMs (até 10 s) para o modelo acompanhar sem polling em rajada, e a leitura de saída passa a devolver status, exitCode e cancelled. O prompt passa a exigir o status real antes de afirmar que um job roda ou terminou, cursor por job começando em 0, repasse de cwd/label/maxRuntimeMs e leitura correta de cancelled: false.",
  },
  {
    version: 37,
    date: "2026-11-15",
    summary:
      "device-open-app agora descobre e abre aplicativos da Windows Store pelo AUMID (shell:AppsFolder) e confirma a abertura com verified (janela nova em ate 3s). A busca exclui shims de spotify_cli dentro de WindowsApps. O prompt exige confirmed janela/processo antes de afirmar que o app esta aberto ou tocando.",
  },
]
