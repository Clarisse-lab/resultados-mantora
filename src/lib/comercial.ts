import { sql } from "./db";
import { FUSO, type Filtros } from "./metricas";

export type Etapa = { chave: string; rotulo: string; ordem: number; estrutural: boolean };

export type CartaoLead = {
  id: string;
  criado_em: Date;
  nome: string | null;
  telefone: string | null;
  email: string | null;
  origem: string;
  categoria: string;
  campanha: string | null;
  ctwa: boolean;
  sdr: string | null;
  motivo_perda: string | null;
  observacao: string | null;
  manual: boolean;
  etapa: string; // etapa efetiva (venda/checkout vêm do dado real)
  valor: number | null; // valor da venda ou do checkout, quando houver
  produto: string | null;
};

export const MOTIVOS_PERDA = ["Sem orçamento", "Sem perfil", "Comprou concorrente", "Adiou a decisão", "Sem retorno / sumiu", "Outro"];

export const ETAPAS_PADRAO: Etapa[] = [
  { chave: "lead", rotulo: "Lead", ordem: 1, estrutural: true },
  { chave: "agendamento", rotulo: "Agendamento", ordem: 2, estrutural: false },
  { chave: "call", rotulo: "Call realizada", ordem: 3, estrutural: false },
  { chave: "checkout", rotulo: "Checkout", ordem: 4, estrutural: true },
  { chave: "venda", rotulo: "Venda", ordem: 5, estrutural: true },
];

export async function etapasDo(clienteId: string): Promise<Etapa[]> {
  const rows = await sql<Etapa[]>`
    select chave, rotulo, ordem, estrutural from pipeline_etapas where cliente_id = ${clienteId} order by ordem`;
  return rows.length ? rows : ETAPAS_PADRAO;
}

export async function criarEtapasPadrao(clienteId: string) {
  await sql`insert into pipeline_etapas ${sql(ETAPAS_PADRAO.map((e) => ({ cliente_id: clienteId, ...e })))} on conflict do nothing`;
}

/**
 * Leads do período com a etapa efetiva. Uma pessoa que comprou está em "Venda" e uma que
 * abriu checkout está em "Checkout", não importa onde o SDR a deixou.
 */
export async function pipeline(clienteId: string, f: Filtros, busca?: string): Promise<CartaoLead[]> {
  const termo = busca?.trim() ? `%${busca.trim().toLowerCase()}%` : null;
  return sql<CartaoLead[]>`
    with l as (
      select * from leads
      where cliente_id = ${clienteId}
        and (criado_em at time zone ${FUSO})::date between ${f.from}::date and ${f.to}::date
        ${f.categoria === "all" ? sql`` : sql`and categoria = ${f.categoria}`}
        ${termo ? sql`and (lower(coalesce(nome,'')) like ${termo} or coalesce(telefone,'') like ${termo}
                          or lower(coalesce(email,'')) like ${termo} or lower(coalesce(sdr,'')) like ${termo}
                          or lower(coalesce(utm_campaign,'')) like ${termo})` : sql``}
    ),
    v as (
      select distinct on (chave_pessoa(telefone, email, documento)) chave_pessoa(telefone, email, documento) as pessoa, valor, produto
      from vendas where cliente_id = ${clienteId} and status = 'aprovada'
        and chave_pessoa(telefone, email, documento) in (select chave_pessoa(telefone, email, null) from l)
      order by chave_pessoa(telefone, email, documento), aprovado_em desc
    ),
    c as (
      select distinct on (chave_pessoa(telefone, email, null)) chave_pessoa(telefone, email, null) as pessoa, valor, produto
      from checkouts where cliente_id = ${clienteId}
        and chave_pessoa(telefone, email, null) in (select chave_pessoa(telefone, email, null) from l)
      order by chave_pessoa(telefone, email, null), criado_em desc
    )
    select l.id, l.criado_em, l.nome, l.telefone, l.email, l.origem, l.categoria,
           regexp_replace(coalesce(l.utm_campaign, ''), '\\|\\s*\\d+\\s*$', '') as campanha,
           l.ctwaclid is not null as ctwa, l.sdr, l.motivo_perda, l.observacao, l.manual,
           case when v.pessoa is not null then 'venda' when c.pessoa is not null then 'checkout' else l.etapa end as etapa,
           coalesce(v.valor, c.valor)::float as valor, coalesce(v.produto, c.produto) as produto
    from l
    left join v on v.pessoa = chave_pessoa(l.telefone, l.email, null)
    left join c on c.pessoa = chave_pessoa(l.telefone, l.email, null)
    order by l.criado_em desc
    limit 5000`;
}

export async function sdrsDo(clienteId: string) {
  const rows = await sql<{ sdr: string }[]>`
    select distinct sdr from leads where cliente_id = ${clienteId} and sdr is not null and sdr <> '' order by 1 limit 50`;
  return rows.map((r) => r.sdr);
}
