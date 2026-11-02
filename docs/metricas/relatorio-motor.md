# Métricas do motor de risco

> Gerado por `npm run metricas` (pasta backend). Não edite à mão: rode de novo para atualizar.

## Como ler

- **Conjunto:** 62 URLs rotuladas (fixture versão 1.0.0), em `backend/tests/fixtures/urls-rotuladas.json`.
- **Motor:** `risk-rules.json` versão 1.0.0.
- **Reputação:** sintética, declarada em cada caso. Os números medem as regras do motor, não a qualidade de fontes reais.
- **Integrações:** a taxa de falha de Firecrawl, URLhaus e IA **não foi medida**. Esta execução roda sem rede e sem chaves.
- **Tempo:** medido nesta máquina, sem rede. Serve para comparar execuções, não como promessa de desempenho.
- **Ambiente:** Node v24.21.0, win32.

## Validação (recusas)

| Medida | Valor |
| --- | --- |
| Recusadas corretamente | 18 |
| Recusadas indevidamente (deviam ser analisadas) | 0 |
| Aceitas indevidamente (deviam ser recusadas) | 0 |
| Recusadas com motivo diferente do esperado | 0 |

## Classificação (URLs analisadas)

Analisadas: 44. Positivo = classificação `suspeito` ou `confirmado`.

| Medida | Valor |
| --- | --- |
| Verdadeiros positivos | 12 |
| Falsos positivos | 2 |
| Verdadeiros negativos | 20 |
| Falsos negativos | 10 |
| Precisão | 85.7% |
| Recall | 54.5% |
| Taxa de falsos positivos | 9.1% |
| Acurácia | 72.7% |
| Tempo mediano por análise | 0.04 ms |
| Tempo máximo por análise | 4.08 ms |

## Erros por caso

- **Falsos positivos:** `R07`, `R12`
- **Falsos negativos:** `S02`, `S03`, `S04`, `S06`, `S08`, `S12`, `D01`, `D02`, `D05`, `D06`
- **Aceitas indevidamente:** nenhum

## Por categoria

| Categoria | Casos | Recusados | Marcados como suspeitos ou confirmados |
| --- | --- | --- | --- |
| legitima | 12 | 0 | 0 |
| suspeita_estrutural | 12 | 0 | 2 |
| reputacao | 12 | 0 | 12 |
| redirecionamento | 8 | 0 | 0 |
| invalida | 8 | 8 | 0 |
| privada | 10 | 10 | 0 |

## Limites

- O conjunto é pequeno e foi feito por uma pessoa. Serve para regressão e para discutir o motor, não para afirmar eficácia em produção.
- Os rótulos são julgamento de analista, escritos antes desta execução. Podem ser discutidos.
- Falsos negativos são sinais que o motor não pontua. Por exemplo, uma palavra de isca sozinha não chega ao limiar de suspeito. Mudar isso exige decidir o peso das regras, o que não é feito aqui.
