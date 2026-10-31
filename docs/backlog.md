# SENTINELA — Backlog inicial

**Status:** proposta para aprovação (Fase 0). Cada linha vira uma Issue no GitHub Projects.
**Data:** 31/10/2026
**Escrito para:** os quatro integrantes, para dividir o trabalho e acompanhar o andamento.

---

## 1. Como ler

- **Responsável:** proposta. Os nomes dos integrantes ainda não foram definidos, então aparecem como `Integrante 1` a `Integrante 4` (funções do escopo).
- **Prioridade:**
  - **P0:** essencial para o MVP. Sem isso, o fluxo principal não funciona.
  - **P1:** desejável. Entra se o gate anterior passar com folga.
  - **P2:** fora do MVP. Fica documentado, não é implementado agora.
- **Critério de aceitação:** resumo. Cada Issue completa precisa de texto próprio com passos de teste.
- **Definição de pronto:** código integrado, testes executados e passando, CI verde, revisão de outro integrante, e funcionalidade demonstrável na interface ou na API quando aplicável.

---

## 2. Integrante 1 — Tech Lead / Cybersecurity

Arquitetura, back-end principal, Supabase, autenticação, RLS, segurança e revisão.

| ID      | Tarefa                                                                                                                                  | Prior. | Depende de             | Critério de aceitação (resumo)                                                                                                  |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| SEN-001 | Criar o repositório público, `main` protegida, templates de Issue e PR, `.gitignore` com `.env` e `.claude/`                            | P0     | Aprovação da Fase 0    | Push direto em `main` bloqueado. `.claude/` e `.env` ignorados. Confirmar a licença antes de tornar público (ver `roadmap.md`). |
| SEN-002 | Criar o scaffold do back-end: Fastify 5, TypeScript, Zod, configuração por ambiente, logger com redaction                               | P0     | SEN-001                | `GET /api/v1/health` responde 200. Build e lint passam. Teste confirma que `authorization` não aparece no log.                  |
| SEN-003 | Criar o projeto Supabase de desenvolvimento e o de teste, com as migrations da tabela `profiles` e do trigger                           | P0     | SEN-001                | Migration versionada em `database/migrations/`. Trigger cria `profiles` ao cadastrar usuário.                                   |
| SEN-004 | Migrations das tabelas de dados globais (`sources`, `threats`, `indicators`, `threat_indicators`, `threat_revisions`, `ingestion_runs`) | P0     | SEN-003                | Constraints e índices de `database.md` aplicados. Revisado pelo Integrante 2.                                                   |
| SEN-005 | Migrations das tabelas por usuário (`scans`, `analyses`, `alerts`, `subscriptions`) e de `audit_log`                                    | P0     | SEN-003                | Constraints de `database.md` aplicados. `UNIQUE` de `alerts` e `subscriptions` testado.                                         |
| SEN-006 | Políticas de RLS de todas as tabelas, incluindo privilégio de coluna em `profiles`                                                      | P0     | SEN-004, SEN-005       | Nenhuma tabela sem RLS. Teste de escalada de `role` falha como esperado.                                                        |
| SEN-007 | Testes de isolamento entre dois usuários reais (leitura, escrita, exclusão, `WITH CHECK`)                                               | P0     | SEN-006                | Os cinco cenários de `database.md` §5 passam no CI contra o projeto de teste.                                                   |
| SEN-008 | Autenticação: cadastro, login, confirmação de e-mail e middleware de JWT no back-end                                                    | P0     | SEN-002, SEN-003       | Rota protegida recusa token ausente, expirado ou inválido. Erro de login genérico.                                              |
| SEN-009 | Rate limit, CORS restrito e cabeçalhos (`@fastify/rate-limit`, `@fastify/cors`, `@fastify/helmet`)                                      | P0     | SEN-002                | Limites de `security.md` §9 ativos. Teste com origem não permitida recebe bloqueio.                                             |
| SEN-010 | Pipeline de CI: instalação, lint, tipos, testes, build, `npm audit` e varredura de segredos                                             | P0     | SEN-002                | Pipeline falha quando qualquer etapa falha. Nenhuma etapa desligada.                                                            |
| SEN-011 | Lista de saída de rede e cliente HTTP único com timeout e limite de tamanho                                                             | P0     | SEN-002                | Host fora da lista é recusado e registrado. Teste cobre timeout e resposta grande.                                              |
| SEN-012 | Documentação de API (OpenAPI gerado a partir dos schemas, via `@fastify/swagger`)                                                       | P1     | SEN-002                | `/api/docs` mostra todas as rotas do MVP.                                                                                       |
| SEN-013 | Revisão de todos os PRs sensíveis (auth, RLS, migrations, integrações, prompts)                                                         | P0     | Contínuo               | Nenhum PR sensível mergeado sem a revisão registrada.                                                                           |
| SEN-014 | Varredura do histórico do repositório antes de torná-lo público                                                                         | P0     | Fim do desenvolvimento | Ferramenta de varredura executada sobre o histórico, com resultado anexado.                                                     |

