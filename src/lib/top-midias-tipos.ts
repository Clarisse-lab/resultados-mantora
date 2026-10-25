// Tipos e constantes do Top mídias, sem dependência do banco (usados também no navegador).

export type Nivel = "campanha" | "conjunto" | "anuncio";
export type OrdemTop =
  | "leads" | "vendas" | "faturamento" | "investido" | "roas"
  | "cpl" | "cpa" | "ctr" | "impressoes" | "cliques";

/** Métricas em que menor é melhor: o ranking é crescente e cair conta como melhora. */
export const MENOR_MELHOR_TOP = new Set<OrdemTop>(["cpl", "cpa"]);

export type MetricasTop = {
  investido: number;
  cliques: number;
  impressoes: number;
  leads: number;
  vendas: number;
  faturamento: number;
  roas: number | null;
  cpl: number | null;
  cpa: number | null;
  ctr: number | null;
};

export type LinhaTop = MetricasTop & {
  id: string;
  nome: string;
  campanha_id: string | null;
  anterior: MetricasTop | null; // mesmo item no período anterior (para as variações)
};
