# SENTINELA

> Inteligência que antecipa ameaças. Tecnologia que protege pessoas.

Plataforma de Cyber Threat Intelligence que reúne fontes públicas de segurança, analisa URLs suspeitas, classifica o risco com regras documentadas e explica o resultado com IA.

**Status:** Fase 7 (Alertas por e-mail). Coleta ativa para a CISA KEV, detector de URL com regras determinísticas, explicação por IA com fallback e alertas por e-mail via Resend.

## Requisitos

- Node.js 22.12 ou superior (o projeto usa a versão indicada em `.nvmrc`, 24 LTS)
- npm 10 ou superior

## Como rodar localmente

```bash
# 1. Variáveis de ambiente
cp .env.example .env

# 2. Dependências
npm --prefix backend ci
npm --prefix frontend ci

# 3. Em dois terminais
npm run dev:backend    # API em http://127.0.0.1:3000
npm run dev:frontend   # Interface em http://localhost:5173
```

A interface mostra o status da API na página inicial. Teste direto da API:

```bash
curl http://127.0.0.1:3000/api/v1/health
# {"status":"ok"}
```

## Scripts

| Comando                | O que faz                                         |
| ---------------------- | ------------------------------------------------- |
| `npm run lint`         | ESLint nos dois projetos                          |
| `npm run typecheck`    | Verificação de tipos TypeScript nos dois projetos |
| `npm test`             | Testes com Vitest nos dois projetos               |
| `npm run build`        | Build de produção nos dois projetos               |
| `npm run format:check` | Verifica a formatação com Prettier                |

## Estrutura

```
backend/    API Fastify + TypeScript + Zod
frontend/   Interface Vue 3 + Vite + Tailwind + Pinia
docs/       Arquitetura, banco, segurança, backlog e roadmap
.github/    Pipeline de integração contínua
```

Documentação de decisões está em [docs/architecture.md](docs/architecture.md), [docs/database.md](docs/database.md) e [docs/security.md](docs/security.md).

## Coleta de ameaças (Fase 4)

As fontes são cadastradas na tabela `sources`. Hoje a coleta está ativa para a **CISA KEV** (feed público, sem chave). URLhaus e CERT.br ficam inativas até a chave correspondente ser configurada.

```bash
cd backend
npm run ingestao   # exige SUPABASE_SERVICE_ROLE_KEY no .env da raiz (nunca versionar)
```

A saída é uma linha JSON por evento, sem segredos. O comando sai com código 1 se alguma fonte falhar.

## Detector de URLs (Fase 5)

`POST /api/v1/scans` recebe `{ "url": "https://..." }` e devolve classificação (`confirmado`, `suspeito` ou `nao_identificado`), pontuação de 0 a 100, nível de risco, evidências e fontes consultadas. `GET /api/v1/scans/:id` lê um resultado salvo. Os dois exigem login.

- O servidor **não acessa** a URL informada. A análise é feita só na string.
- Endereços internos, privados e com usuário e senha são recusados antes de qualquer consulta.
- Pesos e limites ficam em [backend/src/config/risk-rules.json](backend/src/config/risk-rules.json), com versão gravada em cada resultado.
- A reputação usa só os indicadores já coletados. Sem a URLhaus ativa, a maioria dos resultados fica em `nao_identificado`, e a pontuação fica limitada a 39.

## Análise por IA (Fase 6)

A explicação do resultado é gerada pela Anthropic. A classificação e a pontuação vêm sempre do motor de regras.

- Modelo padrão: `claude-haiku-5-5`. Para trocar, defina `IA_MODELO` no `.env` do servidor.
- Só o host e as evidências são enviados ao modelo. A URL completa fica no servidor.
- Resposta fora do contrato, ou que contradiz o motor, é descartada. Nesse caso, e sem `ANTHROPIC_API_KEY`, o texto vem das regras (`ai_status = fallback`).
- Limite de 20 análises por minuto por sessão (token de login), em memória do processo.

## Alertas por e-mail (Fase 7)

Quando uma ameaça verificada entra no banco, a coleta cria um alerta para cada usuário inscrito na categoria e envia o e-mail pela Resend. Hoje, a única fonte que verifica ameaças é a CISA KEV.

- O gatilho é o próprio `npm run ingestao`, logo após a coleta. Não há agendador: quem roda a coleta também dispara os alertas.
- Sem `RESEND_API_KEY` no `.env`, a coleta roda normalmente e os alertas ficam desativados.
- `ALERTA_REMETENTE` é opcional. O padrão, `onboarding@resend.dev`, só envia para o e-mail da conta Resend. Para enviar a outros destinatários, verifique um domínio na Resend e use um remetente desse domínio.
- Não há duplicidade: cada alerta tem chave única no banco e a mesma chave de idempotência na Resend. A Resend guarda essa chave por 24 horas. Repetir a execução não reenvia.
- Até três tentativas por alerta. Erro de chave, de remetente ou de dados não é repetido.
- **Limitação:** ainda não há link de cancelamento nem tela de inscrições (FE-011). Antes de enviar a usuários reais, isso precisa existir.

## Licença

Distribuído sob a [licença MIT](LICENSE).
