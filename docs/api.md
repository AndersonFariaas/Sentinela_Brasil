# API do SENTINELA

**Base:** `/api/v1` (exemplo local: `http://127.0.0.1:3000/api/v1`).
**Formato:** JSON, exceto as páginas de cancelamento de alertas, que são HTML.

## Autenticação

As rotas marcadas com 🔒 exigem o token de acesso do Supabase no cabeçalho:

```http
Authorization: Bearer <access_token>
```

Sem token, ou com token inválido, a resposta é `401`. Em cada requisição, a API repassa o token ao Supabase, e o RLS do banco decide o que cada usuário enxerga.

## Erros

Todas as respostas de erro seguem o mesmo formato:

```json
{ "error": { "code": "DADOS_INVALIDOS", "message": "Página ou limite inválidos." } }
```

| Status | Código                                                 | Quando                                                                            |
| ------ | ------------------------------------------------------ | --------------------------------------------------------------------------------- |
| 400    | `DADOS_INVALIDOS`, `URL_INVALIDA`                      | Corpo ou parâmetro fora do formato. `URL_INVALIDA` é específico de `POST /scans`. |
| 401    | `NAO_AUTENTICADO`                                      | Token ausente ou inválido.                                                        |
| 404    | `NAO_ENCONTRADO`, `PERFIL_NAO_ENCONTRADO`, `NOT_FOUND` | Registro inexistente, ou rota que não existe.                                     |
| 429    | —                                                      | Limite de requisições excedido (ver abaixo).                                      |
| 500    | `INTERNAL_ERROR`                                       | Erro interno. A mensagem é sempre genérica; o detalhe vai só para o log.          |

## Limites de requisição

| Rota                                 | Limite        | Chave                            |
| ------------------------------------ | ------------- | -------------------------------- |
| `POST /scans`                        | 20 por minuto | Hash do token (ou IP, sem token) |
| `GET` e `POST /alertas/cancelar/:id` | 30 por minuto | IP                               |

O contador fica na memória de cada processo. Com mais de uma instância da API, cada uma conta por conta própria.

## Endpoints

### Saúde

| Método | Caminho   | Descrição                                                       |
| ------ | --------- | --------------------------------------------------------------- |
| GET    | `/health` | Retorna `{"status":"ok"}`. Usado pelo Render para checar a API. |

### Conta

| Método | Caminho    | Auth | Descrição                                                   |
| ------ | ---------- | ---- | ----------------------------------------------------------- |
| GET    | `/auth/me` | 🔒   | Dados do usuário logado: `id`, `email`, `fullName`, `role`. |

### Análise de URL (detector)

**`POST /scans`** 🔒 — analisa uma URL, grava o resultado no histórico e devolve a classificação.

Corpo:

```json
{ "url": "https://exemplo.com/login" }
```

- `url`: texto de até 2048 caracteres. Só `http` e `https`, sem usuário e senha, e nunca para endereços internos ou privados. A rejeição devolve `400` com `URL_INVALIDA`.

Resposta `201`:

```json
{
  "id": "6f1c…",
  "url": "https://exemplo.com/login",
  "host": "exemplo.com",
  "classificacao": "suspeito",
  "pontuacao": 62,
  "nivel": "alto",
  "criadaEm": "2026-11-02T12:00:00.000Z",
  "evidencias": [],
  "fontes": [],
  "analise": {
    "status": "fallback",
    "modelo": null,
    "evidenciasCitadas": [],
    "resumo": "…",
    "justificativa": "…",
    "recomendacoes": ["…"]
  },
  "algoritmo": "<versão das regras>"
}
```

- `classificacao`: `confirmado`, `suspeito` ou `nao_identificado`.
- `nivel`: `baixo`, `moderado`, `alto` ou `critico`.
- `analise.status` é `ok` quando a explicação veio da IA e passou na validação, ou `fallback` quando o texto veio das regras. Em `fallback`, a análise continua válida; só a explicação é mais simples.

