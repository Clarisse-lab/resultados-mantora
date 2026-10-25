-- Sincronização da Meta em segundo plano e uma conta de anúncio por cliente.
alter table integracoes add column sincronizando_desde timestamptz;

-- Remove conexões repetidas da mesma conta no mesmo cliente (fica a mais antiga)
delete from integracoes a using integracoes b
where a.tipo = 'meta_ads' and b.tipo = 'meta_ads' and a.cliente_id = b.cliente_id
  and a.conta_id = b.conta_id and a.criado_em > b.criado_em;

create unique index integracoes_meta_conta on integracoes (cliente_id, conta_id) where tipo = 'meta_ads';
