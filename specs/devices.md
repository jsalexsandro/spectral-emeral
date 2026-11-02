# Dispositivos (Devices)

Módulo de emparelhamento e presença de computadores conectados à conta. A UI
fica em **Configurações → Dispositivos**; o gerenciamento HTTP roda no app
Next.js e o servidor de sockets é um serviço independente.

## Arquitetura

- `app/api/devices/**`: fonte de verdade do domínio (sessão, propriedade, códigos).
- `spectral/backend`: servidor WebSocket (`ws`) que autentica o driver consultando
  o mesmo PostgreSQL. Não expõe HTTP de gerenciamento.
- `spectral/driver`: CLI executada no dispositivo, com identidade local e reconexão.
- Pacotes independentes (`package.json`, `tsconfig.json` e `node_modules` próprios).

```text
Driver --HTTP--> Next.js (/api/devices/pairing...) --SQL--> PostgreSQL
Driver --WS----> spectral/backend (auth + heartbeat)  --SQL--> PostgreSQL
App    --HTTP--> Next.js (/api/devices)               --SQL--> PostgreSQL
```

## Emparelhamento

1. O driver gera (ou carrega) um par de chaves Ed25519 em
   `~/.spectral/driver/identity.json` (permissão `0600`).
2. `POST /api/devices/pairing` recebe a chave pública, hostname, plataforma e
   arquitetura. O servidor gera um código de 6 caracteres, guarda apenas o
   HMAC-SHA256 e devolve `{ sessionId, code, expiresAt, pollIntervalMs }`.
3. O usuário informa o código em Configurações → Dispositivos.
4. `POST /api/devices/pairing/confirm` valida o código e, em transação, bloqueia
   a sessão (`FOR UPDATE`), verifica expiração/uso, impede duplicidade ativa do
   mesmo fingerprint e cria o `Device`.
5. O driver consulta `GET /api/devices/pairing/:id`, recebe `paired` com
   `deviceId` e persiste o vínculo na identidade local.
6. O driver abre o WebSocket e autentica por desafio/assinatura.

### Regras do código

- Alfabeto `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (32 símbolos; sem `O`, `0`, `I`, `1`).
- 6 caracteres, TTL de 5 minutos, uso único.
- Hash com `DEVICE_PAIRING_SECRET`; se ausente, usa `AUTH_SECRET`.
- O código nunca é gravado no banco, logado no servidor ou incluído em erros.
- Respostas de confirmação: `invalid_code` (404), `expired_code` (410),
  `used_code` (409), `already_paired` (409).
- Rate limit em memória (single-instance): 10 solicitações/min por IP e
  5 confirmações/min por usuário.

## HTTP

| Método | Rota | Acesso | Descrição |
| --- | --- | --- | --- |
| `POST` | `/api/devices/pairing` | Driver | Solicita código |
| `GET` | `/api/devices/pairing/:id` | Driver | Consulta estado (`pending`, `paired`, `expired`) |
| `POST` | `/api/devices/pairing/confirm` | Usuário | Confirma o código |
| `GET` | `/api/devices` | Usuário | Lista dispositivos ativos |
| `GET` | `/api/devices/:id` | Proprietário | Consulta um dispositivo |
| `PATCH` | `/api/devices/:id` | Proprietário | Renomeia |
| `DELETE` | `/api/devices/:id` | Proprietário | Revoga (soft delete) |

Toda operação de gerenciamento deriva o `userId` da sessão autenticada. O
frontend nunca informa o proprietário.

## Protocolo WebSocket

Transporte `ws://` em desenvolvimento e `wss://` atrás de TLS em produção.

| Evento | Direção | Finalidade |
| --- | --- | --- |
| `device:authenticate` | Driver → Backend | Envia `deviceId` e `fingerprint` |
| `device:challenge` | Backend → Driver | Desafio aleatório de 32 bytes (30s) |
| `device:authenticate:proof` | Driver → Backend | Assinatura Ed25519 do desafio |
| `device:authenticated` | Backend → Driver | Confirmação + parâmetros de heartbeat |
| `device:heartbeat` | Driver → Backend | Sinal de vida |
| `device:heartbeat:ack` | Backend → Driver | Confirmação do heartbeat |
| `device:disconnect` | Driver → Backend | Encerramento voluntário |
| `device:error` | Backend → Driver | Erro com `code` estável antes do fechamento |

- Heartbeat a cada 15s; timeout de 45s sem heartbeat encerra a conexão.
- Autenticação deve concluir em 10s.
- Uma conexão ativa por dispositivo; uma nova autenticação fecha a anterior
  com `4001` (`replaced`).
- `lastSeenAt` é atualizado no authenticate e em cada heartbeat. O app considera
  online quando `now - lastSeenAt <= 45s`.
- Cada heartbeat consulta a revogação de forma condicional; dispositivo revogado
  recebe `revoked_device` e o socket é fechado.
- `maxPayload` de 16 KB e rate limit em memória por IP.

### Códigos de fechamento

| Código | Motivo |
| --- | --- |
| `4001` | Conexão substituída |
| `4002` | Heartbeat expirado |
| `4003` | Timeout de autenticação |
| `4004` | Dispositivo revogado |
| `4005` | Dispositivo desconhecido |
| `4006` | Falha de autenticação |
| `4007` | Rate limit |
| `4008` | Mensagem inválida |
| `4009` | Erro interno |
| `4010` | Backend encerrando |

## Driver

```bash
npm run install:services     # instala dependências dos dois pacotes
npm run dev:backend          # inicia o WebSocket em :4001
npm run dev:driver           # inicia o driver (emparelha se necessário)
npm run pair:driver          # força uma nova solicitação de código
```

O backend e o driver carregam o `.env` da raiz automaticamente, sem sobrescrever
variáveis já definidas no ambiente. O driver também aceita um `.env` local em
`spectral/driver/.env` com prioridade sobre o da raiz.

Variáveis do driver:

- `SPECTRAL_API_URL` (padrão `http://localhost:3000`)
- `SPECTRAL_WS_URL` (padrão `ws://localhost:4001`)
- `SPECTRAL_DRIVER_HOME` (padrão `~/.spectral/driver`)

Variáveis do backend:

- `DATABASE_URL`
- `SPECTRAL_WS_HOST` (padrão `0.0.0.0`)
- `SPECTRAL_WS_PORT` (padrão `4001`)
- `DEVICE_HEARTBEAT_TIMEOUT_MS` (padrão `45000`)

O driver reautentica em cada reconexão com a chave privada local, usando backoff
exponencial com jitter. Se receber `revoked_device` ou `unknown_device`, encerra
e orienta executar `--pair`. Se outra instância assumir o dispositivo
(`replaced`), esta instância encerra.

## Segurança e limitações

- A chave privada nunca sai do dispositivo; o servidor guarda apenas a pública.
- Fingerprint = SHA-256 (base64url) do DER SPKI; apenas chaves Ed25519 são aceitas.
- Revogação é lógica e encerra o socket ativo no próximo heartbeat (≤15s).
- Rate limit e mapa de sockets são em memória; múltiplas instâncias exigiriam
  Redis (ou equivalente) para presença e coordenação.
- No Windows, `chmod 0600` é emulado de forma limitada; proteja o diretório do
  usuário com as permissões do sistema.
- Este MVP não oferece comando remoto, acesso a arquivos, terminal ou
  ferramentas de IA.
