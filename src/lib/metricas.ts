import { sql } from "./db";
import { MENOR_MELHOR_TOP, type LinhaTop, type MetricasTop, type Nivel, type OrdemTop } from "./top-midias-tipos";

export { MENOR_MELHOR_TOP, type LinhaTop, type MetricasTop, type Nivel, type OrdemTop };

export const FUSO = "America/Sao_Paulo";

export type Recorte = "unificada" | "perpetuo" | "lancamento";
export type Categoria = "all" | "pago" | "organico" | "nao-definido";
export type Granularidade = "dia" | "semana" | "mes";

export type Filtros = {
  from: string; // AAAA-MM-DD, inclusive, no fuso de Brasília
  to: string;
  recorte: Recorte;
  categoria: Categoria;
  granularidade: Granularidade;
};

export type KpiKey =
  | "faturamento" | "vendas" | "roas" | "ticketMedio" | "custoPorVenda"
  | "custoPorLead" | "leads" | "checkouts" | "investido";

export type Kpi = {
  key: KpiKey;
  label: string;
  valor: number | null;
  anterior: number | null;
  formato: "moeda" | "inteiro" | "multiplo";
  descricao: string;
  serie?: number[];
  meta?: number | null;
};

const hojeSP = () => new Date().toLocaleDateString("en-CA", { timeZone: FUSO });
const DATA = /^\d{4}-\d{2}-\d{2}$/;

export function somarDias(data: string, dias: number) {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function diasEntre(a: string, b: string) {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000) + 1;
}

export function lerFiltros(sp: Record<string, string | string[] | undefined>): Filtros {
  const v = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const hoje = hojeSP();
  let from = v("from") && DATA.test(v("from")!) ? v("from")! : somarDias(hoje, -6);
  let to = v("to") && DATA.test(v("to")!) ? v("to")! : hoje;
  if (from > to) [from, to] = [to, from];
  const recorte = (["unificada", "perpetuo", "lancamento"] as const).find((r) => r === v("recorte")) ?? "unificada";
  const categoria = (["all", "pago", "organico", "nao-definido"] as const).find((c) => c === v("categoria")) ?? "all";
  const granularidade = (["dia", "semana", "mes"] as const).find((g) => g === v("granularidade")) ?? "dia";
  return { from, to, recorte, categoria, granularidade };
}

/** Período imediatamente anterior, com o mesmo número de dias. */
export function periodoAnterior(f: Filtros): Filtros {
  const n = diasEntre(f.from, f.to);
  return { ...f, from: somarDias(f.from, -n), to: somarDias(f.from, -1) };
}

// ----------------------------------------------------------------- fragmentos de SQL

const contextoVendas = (f: Filtros) => (f.recorte === "unificada" ? sql`` : sql`and contexto = ${f.recorte}`);
const contextoMidia = contextoVendas;
const categoriaFiltro = (f: Filtros) => (f.categoria === "all" ? sql`` : sql`and categoria = ${f.categoria}`);
const diaSP = (col: string) => sql`(${sql(col)} at time zone ${FUSO})::date`;
const noPeriodo = (col: string, f: Filtros) => sql`${diaSP(col)} between ${f.from}::date and ${f.to}::date`;

// ----------------------------------------------------------------- totais

type Totais = {
  investido: number; impressoes: number; cliques: number; page_views: number;
  leads: number; checkouts: number; vendas: number; faturamento: number;
};

export async function totais(clienteId: string, f: Filtros): Promise<Totais> {
  const [[m], [l], [c], [v]] = await Promise.all([
    sql<{ investido: number; impressoes: number; cliques: number; page_views: number }[]>`
      select coalesce(sum(investido), 0)::float as investido, coalesce(sum(impressoes), 0)::int as impressoes,
             coalesce(sum(cliques), 0)::int as cliques, coalesce(sum(page_views), 0)::int as page_views
      from midia_diaria where cliente_id = ${clienteId} and data between ${f.from}::date and ${f.to}::date ${contextoMidia(f)}`,
    sql<{ n: number }[]>`
      select count(*)::int as n from leads
      where cliente_id = ${clienteId} and ${noPeriodo("criado_em", f)} ${categoriaFiltro(f)}`,
    sql<{ n: number }[]>`
      select count(*)::int as n from checkouts
      where cliente_id = ${clienteId} and ${noPeriodo("criado_em", f)} ${categoriaFiltro(f)}`,
    sql<{ n: number; total: number }[]>`
      select count(*)::int as n, coalesce(sum(valor), 0)::float as total from vendas
      where cliente_id = ${clienteId} and status = 'aprovada' and ${noPeriodo("aprovado_em", f)}
        ${contextoVendas(f)} ${categoriaFiltro(f)}`,
  ]);
  return { ...m, leads: l.n, checkouts: c.n, vendas: v.n, faturamento: v.total };
}