---

## 3. Integrante 2 — Threat Intelligence Engineer

Fontes, coleta, normalização, indicadores, deduplicação e Threat Feed.

| ID     | Tarefa                                                                                                         | Prior. | Depende de                                            | Critério de aceitação (resumo)                                                                                      |
| ------ | -------------------------------------------------------------------------------------------------------------- | ------ | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| TI-001 | Adaptador CISA KEV (feed JSON) com validação Zod e teste usando fixture                                        | P0     | SEN-002, SEN-004                                      | Ingestão grava vulnerabilidades com `cve_id` válido. Payload com formato inesperado não grava nada e registra erro. |
| TI-002 | Adaptador URLhaus (API com Auth-Key)                                                                           | P0     | SEN-011, conta abuse.ch                               | Consulta de URL e de host retorna resultado validado. Chave lida do ambiente, nunca registrada em log.              |
| TI-003 | Integração Firecrawl para páginas do CERT.br, limitada à lista de páginas autorizadas                          | P0     | SEN-011, chave Firecrawl, termos do CERT.br revisados | Extração gera ameaças com `source_url`. Página fora da lista é recusada. Falha de créditos ou limite é tratada.     |
| TI-004 | Normalização e deduplicação (`dedupe_key`, comparação de `changed_fields`)                                     | P0     | TI-001                                                | Mesma entrada duas vezes gera uma linha. Mudança gera registro em `threat_revisions`.                               |
| TI-005 | Extração e normalização de indicadores (domínio, URL, IP, hash, CVE)                                           | P0     | TI-002                                                | Valores normalizados conforme `database.md` §3.4. Testes com casos de maiúsculas, punycode e porta.                 |
| TI-006 | Agendador de coleta, `ingestion_runs` e desativação automática após falhas                                     | P0     | TI-001, TI-004                                        | Execução registrada. Após 5 falhas seguidas a fonte fica inativa. Reativação manual.                                |
| TI-007 | Endpoints `GET /threats`, `GET /threats/:id`, `GET /indicators`, `GET /indicators/:id` com paginação e filtros | P0     | SEN-008, TI-005                                       | Respostas validadas. Paginação com limite máximo de 100. Filtro por categoria e severidade.                         |
| TI-008 | Fonte de demonstração claramente marcada como DEMO (seed)                                                      | P1     | SEN-003                                               | Nome da fonte começa com `DEMO —`. Interface mostra a marca.                                                        |
| TI-009 | Fontes oficiais brasileiras adicionais                                                                         | P2     | TI-003                                                | Após validar termos e formato. Fora do MVP se o prazo apertar.                                                      |

---

## 4. Integrante 3 — Frontend Developer

Vue 3, Tailwind, componentes, telas, responsividade.

