# SENTINELA

> Inteligência que antecipa ameaças. Tecnologia que protege pessoas.

Plataforma de Cyber Threat Intelligence que reúne fontes públicas de segurança, analisa URLs suspeitas, classifica o risco com regras documentadas e explica o resultado com IA.

**Status:** Fase 4 (Threat Intelligence). Coleta ativa para a CISA KEV, com feed e detalhes no front.

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

## Licença

Distribuído sob a [licença MIT](LICENSE).