const div = (a: number, b: number) => (b > 0 ? a / b : null);

function kpisDe(t: Totais, a: Totais, f: Filtros): Kpi[] {
  const semLeads = f.recorte === "lancamento"; // leads não se separam por contexto
  const lista: Kpi[] = [
    { key: "faturamento", label: "Faturamento", formato: "moeda", valor: t.faturamento, anterior: a.faturamento, descricao: "Soma das vendas aprovadas no período." },
    { key: "vendas", label: "Vendas", formato: "inteiro", valor: t.vendas, anterior: a.vendas, descricao: "Quantidade de vendas aprovadas." },
    { key: "roas", label: "ROAS", formato: "multiplo", valor: div(t.faturamento, t.investido), anterior: div(a.faturamento, a.investido), descricao: "Faturamento ÷ investimento em mídia." },
    { key: "ticketMedio", label: "Ticket médio", formato: "moeda", valor: div(t.faturamento, t.vendas), anterior: div(a.faturamento, a.vendas), descricao: "Faturamento ÷ vendas." },
    { key: "custoPorVenda", label: "Custo por venda", formato: "moeda", valor: div(t.investido, t.vendas), anterior: div(a.investido, a.vendas), descricao: "Investimento ÷ vendas." },
    { key: "custoPorLead", label: "Custo por lead", formato: "moeda", valor: div(t.investido, t.leads), anterior: div(a.investido, a.leads), descricao: "Investimento ÷ leads captados." },
    { key: "leads", label: "Leads", formato: "inteiro", valor: t.leads, anterior: a.leads, descricao: "Cadastros recebidos (o mesmo contato no mesmo dia conta uma vez)." },
    { key: "checkouts", label: "Checkouts", formato: "inteiro", valor: t.checkouts + t.vendas, anterior: a.checkouts + a.vendas, descricao: "Checkouts iniciados: vendas aprovadas + carrinhos abandonados." },
    { key: "investido", label: "Investido", formato: "moeda", valor: t.investido, anterior: a.investido, descricao: "Gasto em mídia paga no período." },
  ];
  return semLeads ? lista.filter((k) => k.key !== "leads" && k.key !== "custoPorLead") : lista;
}

// ----------------------------------------------------------------- série temporal

export type PontoSerie = { periodo: string; investido: number; faturamento: number; vendas: number; leads: number; roas: number | null };

export async function serie(clienteId: string, f: Filtros): Promise<PontoSerie[]> {
  const trunc = f.granularidade === "dia" ? "day" : f.granularidade === "semana" ? "week" : "month";
  const rows = await sql<{ periodo: string; investido: number; faturamento: number; vendas: number; leads: number }[]>`
    with dias as (
      select generate_series(${f.from}::date, ${f.to}::date, interval '1 day')::date as d
    ),
    m as (select data as d, sum(investido) as investido from midia_diaria
          where cliente_id = ${clienteId} and data between ${f.from}::date and ${f.to}::date ${contextoMidia(f)} group by 1),
    v as (select ${diaSP("aprovado_em")} as d, count(*) as vendas, sum(valor) as faturamento from vendas
          where cliente_id = ${clienteId} and status = 'aprovada' and ${noPeriodo("aprovado_em", f)} ${contextoVendas(f)} ${categoriaFiltro(f)} group by 1),
    l as (select ${diaSP("criado_em")} as d, count(*) as leads from leads
          where cliente_id = ${clienteId} and ${noPeriodo("criado_em", f)} ${categoriaFiltro(f)} group by 1)
    select to_char(date_trunc(${trunc}, dias.d), 'YYYY-MM-DD') as periodo,
           coalesce(sum(m.investido), 0)::float as investido,
           coalesce(sum(v.faturamento), 0)::float as faturamento,
           coalesce(sum(v.vendas), 0)::int as vendas,
           coalesce(sum(l.leads), 0)::int as leads
    from dias left join m using (d) left join v using (d) left join l using (d)
    group by 1 order by 1`;
  return rows.map((r) => ({ ...r, roas: r.investido > 0 ? r.faturamento / r.investido : null }));
}

// ----------------------------------------------------------------- funil

