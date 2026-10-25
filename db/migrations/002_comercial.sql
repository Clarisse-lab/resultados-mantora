-- Comercial: pipeline de leads (Kanban) e carteira de ascensão (clientes que já compraram).

-- Etapas do pipeline por cliente. "checkout" e "venda" são estruturais: vêm do dado real
-- (o lead tem checkout ou venda com o mesmo telefone/e-mail) e não podem ser removidas.
create table pipeline_etapas (
  cliente_id  uuid not null references clientes(id) on delete cascade,
  chave       text not null check (chave ~ '^[a-z0-9_]{1,30}$'),
  rotulo      text not null,
  ordem       int not null,
  estrutural  boolean not null default false,
  primary key (cliente_id, chave)
);

alter table leads
  add column etapa         text not null default 'lead',
  add column sdr           text,
  add column motivo_perda  text,
  add column observacao    text,
  add column manual        boolean not null default false,
  add column movido_em     timestamptz;

create index on leads (cliente_id, email);

-- Chave da pessoa: telefone normalizado, senão e-mail, senão documento.
-- Usada para juntar lead, checkout e venda da mesma pessoa e para o LTV.
create or replace function chave_pessoa(telefone text, email text, documento text)
returns text language sql immutable as $$
  select coalesce(nullif(telefone, ''), nullif(lower(email), ''), nullif(documento, ''))
$$;

create index vendas_pessoa on vendas (cliente_id, chave_pessoa(telefone, email, documento));
create index checkouts_pessoa on checkouts (cliente_id, chave_pessoa(telefone, email, null));

-- Estado da abordagem de cada cliente na carteira de ascensão.
create table ascensao_status (
  cliente_id     uuid not null references clientes(id) on delete cascade,
  pessoa         text not null,
  etapa          text not null default 'fila' check (etapa in ('fila', 'contato', 'proposta', 'recomprou', 'sem_interesse')),
  responsavel    text,
  observacao     text,
  atualizado_em  timestamptz not null default now(),
  primary key (cliente_id, pessoa)
);

-- Etapas padrão para clientes que já existem; novos clientes recebem as mesmas pela aplicação.
insert into pipeline_etapas (cliente_id, chave, rotulo, ordem, estrutural)
select c.id, e.chave, e.rotulo, e.ordem, e.estrutural
from clientes c
cross join (values
  ('lead', 'Lead', 1, true),
  ('agendamento', 'Agendamento', 2, false),
  ('call', 'Call realizada', 3, false),
  ('checkout', 'Checkout', 4, true),
  ('venda', 'Venda', 5, true)
) as e(chave, rotulo, ordem, estrutural)
on conflict do nothing;
