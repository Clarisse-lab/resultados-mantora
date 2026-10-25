-- Esquema inicial da plataforma de resultados.
-- Multi-cliente: toda tabela de dados carrega cliente_id e toda consulta filtra por ele.

create extension if not exists pgcrypto;

create table clientes (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  slug        text not null unique,
  -- palavras que identificam campanhas de lançamento; o resto é perpétuo
  palavras_lancamento text[] not null default '{}',
  criado_em   timestamptz not null default now()
);

-- papel 'equipe' vê todos os clientes; 'cliente' só os vinculados em usuarios_clientes
create table usuarios (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique,
  nome        text,
  senha_hash  text not null,
  papel       text not null check (papel in ('equipe', 'cliente')),
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now()
);

create table usuarios_clientes (
  usuario_id  uuid not null references usuarios(id) on delete cascade,
  cliente_id  uuid not null references clientes(id) on delete cascade,
  primary key (usuario_id, cliente_id)
);

-- Uma linha por conexão: plataforma de venda, conta de anúncio ou formulário de leads.
-- O token entra na URL do webhook e identifica cliente + integração.
create table integracoes (
  id          uuid primary key default gen_random_uuid(),
  cliente_id  uuid not null references clientes(id) on delete cascade,
  tipo        text not null check (tipo in ('hotmart', 'kiwify', 'pagtrust', 'meta_ads', 'captura_leads')),
  nome        text not null,
  token       text not null unique default encode(gen_random_bytes(18), 'hex'),
  -- hotmart: hottok · kiwify: token de assinatura · meta_ads: access token
  segredo     text,
  -- meta_ads: id da conta de anúncio (sem "act_")
  conta_id    text,
  ativo       boolean not null default true,
  ultimo_evento_em timestamptz,
  ultima_sync_em   timestamptz,
  ultimo_erro      text,
  criado_em   timestamptz not null default now()
);
create index on integracoes (cliente_id);

-- Tudo que chega por webhook fica guardado cru, para reprocessar e auditar.
create table eventos_webhook (
  id             bigserial primary key,
  integracao_id  uuid not null references integracoes(id) on delete cascade,
  recebido_em    timestamptz not null default now(),
  tipo_evento    text,
  payload        jsonb not null,
  processado     boolean not null default false,
  erro           text
);
create index on eventos_webhook (integracao_id, recebido_em desc);

-- Campos de atribuição repetidos em leads, checkouts e vendas.
-- categoria: pago | organico | nao-definido
create table leads (
  id            uuid primary key default gen_random_uuid(),
  cliente_id    uuid not null references clientes(id) on delete cascade,
  integracao_id uuid references integracoes(id) on delete set null,
  criado_em     timestamptz not null default now(),
  nome          text,
  email         text,
  telefone      text,
  uf            text,
  cidade        text,
  pagina        text,
  utm_source    text, utm_medium text, utm_campaign text, utm_content text, utm_term text,
  campanha_id   text, conjunto_id text, anuncio_id text,
  ctwaclid      text,
  categoria     text not null default 'nao-definido',
  origem        text not null default 'Não definido'
);
create index on leads (cliente_id, criado_em);
create index on leads (cliente_id, telefone);

create table checkouts (
  id            uuid primary key default gen_random_uuid(),
  cliente_id    uuid not null references clientes(id) on delete cascade,
  integracao_id uuid references integracoes(id) on delete set null,
  provedor      text not null,
  id_externo    text not null,
  criado_em     timestamptz not null,
  nome          text, email text, telefone text, uf text, cidade text,
  produto       text,
  valor         numeric(12,2),
  utm_source    text, utm_medium text, utm_campaign text, utm_content text, utm_term text,
  campanha_id   text, conjunto_id text, anuncio_id text,
  categoria     text not null default 'nao-definido',
  origem        text not null default 'Não definido',
  unique (cliente_id, provedor, id_externo)
);
create index on checkouts (cliente_id, criado_em);

-- status normalizado: aprovada | reembolsada | chargeback | cancelada | pendente | recusada
create table vendas (
  id            uuid primary key default gen_random_uuid(),
  cliente_id    uuid not null references clientes(id) on delete cascade,
  integracao_id uuid references integracoes(id) on delete set null,
  provedor      text not null,
  id_externo    text not null,
  criado_em     timestamptz not null,
  aprovado_em   timestamptz,
  status        text not null,
  status_bruto  text,
  nome          text, email text, telefone text, documento text,
  uf            text, cidade text,
  produto       text,
  produto_id    text,
  valor         numeric(12,2) not null default 0,
  moeda         text not null default 'BRL',
  metodo        text,
  utm_source    text, utm_medium text, utm_campaign text, utm_content text, utm_term text,
  src           text, sck text,
  campanha_id   text, conjunto_id text, anuncio_id text,
  ctwaclid      text,
  categoria     text not null default 'nao-definido',
  origem        text not null default 'Não definido',
  contexto      text not null default 'perpetuo' check (contexto in ('perpetuo', 'lancamento')),
  atualizado_em timestamptz not null default now(),
  unique (cliente_id, provedor, id_externo)
);
create index on vendas (cliente_id, aprovado_em);
create index on vendas (cliente_id, status);

-- Mídia por anúncio e por dia (Meta Ads Insights, level=ad, time_increment=1).
create table midia_diaria (
  cliente_id     uuid not null references clientes(id) on delete cascade,
  plataforma     text not null default 'meta',
  data           date not null,
  conta_id       text not null,
  campanha_id    text not null, campanha_nome text,
  conjunto_id    text not null, conjunto_nome text,
  anuncio_id     text not null, anuncio_nome text,
  investido      numeric(12,2) not null default 0,
  impressoes     bigint not null default 0,
  cliques        bigint not null default 0,
  page_views     bigint not null default 0,
  leads_plataforma bigint not null default 0,
  contexto       text not null default 'perpetuo',
  atualizado_em  timestamptz not null default now(),
  primary key (cliente_id, plataforma, data, anuncio_id)
);
create index on midia_diaria (cliente_id, data);

-- Meta mensal por KPI (faturamento, vendas, leads, investido...).
create table metas (
  cliente_id  uuid not null references clientes(id) on delete cascade,
  mes         date not null check (extract(day from mes) = 1),
  kpi         text not null,
  valor       numeric(14,2) not null,
  primary key (cliente_id, mes, kpi)
);
