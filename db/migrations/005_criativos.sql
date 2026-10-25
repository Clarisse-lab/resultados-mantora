-- Cache dos criativos da Meta (imagem, texto, status, link); os links de imagem da Meta expiram.
create table criativos (
  cliente_id    uuid not null references clientes(id) on delete cascade,
  objeto_id     text not null,
  dados         jsonb not null,
  atualizado_em timestamptz not null default now(),
  primary key (cliente_id, objeto_id)
);
