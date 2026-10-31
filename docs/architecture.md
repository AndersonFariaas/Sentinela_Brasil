# SENTINELA — Arquitetura

**Status:** proposta para aprovação (Fase 0)
**Data:** 31/10/2026
**Escrito para:** time de quatro integrantes e avaliadores técnicos do Hack Brasil.

---

## 1. Visão

Plataforma de Cyber Threat Intelligence para pessoas e pequenas empresas brasileiras.

Fluxo principal: **COLETAR → NORMALIZAR → ANALISAR → CLASSIFICAR → EXPLICAR → ALERTAR**.

O sistema não substitui antivírus, firewall ou SIEM. Ele reúne fontes públicas, aplica regras documentadas e explica o resultado.

---

## 2. Decisões principais

| # | Decisão | Alternativa descartada | Motivo |
|---|---|---|---|
| D1 | Backend em **Fastify 5 + TypeScript + Zod** | Express (usado no projeto `vigia`) | Exigido pelo escopo. Schemas Zod validam a entrada na fronteira. |
| D2 | Frontend em **Vue 3 + Vite + Tailwind 4 + Pinia + Vue Router** | React | Exigido pelo escopo. Tailwind 4 permite centralizar tokens com `@theme`. |
| D3 | Repositório único com as pastas `frontend/` e `backend/`, **sem workspaces** | Workspaces com pacote compartilhado de tipos | Menos ferramentas para um MVP de um mês (YAGNI). O contrato da API fica documentado em OpenAPI. Revisar se a duplicação de tipos incomodar. |
| D4 | **Supabase** para Auth, Postgres e RLS | Autenticação própria | Exigido pelo escopo. Reduz a superfície de código de autenticação que o time precisa manter. |
| D5 | Endpoints do usuário consultam o banco **com o JWT do próprio usuário**, para que o RLS também valha no back-end | Back-end usar `service_role` em todas as requisições | A `service_role` ignora RLS. Se for usada em tudo, a autorização passa a depender só do código da aplicação. `service_role` fica restrita a jobs de ingestão e a tarefas administrativas do servidor. |
| D6 | **Sem requisição ativa à URL analisada** no MVP (o servidor não busca o conteúdo do site enviado pelo usuário) | Inspeção ativa em ambiente isolado | Elimina a maior superfície de SSRF. O escopo só exige inspeção ativa "caso seja necessária". Reavaliar depois do MVP. |
| D7 | **Motor de risco determinístico**, com pesos em arquivo versionado | Pontuação gerada pela IA | Exigência do escopo: a IA não inventa classificação. |
| D8 | **Camada de LLM com interface própria** e um adaptador inicial (Anthropic) | Chamadas ao SDK espalhadas pela lógica | Exigência de independência de provedor. Também permite um fallback sem IA. |
| D9 | Backend em **container Node** (Render, Railway ou Fly.io) | Vercel Functions para o back-end | Jobs de coleta agendados e controle de saída de rede não se encaixam bem em serverless. Frontend continua na Vercel. |
| D10 | Coleta: **APIs e feeds estruturados** (CISA KEV, URLhaus) consumidos direto; **Firecrawl** só para páginas HTML (CERT.br) | Firecrawl para todas as fontes | Feeds estruturados são mais confiáveis, mais baratos e mais fáceis de rastrear. Firecrawl continua sendo usado de forma efetiva, onde o HTML é a única opção. |

---

## 3. Stack e versões

Versões consultadas no npm em 31/10/2026. Na Fase 1, a versão exata fica fixada no `package-lock.json`.

| Camada | Pacote | Versão mais recente | Observação |
|---|---|---|---|
| Frontend | vue | 3.5.44 | |
| Frontend | vite | 8.3.5 | Conferir o requisito mínimo de Node na documentação antes de fixar. |
| Frontend | tailwindcss (+ `@tailwindcss/vite`) | 4.3.3 | Tokens via `@theme`. |
| Frontend | pinia | 4.1.0 | |
| Frontend | vue-router | 5.4.0 | |
| Frontend | lucide-vue-next | 1.0.0 | Ícones. |
| Frontend | @supabase/supabase-js | 2.118.0 | Cliente com a chave pública (anon) apenas. |
| Backend | fastify | 5.12.7 | Logger pino já vem embutido, com redaction de campos sensíveis. |
| Backend | zod | 4.6.7 | Validação de entrada e de respostas de IA e de feeds. |
| Backend | resend | 6.37.0 | Envio de e-mail com chave de idempotência. |
| Qualidade | typescript | 7.0.2 | **Atenção:** major recém-lançada. Testar com `vue-tsc` e `typescript-eslint` antes de fixar. Se houver atrito, usar a linha 5.x estável. |
| Qualidade | vitest | 5.0.5 | Testes unitários e de integração. |
| Qualidade | eslint | 10.14.0 | |
| Qualidade | prettier | 3.9.10 | |
| Runtime | Node.js | ambiente local: 24.21.0 (npm 11.19.0) | Definir na Fase 1: Node 24 LTS (ou 22 LTS) em `engines`, `.nvmrc` e no CI. |

