# SENTINELA — Roadmap, corte de escopo e decisões pendentes

**Status:** proposta para aprovação (Fase 0).
**Data:** 31/10/2026
**Escrito para:** o time de quatro integrantes e quem vai aprovar o escopo.

---

## 1. Diagnóstico

O escopo original tem 11 fases e 12 páginas. O prazo do Hack Brasil informado no documento vai de 04/11 a 30/11/2026: são cerca de 27 dias úteis para quatro pessoas, com a integração ainda por fazer.

**Conclusão:** o escopo completo não cabe no prazo. O plano abaixo mantém o fluxo principal e corta o que é secundário, na ordem que o próprio documento recomenda (seção 15: "reduzir funcionalidades secundárias antes de comprometer o fluxo principal").

---

## 2. Cronograma com gates

Cada gate é uma condição objetiva. Se não passar, o bloco seguinte começa com o corte da seção 4 aplicado.

| Período | Entregas | Gate (condição para avançar) |
|---|---|---|
| 31/10 – 03/11 | Fase 0 aprovada (este conjunto de documentos). Decisões da seção 5 fechadas. Contas criadas (abuse.ch, Firecrawl, Resend, provedor de IA, Supabase). | **G0:** decisões D1–D6 respondidas. Repositório criado. |
| 04/11 – 08/11 | Fase 1 (scaffold, CI) e Fase 2 (Supabase, migrations, Auth, RLS). | **G1:** CI verde. Login funciona. Teste SEN-007 passa (isolamento entre dois usuários). |
| 09/11 – 13/11 | Threat Intelligence: CISA KEV, URLhaus, CERT.br via Firecrawl. Threat Feed e Threat Details. | **G2:** Threat Feed com dados reais de pelo menos duas fontes, cada registro com `source_url`. |
| 14/11 – 18/11 | Scanner (pipeline + motor de risco), resultados na interface, IA com fallback. | **G3:** URL enviada gera classificação e pontuação reproduzíveis. IA ligada ou em fallback, sempre com resultado visível. |
| 19/11 – 23/11 | Alertas via Resend, integração completa frontend–back-end, histórico. | **G4:** alerta real chega a uma conta de teste. Duplo disparo testado. |
| 24/11 – 26/11 | Segurança (SSRF, injeção, RLS, dependências), conjunto de URLs rotuladas, métricas. | **G5:** nenhuma falha crítica aberta. Métricas geradas por execução real. |
| 26/11 (noite) | **Congelamento de código.** A partir daqui, só correção. | — |
| 27/11 – 30/11 | Documentação final, deploy de produção, vídeo, pitch, ensaio. Submissão. | **G6:** produto publicado e demonstração ensaiada do início ao fim. |

Ajuste em relação ao cronograma original: o congelamento de código em 26/11 (e não em 30/11) deixa três dias para deploy, documentação e vídeo, que costumam estourar.

---

## 3. Escopo do MVP

### Essencial (P0)

- Autenticação, RLS testado e perfis.
- Threat Feed com CISA KEV e URLhaus. CERT.br via Firecrawl, com escopo mínimo (uma página de listagem e as páginas de detalhe necessárias).
- Scanner de URL: validação, normalização, heurísticas, consulta de reputação, motor de risco determinístico.
- Resultado do scanner com classificação, pontuação, evidências, fontes consultadas e justificativa.
- AI Security Analyst: explicação via provedor, com fallback obrigatório.
- Histórico de análises com exclusão pelo usuário.
- Alerta de nova ameaça por e-mail (Resend), com idempotência.
- Telas: Login, Cadastro, Dashboard (com dados DEMO sinalizados quando necessário), Threat Feed, Threat Details, Phishing Detector, Scan Results, History.

### Desejável (P1)

- Telas Alerts e Settings (inscrições).
- Documentação OpenAPI gerada a partir dos schemas.
- Versão técnica e simplificada da explicação.

### Fora do MVP (P2)

- Inspeção ativa de URL (requisição ao site analisado). Exige ambiente isolado. Só entra depois do MVP, com os requisitos de `security.md` §3.
- Relatórios em PDF. A exportação em JSON e a impressão da tela de resultado atendem ao requisito.
- Tela separada do AI Analyst. A explicação já aparece no resultado.
- Supabase Storage. Nenhum fluxo do MVP precisa de arquivos.
- Fontes brasileiras adicionais além do CERT.br, até os termos de uso serem revisados.
- MFA.
- Testes E2E com cobertura ampla. Fica um roteiro de fluxo completo (INT-001) executado manualmente e registrado.

**Observação sobre as 12 páginas:** o escopo pede 12. Com o corte acima, o essencial são 8 telas (Login, Cadastro, Dashboard, Threat Intelligence, Threat Details, Phishing Detector, Scan Results e History). Alerts e Settings entram como desejáveis. AI Security Analyst e Reports ficam dentro da tela de resultado.

---

## 4. Corte, na ordem

Usar esta lista só se um gate atrasar mais de um dia.

1. Remover P2 que ainda estiver em andamento.
2. Remover P1: FE-005, FE-011, ALR-004, SEN-012, AI-010.
3. Reduzir o CERT.br para uma única página de listagem. Se o Firecrawl não estiver estável até o G2, manter só KEV e URLhaus e documentar a limitação.
4. Reduzir o conjunto de URLs rotuladas para o mínimo estatístico (ex.: 60 URLs, sem inventar números).

