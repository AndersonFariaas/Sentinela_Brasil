# SENTINELA — Publicação gratuita

**Status:** guia para a primeira publicação (Fase 10).
**Custo:** R$ 0 com os planos gratuitos. Ver as ressalvas no fim.

## Arquitetura publicada

| Parte              | Onde roda                                  | Arquivo de configuração        |
| ------------------ | ------------------------------------------ | ------------------------------ |
| Interface (Vue)    | Vercel (plano Hobby)                       | `frontend/vercel.json`         |
| API (Fastify)      | Render (plano Free)                        | `render.yaml`                  |
| Coleta e alertas   | GitHub Actions, agendado todo dia às 03:00 | `.github/workflows/coleta.yml` |
| Banco, login e RLS | Supabase                                   | `database/migrations/`         |

A chave `service_role` só existe no GitHub Actions (coleta) e nunca no Render nem na Vercel. A API usa só a chave anônima e o token de cada usuário.

## Ordem de execução

A ordem importa, porque cada serviço precisa da URL do anterior.

### 1. Render: API

1. Painel do Render, **New > Blueprint**, e aponte para este repositório. O Render lê `render.yaml`.
2. Ele pede os valores marcados com `sync: false`. Preencha:
   - `SUPABASE_URL` e `SUPABASE_ANON_KEY`: do painel do Supabase, em _Project Settings > API_.
   - `CORS_ORIGIN`: deixe em branco por enquanto. Você preenche no passo 3.
   - `ANTHROPIC_API_KEY`: opcional. Sem ela, a explicação usa só as regras.
3. Ao terminar o deploy, anote a URL pública (algo como `https://sentinela-api.onrender.com`).
4. Teste: `https://sentinela-api.onrender.com/api/v1/health` deve responder `{"status":"ok"}`.

### 2. Supabase: endereços permitidos

1. Painel do Supabase, _Authentication > URL Configuration_.
2. **Site URL:** a URL da Vercel, que você ainda não tem. Volte aqui no passo 4.
3. **Redirect URLs:** inclua a URL da Vercel, seguida de `/**`.

### 3. Vercel: interface

1. Painel da Vercel, **Add New > Project**, e importe o repositório.
2. Em _Root Directory_, escolha `frontend`. O Vercel detecta Vite sozinho.
3. Em _Environment Variables_, adicione (são públicas por definição, por isso o prefixo `VITE_`):
   - `VITE_API_URL`: a URL do Render, do passo 1.
   - `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`: os mesmos valores do Supabase.
4. Clique em **Deploy** e anote a URL (algo como `https://sentinela.vercel.app`).

### 4. Fechar o ciclo

1. No **Render**, em `CORS_ORIGIN`, coloque a URL da Vercel e salve. O serviço reinicia.
2. No **Supabase**, coloque a URL da Vercel em _Site URL_ (passo 2).
3. No **Render**, adicione `URL_PUBLICA_API` com a URL do Render. Ela aparece no link de cancelamento dos e-mails. Essa variável também precisa estar no GitHub (passo 5).

### 5. GitHub: coleta agendada

Em _Settings > Secrets and variables > Actions_, crie estes segredos:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY` (opcional, sem ela os alertas ficam desligados)
- `ALERTA_REMETENTE` (opcional)
- `URL_PUBLICA_API`: a URL do Render

Para testar sem esperar a madrugada: _Actions > Coleta e alertas > Run workflow_.

## Como conferir

- [ ] `https://<render>/api/v1/health` responde `ok`.
- [ ] Abrir a Vercel, criar conta e confirmar o e-mail.
- [ ] Entrar e analisar uma URL. O resultado aparece com classificação e pontuação.
- [ ] Histórico lista a análise e a exclusão funciona.
- [ ] Em _Actions_, a execução da coleta fica verde.
- [ ] Cabeçalhos da Vercel presentes: abra o site, F12, aba _Rede_, e veja `Content-Security-Policy` no documento.

## Ressalvas dos planos gratuitos

- **Render dorme após 15 minutos sem acesso.** A primeira requisição depois disso leva cerca de um minuto. Abra a API antes de uma demonstração.
- **Vercel Hobby é só para uso não comercial.** Se o projeto gerar receita, é preciso o plano Pro.
- **E-mail:** o remetente padrão da Resend só entrega para o dono da conta. Para outros destinatários, é preciso um domínio verificado (D-E).
- **Limite de requisições por IP** (`@fastify/rate-limit`) fica em memória do processo. No Render Free, com um processo só, funciona. Se a API escalar para várias instâncias, o limite precisa ir para um armazenamento compartilhado.

## Antes de tornar o repositório público

O repositório já está público. A varredura de segredos no histórico completo (SEN-014) precisa ser feita antes de publicar o site, e um segredo achado no histórico se resolve rotacionando a chave, não só apagando o arquivo.

## Rotação de chaves

Troque uma chave quando ela aparecer onde não deveria (chat, log, print, commit), quando alguém que a conhecia sair do projeto, ou depois de uma varredura que achar um segredo. Sem suspeita, faça uma troca preventiva a cada seis meses.

| Chave                       | Onde fica                          | Trocar em                                  |
| --------------------------- | ---------------------------------- | ------------------------------------------ |
| `SUPABASE_SERVICE_ROLE_KEY` | GitHub Actions (coleta e retenção) | Supabase > API Keys. Não existe no Render. |
| `SUPABASE_ANON_KEY`         | Render                             | Supabase > API Keys                        |
| `VITE_SUPABASE_ANON_KEY`    | Vercel                             | Supabase > API Keys                        |
| `RESEND_API_KEY`            | GitHub Actions                     | Resend > API Keys                          |
| `ANTHROPIC_API_KEY`         | Render (opcional)                  | Console da Anthropic                       |

Passos, na mesma ordem para cada chave:

1. Gere a nova chave no painel do fornecedor.
2. Atualize o valor em **todos** os lugares da tabela (Render, Vercel e GitHub, conforme a coluna "Onde fica").
3. Refaça o deploy: Render (**Manual Deploy**) e Vercel (**Redeploy**). Para o GitHub, a próxima execução já usa o novo segredo.
4. Confira: o `health` do Render responde `ok`, o login funciona no site e a coleta roda verde.
5. Só então revogue a chave antiga no painel do fornecedor. Revogar antes do passo 4 derruba o site.

Nunca cole chaves em issues, PRs, chats ou logs. A `SUPABASE_SERVICE_ROLE_KEY` dá acesso total ao banco: se ela vazar, troque primeiro e investigue depois.

## Reverter

- **Render:** em _Deploys_, escolha um deploy anterior e clique em _Rollback_.
- **Vercel:** em _Deployments_, promova um deploy anterior.
- **Supabase:** migrações não são revertidas automaticamente. Qualquer mudança no banco exige confirmação antes de ser aplicada.