Plugins do Fastify previstos (versões a confirmar na Fase 1): `@fastify/helmet`, `@fastify/cors`, `@fastify/rate-limit`, `@fastify/swagger`.

---

## 4. Estrutura do repositório

Segue a estrutura do escopo, com ajustes pontuais:

```
sentinela-brasil/
├── frontend/
│   └── src/
│       ├── assets/ components/ layouts/ pages/ router/
│       ├── stores/ services/ composables/ types/
├── backend/
│   └── src/
│       ├── modules/
│       │   ├── auth/  threats/  indicators/  intelligence/
│       │   ├── phishing/  ai-analyst/  alerts/  reports/
│       ├── integrations/
│       │   ├── threat-feeds/ (cisa-kev, urlhaus, cert-br)
│       │   ├── firecrawl/  resend/  ai/ (interface + provedores)
│       ├── middleware/  plugins/  schemas/  config/  utils/
│       └── server.ts
├── database/
│   ├── migrations/   (SQL versionado)
│   └── seeds/        (somente dados marcados como DEMO)
├── docs/             (este diretório)
├── .github/workflows/  ISSUE_TEMPLATE/
├── .env.example  .gitignore  README.md  CONTRIBUTING.md  LICENSE
```

Regras de organização:

- Cada módulo do backend tem um `service` (regra de negócio), um `routes` (HTTP e validação) e um `repository` (acesso ao banco). Nenhuma rota fala direto com o banco.
- Regras de negócio puras (motor de risco, normalização de URL, deduplicação) ficam sem dependência de HTTP ou de banco. Isso permite testá-las com Vitest sem subir servidor.
- `integrations/` contém somente adaptadores externos. Trocar um provedor de IA ou de e-mail não deve exigir mudança fora dessa pasta.

---

## 5. Fluxos principais

### 5.1 Coleta (COLETAR → NORMALIZAR)

1. Um agendador lê as fontes com `is_active = true` e executa o adaptador de cada uma.
2. O adaptador valida o payload com Zod. Se o formato mudar, a execução falha e nada é gravado.
3. Cada registro vira uma ameaça e, quando houver, indicadores (domínio, URL, IP, hash, CVE).
4. A deduplicação usa uma `dedupe_key` estável (fonte + identificador externo). Um registro já existente é atualizado, e a mudança fica em `threat_revisions`.
5. Cada execução grava uma linha em `ingestion_runs` com contagens e erro resumido.
6. Após N falhas consecutivas (sugestão: 5), a fonte é desativada automaticamente e o erro é registrado. A reativação é manual.

Limites por fonte: tempo máximo de requisição, tamanho máximo da resposta e intervalo mínimo entre execuções, conforme os termos de cada fonte.

### 5.2 Análise de URL (ANALISAR → CLASSIFICAR)

1. **Validação:** tamanho máximo de 2048 caracteres, apenas `http` e `https`, sem credenciais no formato `usuario:senha@`, sem caracteres de controle.
2. **Normalização:** minúsculas no host, conversão para punycode, remoção de porta padrão, remoção de fragmento.
3. **Heurísticas estruturais:** host é IP, muitos subdomínios, palavras de isca no domínio, caracteres não ASCII (possível homógrafo), HTTP sem TLS, URL muito longa. Cada sinal gera uma regra com identificador e peso.
4. **Reputação:** consulta local aos indicadores já coletados e, se configurada, à API do URLhaus.
5. **Motor de risco:** aplica as regras de classificação e de pontuação (seção 5.3).
6. **Explicação:** a IA recebe apenas o resultado estruturado do motor e devolve texto (seção 5.4).
7. **Persistência:** grava o escaneamento com regras acionadas, evidências, fontes consultadas e a versão do algoritmo.

### 5.3 Motor de risco

**Saídas separadas:**

- **Classificação** (estado de evidência): `confirmado`, `suspeito` ou `nao_identificado`.
- **Nível de risco** (faixa da pontuação): baixo (0–19), moderado (20–39), alto (40–69), crítico (70–100).

Essas duas saídas são independentes. Uma URL pode ter pontuação alta sem estar confirmada, se os sinais forem só estruturais.

**Agrupamento de evidências (evita somar sinais correlacionados):**

- **Grupo R (reputação):** correspondência com indicador de fonte. Dentro do grupo vale o maior peso, nunca a soma. Peso = tipo do indicador × confiabilidade da fonte (1–5) × fator de recência.
- **Grupo E (estrutura):** heurísticas da seção 5.2. Dentro do grupo também vale o maior peso.