| ID     | Tarefa                                                                                               | Prior. | Depende de             | Critério de aceitação (resumo)                                                                     |
| ------ | ---------------------------------------------------------------------------------------------------- | ------ | ---------------------- | -------------------------------------------------------------------------------------------------- |
| FE-001 | Scaffold: Vite, Vue 3, TypeScript, Tailwind 4 (`@theme` com tokens), Router, Pinia, lucide-vue-next  | P0     | SEN-001                | `npm run build` passa. Tokens de cor e espaçamento centralizados em um arquivo.                    |
| FE-002 | Layout base: sidebar, topbar, área principal, navegação, perfil e notificações                       | P0     | FE-001                 | Funciona em 375 px sem rolagem horizontal. Alvos de toque com pelo menos 44 px. Foco visível.      |
| FE-003 | Login e cadastro com validação de formulário e estados de erro                                       | P0     | SEN-008, FE-002        | Mensagem de erro genérica. Guard de rota redireciona usuário não autenticado.                      |
| FE-004 | Estados padronizados: loading, empty, error, success, unauthorized                                   | P0     | FE-002                 | Componente reutilizável usado em todas as telas de dados.                                          |
| FE-005 | Dashboard com cards de indicadores, sempre sinalizando dados DEMO quando for o caso                  | P1     | TI-007                 | Nenhum número fictício aparece sem a marca DEMO.                                                   |
| FE-006 | Threat Feed com filtros, pesquisa e tabela responsiva                                                | P0     | TI-007, FE-004         | Filtros por categoria, severidade e pesquisa por texto. Lista não trava com 500 itens (paginação). |
| FE-007 | Threat Details com indicadores, evidências, fonte e histórico de atualizações                        | P0     | TI-004, FE-006         | Todas as referências externas são links com `rel="noopener noreferrer"`.                           |
| FE-008 | Tela do Phishing Detector (formulário de URL com validação no cliente, sem substituir a do servidor) | P0     | SEN-008, FE-004        | Erro de validação aparece no campo. Envio bloqueado com URL inválida.                              |
| FE-009 | Tela de resultados do scan com classificação, pontuação, evidências, fontes e recomendações          | P0     | AI-002, AI-001, FE-008 | Mostra "não identificado" sem usar a palavra "seguro". Texto da IA marcado quando for fallback.    |
| FE-010 | Histórico de análises com exclusão pelo usuário                                                      | P0     | SEN-006, FE-004        | Exclusão remove o registro da lista e do banco (teste de RLS).                                     |
| FE-011 | Alerts e Settings (inscrições por categoria)                                                         | P1     | ALR-001                | Mudança de inscrição salva e refletida na próxima consulta.                                        |
| FE-012 | Tela AI Security Analyst separada                                                                    | P2     | AI-004                 | A explicação aparece junto do resultado (FE-009) no MVP. Tela separada só se sobrar tempo.         |
| FE-013 | Página de relatório                                                                                  | P2     | AI-004                 | No MVP, exportação em JSON e impressão a partir de FE-009 cobrem o requisito.                      |
| FE-014 | Revisão de acessibilidade (contraste, teclado, `prefers-reduced-motion`)                             | P0     | FE-002                 | Checklist de contraste WCAG AA e navegação por teclado documentado.                                |

---

## 5. Integrante 4 — AI Engineer / QA

Motor de risco, pipeline do scanner, integração com IA, prompts, testes e métricas.

| ID     | Tarefa                                                                                                                    | Prior. | Depende de                          | Critério de aceitação (resumo)                                                                                                                 |
| ------ | ------------------------------------------------------------------------------------------------------------------------- | ------ | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| AI-001 | Motor de risco determinístico: grupos R e E, combinação, limites e `risk-rules.json` versionado                           | P0     | Aprovação de `architecture.md` §5.3 | Testes de caso cobrem: sem evidência (pontuação ≥ base), só estrutura (≤ 39), reputação forte (crítico), regras correlacionadas (não somadas). |
| AI-002 | Pipeline do scanner: validação, normalização, heurísticas e consulta de reputação                                         | P0     | AI-001, TI-005, SEN-011             | Entradas malformadas, credenciais na URL e IP privado são rejeitados sem chamada externa.                                                      |
| AI-003 | Camada de IA: interface, adaptador Anthropic, timeout, limite de tokens, tratamento de erros                              | P0     | SEN-002, chave do provedor          | Troca de provedor exige só novo adaptador. Erro do provedor cai no fallback.                                                                   |
| AI-004 | Prompts versionados e contrato de saída em Zod, com referência obrigatória às evidências                                  | P0     | AI-003                              | Saída fora do schema é descartada. Afirmação sem `evidence_id` é removida.                                                                     |
| AI-005 | Fallback determinístico (texto montado a partir das regras)                                                               | P0     | AI-001                              | Ativo com a IA desligada. Resultado marcado com `ai_status = fallback`.                                                                        |
| AI-006 | Conjunto de URLs rotuladas: legítimas, suspeitas, com reputação, sem reputação, inválidas, com redirecionamento, privadas | P0     | AI-002                              | Conjunto versionado em `tests/fixtures/`, com rótulo e justificativa por item. Sem dados de terceiros sem autorização.                         |
| AI-007 | Testes de prompt injection com corpus de textos hostis                                                                    | P0     | AI-004                              | Resultado do motor não muda com nenhum texto do corpus. Teste no CI.                                                                           |
| AI-008 | Métricas: precisão, recall, falsos positivos e negativos, tempo de análise, taxa de falha de integrações                  | P0     | AI-006                              | Relatório gerado por execução real do conjunto. Números só entram na apresentação se vierem desse relatório.                                   |
| AI-009 | Testes de SSRF: host privado, metadados de nuvem, DNS que resolve para interno, redirecionamento                          | P0     | SEN-011                             | Todos recusados sem conexão de rede. Teste roda sem internet.                                                                                  |
| AI-010 | Analisador de texto para versão simplificada e versão técnica                                                             | P1     | AI-004                              | As duas versões usam os mesmos dados do motor.                                                                                                 |

