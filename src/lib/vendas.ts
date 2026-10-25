import { sql } from "./db";
import { FUSO, type Filtros } from "./metricas";

export type LinhaVenda = {
  id: string;
  data: Date;
  nome: string | null;
  telefone: string | null;
  email: string | null;
  valor: number;
  produto: string | null;
  status: string;
  provedor: string;
  origem: string;
  categoria: string;
  contexto: string;
  uf: string | null;
  cidade: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  metodo: string | null;
};

export const STATUS_ROTULO: Record<string, string> = {
  aprovada: "Aprovada",
  reembolsada: "Reembolsada",
  chargeback: "Chargeback",
  cancelada: "Cancelada",
  pendente: "Pendente",
  recusada: "Recusada",
};

/** Vendas do período pela data do evento (aprovação ou, se não aprovou, criação). */
export async function listarVendas(clienteId: string, f: Filtros, opts: { busca?: string; status?: string; limite?: number } = {}) {
  const busca = opts.busca?.trim() ? `%${opts.busca.trim().toLowerCase()}%` : null;
  const status = opts.status && opts.status !== "todas" ? opts.status : null;
  return sql<LinhaVenda[]>`
    select id, coalesce(aprovado_em, criado_em) as data, nome, telefone, email, valor, produto, status, provedor,
           origem, categoria, contexto, uf, cidade, utm_source, utm_medium, utm_campaign, utm_content, utm_term, metodo
    from vendas
    where cliente_id = ${clienteId}
      and (coalesce(aprovado_em, criado_em) at time zone ${FUSO})::date between ${f.from}::date and ${f.to}::date
      ${f.recorte === "unificada" ? sql`` : sql`and contexto = ${f.recorte}`}
      ${f.categoria === "all" ? sql`` : sql`and categoria = ${f.categoria}`}
      ${status ? sql`and status = ${status}` : sql`and status = 'aprovada'`}
      ${busca ? sql`and (lower(coalesce(nome,'')) like ${busca} or lower(coalesce(email,'')) like ${busca}
                        or coalesce(telefone,'') like ${busca} or lower(coalesce(produto,'')) like ${busca}
                        or lower(coalesce(utm_campaign,'')) like ${busca})` : sql``}
    order by data desc
    limit ${opts.limite ?? 1000}`;
}

export async function resumoPorContexto(clienteId: string, f: Filtros) {
  return sql<{ contexto: string; vendas: number }[]>`
    select contexto, count(*)::int as vendas from vendas
    where cliente_id = ${clienteId} and status = 'aprovada'
      and (aprovado_em at time zone ${FUSO})::date between ${f.from}::date and ${f.to}::date
    group by 1`;
}