**`GET /scans`** 🔒 — histórico do usuário.

| Parâmetro | Padrão | Limite                 |
| --------- | ------ | ---------------------- |
| `pagina`  | `1`    | Mínimo 1 (começa em 1) |
| `limite`  | `20`   | De 1 a 50              |

Resposta: `{ "itens": [...], "pagina": 1, "limite": 20, "temMais": false }`. Cada item tem o mesmo formato da análise, sem o campo `analise`.

**`GET /scans/:id`** 🔒 — uma análise completa. Devolve o mesmo formato do `POST`. `404` se não existir ou não for do usuário.

**`DELETE /scans/:id`** 🔒 — exclui uma análise. Devolve `204` sem corpo, ou `404`.

### Ameaças (inteligência)

Somente leitura. Os dados vêm das fontes coletadas pelo job diário (hoje, a CISA KEV).

**`GET /threats`** 🔒

| Parâmetro    | Padrão | Valores                                                                                                               |
| ------------ | ------ | --------------------------------------------------------------------------------------------------------------------- |
| `categoria`  | —      | `phishing`, `malware`, `ransomware`, `malicious_domain`, `suspicious_url`, `digital_fraud`, `exploited_vulnerability` |
| `severidade` | —      | `baixo`, `moderado`, `alto`, `critico`                                                                                |
| `limite`     | `20`   | De 1 a 100                                                                                                            |
| `pagina`     | `0`    | A partir de 0 (começa em 0)                                                                                           |

Resposta: `{ "itens": [...], "pagina": 0, "limite": 20, "temMais": true }`.

**`GET /threats/:id`** 🔒 — uma ameaça com os indicadores associados (`indicadores`). `404` se não existir.

**`GET /indicators`** 🔒

| Parâmetro | Padrão | Valores                                |
| --------- | ------ | -------------------------------------- |
| `tipo`    | —      | `domain`, `url`, `ip`, `sha256`, `cve` |
| `limite`  | `20`   | De 1 a 100                             |
| `pagina`  | `0`    | A partir de 0                          |

**`GET /indicators/:id`** 🔒 — um indicador. `404` se não existir.

> **Atenção:** a paginação de `/threats` e `/indicators` começa em **0**, e a de `/scans` começa em **1**. Isso é um problema de consistência a ser corrigido antes de a API ter clientes externos (ver "Pendências" abaixo).

### Alertas por e-mail

**`GET /alertas/inscricoes`** 🔒 — lista as sete categorias com o estado do usuário. Categoria sem registro aparece como `ativa: false`.

```json
{
  "inscricoes": [
    { "categoria": "phishing", "ativa": true },
    { "categoria": "malware", "ativa": false }
  ]
}
```

**`PUT /alertas/inscricoes/:categoria`** 🔒 — liga ou desliga uma categoria.

Corpo: `{ "ativa": true }`. Campos extras são recusados. Resposta: `{ "categoria": "phishing", "ativa": true }`.

**`GET /alertas/cancelar/:inscricaoId`** — página HTML com um botão para confirmar o cancelamento. Não cancela nada: leitores de e-mail costumam abrir links sozinhos.

**`POST /alertas/cancelar/:inscricaoId`** — desativa a inscrição. Não exige login: o identificador (UUID) do link de e-mail é a autorização. Responde com HTML de confirmação, igual para inscrição existente ou não, para não revelar quais existem.

Os e-mails trazem um cabeçalho `List-Unsubscribe-Post` (RFC 8058), para que o cliente de e-mail faça o cancelamento com um clique.

## Pendências desta documentação

- Padronizar a paginação (`/scans` começa em 1; `/threats` e `/indicators` começam em 0).
- Confirmar, com um teste, o corpo exato da resposta `429` do `@fastify/rate-limit`. Aqui ele só aparece pelo status.
