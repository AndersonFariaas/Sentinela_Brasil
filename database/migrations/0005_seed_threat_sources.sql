-- 0005: fontes de inteligência reais, cadastradas com dados públicos.
-- Fontes que dependem de chave (URLhaus, CERT.br via Firecrawl) entram inativas
-- e só são ativadas depois que a chave estiver configurada.
-- A confiabilidade é uma proposta do time (1 a 5), documentada em docs/security.md.

insert into public.sources (name, source_type, base_url, description, reliability, terms_url, is_active)
values
  (
    'CISA KEV',
    'feed_json',
    'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json',
    'Catálogo de vulnerabilidades exploradas conhecidas, publicado pela CISA (governo dos EUA).',
    5,
    'https://www.cisa.gov/known-exploited-vulnerabilities-catalog',
    true
  ),
  (
    'URLhaus',
    'api',
    'https://urlhaus-api.abuse.ch/',
    'URLs que distribuem malware, mantidas pelo abuse.ch. Exige Auth-Key gratuita.',
    4,
    'https://urlhaus.abuse.ch/api/',
    false
  ),
  (
    'CERT.br',
    'html',
    'https://www.cert.br/',
    'Alertas e notícias do CERT.br (NIC.br), coletados via Firecrawl. Exige chave da Firecrawl.',
    5,
    'https://www.cert.br/',
    false
  )
on conflict (name) do nothing;
