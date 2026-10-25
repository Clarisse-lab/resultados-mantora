-- Configurações globais da Mantora (ex.: token da Meta usado por todos os clientes).
create table configuracoes (
  chave          text primary key,
  valor          jsonb not null,
  atualizado_em  timestamptz not null default now()
);
