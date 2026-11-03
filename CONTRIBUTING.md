# Como contribuir com o SENTINELA

Obrigado pelo interesse. Este guia cobre o fluxo de trabalho. Para instalar e rodar o projeto, veja o [README](README.md).

## Antes de começar

- Leia [docs/security.md](docs/security.md). Ele define o modelo de ameaças e as regras que o código precisa cumprir, como SSRF, RLS e tratamento de conteúdo não confiável.
- Para mudanças grandes, abra uma issue ou converse antes. Assim evitamos retrabalho.

## Branches

Use um prefixo que diga o tipo da mudança:

| Prefixo  | Uso                                    |
| -------- | -------------------------------------- |
| `feat/`  | Funcionalidade nova                    |
| `fix/`   | Correção de erro                       |
| `chore/` | Manutenção, configuração, dependências |
| `docs/`  | Só documentação                        |

Exemplo: `feat/alertas-por-categoria`. Qualquer branch que vá para `main` por PR passa pela CI.

## Commits

Seguimos o [Conventional Commits](https://www.conventionalcommits.org/pt-br/v1.0.0/). A primeira linha diz o tipo e o que mudou, e o corpo explica **por quê**. Formato de exemplo:

```
fix: corrige a página inicial do histórico ao trocar de filtro

A paginação continuava na página anterior, então o usuário via
itens de outro filtro. Agora a página volta para 1 ao mudar o filtro.
```

Tipos usados: `feat`, `fix`, `refactor`, `test`, `docs`, `style`, `chore`, `ci`.

## Pull requests

1. Abra o PR contra `main`, com a descrição do problema e da solução.
2. Rode localmente as verificações abaixo. A CI roda as mesmas e precisa ficar verde.
3. Mudanças de comportamento precisam de teste. Lógica de regra de negócio, permissão e cálculo é obrigatória.
4. Mudanças no banco (migrações) são revisadas por uma pessoa antes de aplicar. Nunca aplique em produção sem essa revisão.

### Verificações

```bash
npm run format:check   # Prettier na raiz
npm run lint           # ESLint nos dois projetos
npm run typecheck      # TypeScript nos dois projetos
npm test               # Vitest nos dois projetos
npm run build          # Build de produção nos dois projetos
```

## Regras de segurança

- **Segredos nunca entram no repositório.** O `.env` fica fora do git, e o `.env.example` lista só os nomes das variáveis, sem valores. Se um segredo vazar, troque-o imediatamente. Apagar o arquivo não basta, porque ele continua no histórico.
- **`service_role` só existe no back-end**, e só nos jobs que precisam dela (coleta e retenção). Nunca use essa chave no front-end ou nas rotas públicas.
- **Variáveis `VITE_*` são públicas.** Nunca coloque segredo nelas.
- **Conteúdo de fontes externas não é confiável.** Nada que venha de uma página ou de um feed pode virar instrução para a IA nem ser renderizado sem sanitização.
- **Validação na fronteira.** Entrada de usuário, resposta de API externa e linha de banco passam por um esquema (Zod) antes de serem usadas.

## Estilo

- O projeto usa Prettier e ESLint. Rode o formatador antes de commitar.
- Comentários explicam o **porquê**. Código que só repete o nome da função não precisa de comentário.
- Front-end mobile-first. Teste em 375 px antes de pedir revisão de interface.
- Textos para o usuário ficam em português (Brasil), e os nomes de código seguem o padrão já existente no módulo.

## Dúvidas

Abra uma issue com o contexto, o que você tentou e a saída do erro.