export type EtapaFunil = { key: string; label: string; valor: number };

function funilDe(t: Totais, f: Filtros): EtapaFunil[] {
  const etapas: EtapaFunil[] = [
    { key: "cliques", label: "Cliques (mídia)", valor: t.cliques },
    { key: "pageviews", label: "Page views (mídia)", valor: t.page_views },
    { key: "leads", label: "Cadastros", valor: t.leads },
    { key: "checkouts", label: "Checkouts", valor: t.checkouts + t.vendas },
    { key: "vendas", label: "Vendas", valor: t.vendas },
  ];
  return f.recorte === "lancamento" ? etapas.filter((e) => e.key !== "leads") : etapas;
}

// ----------------------------------------------------------------- geografia

export type Geo = { uf: string; faturamento: number; vendas: number; leads: number };

export async function porGeo(clienteId: string, f: Filtros) {
  const linhas = await sql<{ uf: string | null; faturamento: number; vendas: number; leads: number }[]>`
    with v as (select coalesce(uf, '') as uf, sum(valor) as faturamento, count(*) as vendas from vendas
               where cliente_id = ${clienteId} and status = 'aprovada' and ${noPeriodo("aprovado_em", f)} ${contextoVendas(f)} ${categoriaFiltro(f)}
               group by 1),
         l as (select coalesce(uf, '') as uf, count(*) as leads from leads
               where cliente_id = ${clienteId} and ${noPeriodo("criado_em", f)} ${categoriaFiltro(f)} group by 1)
    select nullif(coalesce(v.uf, l.uf), '') as uf, coalesce(v.faturamento, 0)::float as faturamento,
           coalesce(v.vendas, 0)::int as vendas, coalesce(l.leads, 0)::int as leads
    from v full outer join l on v.uf = l.uf`;
  const semUf = linhas.find((r) => r.uf == null);
  return {
    estados: linhas.filter((r): r is Geo => r.uf != null),
    semGeo: { vendas: semUf?.vendas ?? 0, leads: semUf?.leads ?? 0 },
  };
}

export async function cidadesDaUf(clienteId: string, f: Filtros, uf: string) {
  return sql<{ cidade: string; faturamento: number; vendas: number }[]>`
    select coalesce(cidade, 'Cidade não informada') as cidade, sum(valor)::float as faturamento, count(*)::int as vendas
    from vendas where cliente_id = ${clienteId} and status = 'aprovada' and uf = ${uf}
      and ${noPeriodo("aprovado_em", f)} ${contextoVendas(f)} ${categoriaFiltro(f)}
    group by 1 order by 2 desc limit 30`;
}

// ----------------------------------------------------------------- top mídias

type Bruto = Omit<MetricasTop, "roas" | "cpl" | "cpa" | "ctr"> & { id: string; nome: string; campanha_id: string | null };

/** Restringe o ranking aos filhos de uma campanha ou de um conjunto. */
export type Dentro = { nivel: "campanha" | "conjunto"; id: string };

async function agregadoTop(clienteId: string, f: Filtros, nivel: Nivel, dentro?: Dentro) {
  const col = sql(`${nivel}_id`);
  const colNome = sql(`${nivel}_nome`);
  const utm = sql.unsafe(nivel === "campanha" ? "utm_campaign" : nivel === "conjunto" ? "utm_medium" : "utm_content");
  const filtroPai = dentro ? sql`and ${sql(`${dentro.nivel}_id`)} = ${dentro.id}` : sql``;
  return sql<Bruto[]>`
    with m as (
      select ${col} as id, max(${colNome}) as nome, max(campanha_id) as campanha_id,
             sum(investido) as investido, sum(cliques) as cliques, sum(impressoes) as impressoes
      from midia_diaria where cliente_id = ${clienteId} and data between ${f.from}::date and ${f.to}::date ${contextoMidia(f)} ${filtroPai}
      group by 1
    ),
    v as (
      select ${col} as id, count(*) as vendas, sum(valor) as faturamento, max(${utm}) as utm
      from vendas where cliente_id = ${clienteId} and status = 'aprovada' and ${col} is not null
        and ${noPeriodo("aprovado_em", f)} ${contextoVendas(f)} ${filtroPai}
      group by 1
    ),
    l as (
      select ${col} as id, count(*) as leads, max(${utm}) as utm
      from leads where cliente_id = ${clienteId} and ${col} is not null and ${noPeriodo("criado_em", f)} ${filtroPai}
      group by 1
    )
    select coalesce(m.id, v.id, l.id) as id,
           coalesce(m.nome, regexp_replace(coalesce(v.utm, l.utm), '\\|\\s*\\d+\\s*$', ''), coalesce(m.id, v.id, l.id)) as nome,
           m.campanha_id,
           coalesce(m.investido, 0)::float as investido, coalesce(m.cliques, 0)::int as cliques,
           coalesce(m.impressoes, 0)::int as impressoes, coalesce(l.leads, 0)::int as leads,
           coalesce(v.vendas, 0)::int as vendas, coalesce(v.faturamento, 0)::float as faturamento
    from m full outer join v on v.id = m.id full outer join l on l.id = coalesce(m.id, v.id)`;
}