**Nunca cortar:** RLS e testes de isolamento, SSRF e lista de saída, prompt injection, fallback da IA, rastreabilidade (`source_url`, `algorithm_version`), registro dos Devin, CI sem desligamentos.

---

## 5. Decisões pendentes, com recomendação

Cada decisão tem a recomendação que eu faria. Responda o que mudar e eu ajusto os documentos.

| # | Decisão | Recomendação | Quando precisa |
|---|---|---|---|
| **D-A** | **Regulamento oficial do Hack Brasil 2026.** A busca que fiz não encontrou página oficial da competição (os resultados foram do Hack in Cariri). Preciso do link ou do PDF do regulamento para confirmar as ferramentas exigidas, o formato de submissão e a exigência de repositório público. | Enviar o link oficial. Até lá, tratar as exigências do documento de build como premissas, não como regras confirmadas. | Até 10/11 (bloqueia a Fase 11, não o desenvolvimento). |
| **D-B** | Nome e papel de cada integrante | Preencher em `backlog.md` assim que o time fechar. Até lá, mantemos as funções. | Até G1. |
| **D-C** | Hospedagem do back-end | Container Node no **Render** ou **Railway** (um dos dois). Frontend na Vercel. O back-end precisa de jobs agendados e de controle de saída de rede, que não funcionam bem em funções serverless. | Até G1 (deploy de teste). |
| **D-D** | Provedor de IA | **Anthropic.** Haiku 5.5 para a explicação curta (menor custo) e Sonnet 5.5 se a qualidade pedir. A camada é independente, então trocar depois custa pouco. | Até G3. |
| **D-E** | Domínio próprio para envio de e-mail | Registrar um domínio para a Resend. Sem domínio verificado, o envio fica limitado (confirmar o limite na documentação da Resend antes do G4). | Até 13/11. |
| **D-F** | Licença do repositório (obrigatória se o repositório for público) | **MIT**, para facilitar avaliação e reuso. Se preferir proteção maior, **AGPL-3.0** é a alternativa, mas exige mais atenção a quem reutilizar. | Antes de tornar público (SEN-014). |
| **D-G** | Versão do TypeScript | **Testar TypeScript 7.0.2** na Fase 1. Se `vue-tsc` ou `typescript-eslint` não funcionarem, fixar a linha 5.x estável. Não vou escolher a 7 sem testar. | Fase 1 (G1). |
| **D-H** | Retenção de dados (`database.md` §6): 180 dias para scans e alertas, 90 para execuções de coleta, 365 para auditoria | Aceitar os valores propostos. | Até G2. |
| **D-I** | Conta da abuse.ch (Auth-Key do URLhaus) | Criar com o e-mail do projeto, não com conta pessoal, para facilitar a troca de responsável. | Até 04/11 (TI-002 depende disso). |
| **D-J** | Corte de escopo da seção 3 | Aprovar o P0 como está. É a única forma de chegar ao G5 com segurança. | Agora. |
| **D-K** | Fluxo do Devin | Você usa o Devin para tarefas delimitadas (uma Issue por sessão) e registra cada sessão em `docs/devin-log.md`. Preciso saber se a conta é de organização (a API de sessões exige `org_id`) ou pessoal. | Até G1. |

---

## 6. Riscos de prazo

| Risco | Efeito | Sinal de alerta | Resposta |
|---|---|---|---|
| Migrations e RLS levarem mais que 5 dias | Atrasa G1, G2 e G3 juntos | G1 não passou até 07/11 | Congelar Threat Feed na lista de P0 mínima (só KEV) |
| Firecrawl ou CERT.br instável | G2 não passa | Mais de três falhas em uma semana de testes | Remover CERT.br, documentar, seguir com KEV e URLhaus |
| Chave da Resend sem domínio | Alerta só para o e-mail da conta | Teste com outro destinatário falha | Registrar limitação; demonstrar com e-mail da conta |
| Provedor de IA fora do ar na demo | Explicação indisponível | Erro na semana do ensaio | Fallback já é requisito; a demo mostra o resultado com `ai_status = fallback` |
| Deploy em produção atrasa | Demo sem URL pública | Deploy de teste não funciona até 25/11 | Ter o ambiente de demo local gravado em vídeo como plano B |
| Métricas não executadas | Pitch com número sem origem | Relatório de AI-008 ausente | Não usar número na apresentação sem o relatório |

---

## 7. Próximos passos (depois da aprovação)

1. Você responde D-A a D-K (as que puder agora).
2. Eu crio a pasta `sentinela-brasil/` com `README.md` mínimo, `.gitignore` e `.env.example` vazio (sem chaves).
3. Criamos o repositório no GitHub (`AndersonFariaas`), com `main` protegida, **depois da sua confirmação**, porque é uma ação pública e difícil de desfazer.
4. Fase 1: scaffold do frontend e do back-end, CI e primeiro build.

---

## 8. O que não foi verificado nesta fase

- Regras e formato de submissão do Hack Brasil 2026 (D-A).
- Limites de créditos e de uso das contas Firecrawl, Resend e provedor de IA. Dependem do plano de cada conta.
- Termos de uso do CERT.br e da CISA para uso comercial ou de redistribuição. A CISA publica o KEV como dado público. Os termos do CERT.br precisam de leitura direta antes do G2.
- Requisitos de Node dos pacotes na versão escolhida. Conferir na Fase 1.
- Janela de validade da chave de idempotência da Resend. Conferir antes do G4.

Os valores de versão em `architecture.md` foram consultados no npm em 31/10/2026. Nenhum pacote foi instalado nem testado ainda.