---

## 6. Transversal — alertas, documentação e processo

| ID      | Tarefa                                                                                                        | Responsável                                 | Prior. | Depende de                  | Critério de aceitação (resumo)                                                        |
| ------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ------ | --------------------------- | ------------------------------------------------------------------------------------- |
| ALR-001 | Serviço Resend: envio com `idempotencyKey`, registro de status, retentativas (máx. 3)                         | Integrante 1                                | P0     | SEN-005, domínio verificado | E-mail real enviado a conta de teste. Duplo disparo do mesmo job gera um único envio. |
| ALR-002 | Templates HTML responsivos para alerta de nova ameaça                                                         | Integrante 3                                | P0     | ALR-001                     | Renderizado em cliente de e-mail de teste e em 375 px. Texto alternativo em imagens.  |
| ALR-003 | Gatilho: nova ameaça confirmada em categoria inscrita gera alerta                                             | Integrante 1                                | P0     | ALR-001, TI-006             | Usuário sem inscrição não recebe nada.                                                |
| ALR-004 | Preferências de notificação (`POST /alerts` altera inscrição)                                                 | Integrante 1                                | P1     | ALR-003                     | Conforme a decisão em `database.md` §1.                                               |
| INT-001 | Fluxo completo COLETAR → ANALISAR → CLASSIFICAR → EXPLICAR → ALERTAR, sem intervenção manual                  | Integrante 1 (coordena) e Integrante 4 (QA) | P0     | Todas as trilhas            | Roteiro de teste executado do início ao fim, com registro.                            |
| DOC-001 | README, CONTRIBUTING, LICENSE, `architecture.md`, `database.md`, `security.md`, `api.md`, `deployment.md`     | Integrante 1 (coordena)                     | P0     | Fases anteriores            | Passos de instalação testados por alguém que não escreveu o README.                   |
| DOC-002 | `docs/pitch.md` e roteiro do vídeo                                                                            | Todos                                       | P0     | INT-001                     | Números do pitch vêm dos relatórios de AI-008.                                        |
| PRC-001 | Registro de tarefas feitas com Devin em `docs/devin-log.md`: data, tarefa, link da sessão, resultado, revisor | Cada integrante que usar                    | P0     | Contínuo                    | Toda sessão tem linha no registro e PR com revisão humana.                            |
| PRC-002 | Board no GitHub Projects com colunas e prioridades                                                            | Integrante 1                                | P0     | SEN-001                     | Todas as Issues deste backlog criadas no board.                                       |

---

## 7. Corte de escopo

Se o prazo apertar, cortar nesta ordem (sem tocar nos P0 de segurança e no fluxo principal):

1. FE-012, FE-013, TI-009, SEN-012 (já são P2 ou P1).
2. AI-010, ALR-004, FE-005, FE-011.
3. TI-008, se não houver dados DEMO necessários para a apresentação.

Não cortar: SEN-006, SEN-007, SEN-010, SEN-011, AI-006, AI-007, AI-009, PRC-001.

---

## 8. Dependências entre trilhas

```
SEN-002 ──► TI-001, TI-002, TI-003, AI-003, SEN-008
SEN-004/005 ──► SEN-006 ──► SEN-007 ──► FE-010
TI-005 + AI-001 ──► AI-002 ──► FE-009
AI-001 ──► AI-005
TI-006 ──► ALR-003 ──► ALR-001
FE-002 ──► FE-003, FE-006, FE-008
INT-001 depende de todas as trilhas P0
```

O gargalo é a trilha de dados: SEN-004 e SEN-005 precisam sair até 06/11, senão o Threat Feed e o scanner atrasam juntos.