**Combinação:**

```
pontuação = min(100, maior(R, E) + 0,5 × menor(R, E))
```

Regras de limite:

- Sem correspondência de reputação (R = 0), a pontuação não passa de 39. Sinais estruturais não bastam para afirmar risco alto.
- Classificação `confirmado`: pelo menos uma correspondência em fonte com confiabilidade ≥ 4 e indicador visto nos últimos 90 dias (valores a validar com o time).
- Classificação `suspeito`: sinais estruturais acima de um limiar, ou correspondência em fonte de confiabilidade menor.
- Classificação `nao_identificado`: nenhum dos casos acima.

**Ausência de evidência não zera a pontuação.** Quando não há nenhuma evidência, a pontuação recebe uma base de incerteza configurável (proposta: 10). Essa base representa falta de informação, não segurança. A tela deve dizer isso com clareza.

Todos os pesos, limiares e a base de incerteza ficam em `backend/src/config/risk-rules.json`, com número de versão. Cada resultado salva a versão usada. Os casos de teste da Fase 9 validam a configuração.

### 5.4 AI Security Analyst

- **Entrada:** somente o JSON estruturado do motor de risco, com identificadores de cada evidência. Títulos e descrições vindos de feeds entram como dados, dentro de blocos delimitados, nunca como instrução.
- **Saída:** JSON validado por schema Zod. Cada afirmação precisa citar um `evidence_id` existente. Afirmação sem referência é descartada.
- **Campos:** resumo, explicação dos indicadores, justificativa da classificação, avaliação das evidências, recomendações, versão simplificada e versão técnica. Cada trecho é rotulado como fato verificado, indicador observado, inferência, hipótese ou desconhecido.
- **Falhas:** timeout, limite de tokens, erro do provedor ou JSON inválido levam ao **fallback determinístico**. O fallback monta o texto a partir das mesmas regras. O resultado é marcado com `ai_status = fallback`.
- **Custo:** modelo menor para explicação curta (Claude Haiku 5.5 como padrão) e modelo maior apenas se a qualidade exigir (Claude Sonnet 5.5). A escolha final fica em aberto (ver `roadmap.md`).

### 5.5 Alertas

1. Quando uma ameaça nova ou atualizada entra no banco, o serviço procura as inscrições (`subscriptions`) de categoria correspondente e com `enabled = true`.
2. Para cada destinatário, cria um registro em `alerts` com chave de idempotência `alert:{user_id}:{threat_id}:{alert_type}`. A restrição `UNIQUE` no banco impede duplicidade mesmo se o job rodar duas vezes.
3. O envio usa a Resend com o mesmo valor como `idempotencyKey`. A Resend documenta essa chave para `POST /emails` e `POST /emails/batch`. A janela de validade da chave deve ser conferida na documentação antes da implementação.
4. Falhas são registradas em `delivery_status` com até três tentativas. Erros guardam só o resumo, sem chaves ou conteúdo sensível.

---

## 6. Riscos técnicos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Prazo: 30 dias para escopo de 11 fases com quatro pessoas | Alta | Alto | Corte de MVP (ver `roadmap.md`). Gates de qualidade ao fim de cada bloco. |
| Regras oficiais do Hack Brasil 2026 não verificadas | Alta | Médio | Pesquisa não encontrou página oficial. Pedir o regulamento antes da Fase 11. |
| Chaves externas dependem de contas do time (abuse.ch, Firecrawl, Resend, provedor de IA) | Média | Alto | Abrir as contas no início da Fase 1. Sem chave, o módulo cai no fallback. |
| Firecrawl: créditos limitados e termos de uso das páginas | Média | Médio | Usar só páginas autorizadas, com cache e baixa frequência. |
| Exposição da `service_role` | Baixa | Crítico | Chave só no servidor. Varredura de segredos no CI. Revisão em todo PR que toca em configuração. |
| SSRF | Baixa (sem fetch de URL do usuário) | Crítico | Política de D6 e lista de domínios permitidos para saída de rede. |
| Prompt injection via texto de feeds | Média | Médio | Separação de canais, saída em schema, referência obrigatória às evidências e classificação feita fora da IA. |
| TypeScript 7 incompatível com ferramentas do ecossistema | Média | Baixo | Testar na Fase 1. Fallback para 5.x. |
| Precisão e recall sem conjunto rotulado | Alta | Médio | Montar o conjunto de URLs rotuladas na Fase 9. Não declarar métricas sem executar o teste. |

---

## 7. Fora deste documento

- Modelagem detalhada do banco: `database.md`.
- Políticas de segurança, RLS e controles de SSRF: `security.md`.
- Tarefas por integrante e critérios de aceitação: `backlog.md`.
- Cronograma, corte de escopo e decisões pendentes: `roadmap.md`.
