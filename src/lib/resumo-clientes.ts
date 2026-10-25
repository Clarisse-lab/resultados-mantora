import { sql } from "./db";
import { periodoAnterior, totais, type Filtros } from "./metricas";

export type ResumoCliente = {
  id: string;
  nome: string;
  investido: number;
  faturamento: number;
  faturamentoAnterior: number;
  vendas: number;
  leads: number;
  roas: number | null;
  cpl: number | null;
  cpv: number | null;
  alertas: string[];
};

/** Números do período de cada cliente, para a tela "Todos os clientes". */
export async function resumoPorCliente(clientes: { id: string; nome: string }[], f: Filtros): Promise<ResumoCliente[]> {
  if (clientes.length === 0) return [];
  const ids = clientes.map((c) => c.id);
  const saude = await sql<{ cliente_id: string; meta: number; venda: number; erros: number }[]>`
    select cliente_id,
           count(*) filter (where tipo = 'meta_ads')::int as meta,
           count(*) filter (where tipo in ('kiwify', 'hotmart', 'pagtrust'))::int as venda,
           count(*) filter (where ultimo_erro is not null and ativo)::int as erros
    from integracoes where cliente_id = any(${ids}::uuid[]) group by cliente_id`;
  const porCliente = new Map(saude.map((s) => [s.cliente_id, s]));
  const anterior = periodoAnterior(f);

  return Promise.all(
    clientes.map(async (c) => {
      const [t, a] = await Promise.all([totais(c.id, f), totais(c.id, anterior)]);
      const s = porCliente.get(c.id);
      const alertas: string[] = [];
      if (!s?.meta) alertas.push("Sem Meta Ads");
      if (!s?.venda) alertas.push("Sem plataforma de venda");
      if (s?.erros) alertas.push(s.erros === 1 ? "1 integração com erro" : `${s.erros} integrações com erro`);
      return {
        id: c.id,
        nome: c.nome,
        investido: t.investido,
        faturamento: t.faturamento,
        faturamentoAnterior: a.faturamento,
        vendas: t.vendas,
        leads: t.leads,
        roas: t.investido > 0 ? t.faturamento / t.investido : null,
        cpl: t.leads > 0 && t.investido > 0 ? t.investido / t.leads : null,
        cpv: t.vendas > 0 && t.investido > 0 ? t.investido / t.vendas : null,
        alertas,
      };
    }),
  );
}
