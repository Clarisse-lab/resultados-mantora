import { sql } from "./db";

// Carteira de ascensão: todo mundo que já comprou, com um score para priorizar a abordagem
// de renovação/upgrade. O score é RFM: valor gasto (45%), nº de compras (25%) e recência (30%),
// cada um como percentil dentro da base do próprio cliente.

import type { EtapaAscensao } from "./ascensao-etapas";

export type ClienteAscensao = {
  pessoa: string;
  nome: string | null;
  telefone: string | null;
  email: string | null;
  ltv: number;
  compras: number;
  primeira: Date;
  ultima: Date;
  dias_desde: number;
  ultimo_produto: string | null;
  score: number;
  prioridade: "alta" | "media" | "baixa";
  etapa: EtapaAscensao;
  responsavel: string | null;
  observacao: string | null;
};

export async function carteira(clienteId: string, busca?: string): Promise<ClienteAscensao[]> {
  const termo = busca?.trim() ? `%${busca.trim().toLowerCase()}%` : null;
  return sql<ClienteAscensao[]>`
    with p as (
      select chave_pessoa(telefone, email, documento) as pessoa,
             (array_agg(nome order by aprovado_em desc))[1] as nome,
             max(telefone) as telefone, max(email) as email,
             sum(valor)::float as ltv, count(*)::int as compras,
             min(aprovado_em) as primeira, max(aprovado_em) as ultima,
             (array_agg(produto order by aprovado_em desc))[1] as ultimo_produto
      from vendas
      where cliente_id = ${clienteId} and status = 'aprovada' and chave_pessoa(telefone, email, documento) is not null
      group by 1
    ),
    s as (
      select *,
        round((100 * (0.45 * percent_rank() over (order by ltv)
                    + 0.25 * percent_rank() over (order by compras)
                    + 0.30 * percent_rank() over (order by ultima)))::numeric, 1)::float as score
      from p
    )
    select s.pessoa, s.nome, s.telefone, s.email, s.ltv, s.compras, s.primeira, s.ultima,
           extract(day from now() - s.ultima)::int as dias_desde, s.ultimo_produto, s.score,
           case when s.score >= 70 then 'alta' when s.score >= 40 then 'media' else 'baixa' end as prioridade,
           -- Quem estava em abordagem e comprou depois disso conta como "recomprou" automaticamente
           case when a.etapa in ('contato', 'proposta', 'fila') and a.atualizado_em is not null and s.ultima > a.atualizado_em
                then 'recomprou' else coalesce(a.etapa, 'fila') end as etapa,
           a.responsavel, a.observacao
    from s left join ascensao_status a on a.cliente_id = ${clienteId} and a.pessoa = s.pessoa
    ${termo ? sql`where lower(coalesce(s.nome,'')) like ${termo} or coalesce(s.telefone,'') like ${termo} or lower(coalesce(s.email,'')) like ${termo}` : sql``}
    order by s.score desc`;
}

export function resumoCarteira(c: ClienteAscensao[]) {
  const receita = c.reduce((s, x) => s + x.ltv, 0);
  const compras = c.reduce((s, x) => s + x.compras, 0);
  return {
    clientes: c.length,
    receita,
    ltvMedio: c.length ? receita / c.length : null,
    recompra: c.length ? c.filter((x) => x.compras > 1).length / c.length : null,
    ticketMedio: compras ? receita / compras : null,
    emAbordagem: c.filter((x) => x.etapa === "contato" || x.etapa === "proposta").length,
  };
}