function metricas(r: Omit<MetricasTop, "roas" | "cpl" | "cpa" | "ctr">): MetricasTop {
  return {
    investido: r.investido,
    cliques: r.cliques,
    impressoes: r.impressoes,
    leads: r.leads,
    vendas: r.vendas,
    faturamento: r.faturamento,
    roas: r.investido > 0 ? r.faturamento / r.investido : null,
    cpl: r.leads > 0 && r.investido > 0 ? r.investido / r.leads : null,
    cpa: r.vendas > 0 && r.investido > 0 ? r.investido / r.vendas : null,
    ctr: r.impressoes > 0 ? r.cliques / r.impressoes : null,
  };
}

export const valorTop = (r: MetricasTop, o: OrdemTop): number | null => r[o];

export async function topMidias(clienteId: string, f: Filtros, nivel: Nivel, ordem: OrdemTop, limite: number, dentro?: Dentro): Promise<LinhaTop[]> {
  const [atual, antes] = await Promise.all([agregadoTop(clienteId, f, nivel, dentro), agregadoTop(clienteId, periodoAnterior(f), nivel, dentro)]);
  const mapaAntes = new Map(antes.map((r) => [r.id, metricas(r)]));
  const crescente = MENOR_MELHOR_TOP.has(ordem);
  return atual
    .map((r) => ({ id: r.id, nome: r.nome, campanha_id: r.campanha_id, ...metricas(r), anterior: mapaAntes.get(r.id) ?? null }))
    .filter((r) => (valorTop(r, ordem) ?? 0) > 0)
    .sort((a, b) => (crescente ? valorTop(a, ordem)! - valorTop(b, ordem)! : valorTop(b, ordem)! - valorTop(a, ordem)!))
    .slice(0, limite);
}

// ----------------------------------------------------------------- metas

/** Meta do período: soma das metas mensais proporcional aos dias de cada mês dentro do intervalo. */
export async function metasDoPeriodo(clienteId: string, f: Filtros): Promise<Partial<Record<KpiKey, number>>> {
  const rows = await sql<{ mes: Date; kpi: KpiKey; valor: number }[]>`
    select mes, kpi, valor from metas
    where cliente_id = ${clienteId} and mes between date_trunc('month', ${f.from}::date) and date_trunc('month', ${f.to}::date)`;
  const out: Partial<Record<KpiKey, number>> = {};
  for (const r of rows) {
    const ini = r.mes.toISOString().slice(0, 10);
    const d = new Date(`${ini}T12:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + 1);
    d.setUTCDate(0);
    const fim = d.toISOString().slice(0, 10);
    const a = f.from > ini ? f.from : ini;
    const b = f.to < fim ? f.to : fim;
    if (a > b) continue;
    out[r.kpi] = (out[r.kpi] ?? 0) + (r.valor * diasEntre(a, b)) / diasEntre(ini, fim);
  }
  return out;
}

// ----------------------------------------------------------------- visão geral completa

export async function visaoGeral(clienteId: string, f: Filtros) {
  const [t, a, s, geo, metas] = await Promise.all([
    totais(clienteId, f),
    totais(clienteId, periodoAnterior(f)),
    serie(clienteId, f),
    porGeo(clienteId, f),
    metasDoPeriodo(clienteId, f),
  ]);
  const series: Partial<Record<KpiKey, number[]>> = {
    faturamento: s.map((p) => p.faturamento),
    investido: s.map((p) => p.investido),
    vendas: s.map((p) => p.vendas),
    leads: s.map((p) => p.leads),
  };
  const kpis = kpisDe(t, a, f).map((k) => ({ ...k, serie: series[k.key], meta: metas[k.key] ?? null }));
  return { kpis, serie: s, funil: funilDe(t, f), geo, totais: t };
}
