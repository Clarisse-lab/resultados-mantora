const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const moedaCurta = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 });
const inteiro = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const pct = new Intl.NumberFormat("pt-BR", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const fmtMoeda = (v: number | null | undefined) => (v == null ? "—" : moeda.format(v));
export const fmtMoedaCurta = (v: number) => moedaCurta.format(v);
export const fmtInteiro = (v: number | null | undefined) => (v == null ? "—" : inteiro.format(v));
export const fmtPct = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? "—" : pct.format(v));
export const fmtMultiplo = (v: number | null | undefined) =>
  v == null ? "—" : `${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}×`;

export function fmtKpi(v: number | null, formato: "moeda" | "inteiro" | "multiplo") {
  return formato === "moeda" ? fmtMoeda(v) : formato === "multiplo" ? fmtMultiplo(v) : fmtInteiro(v);
}

export const fmtDataHora = (d: Date | string) =>
  new Date(d).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });

export const fmtDiaCurto = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export function fmtTelefone(t: string | null) {
  if (!t) return "—";
  return t.length === 11 ? `(${t.slice(0, 2)}) ${t.slice(2, 7)}-${t.slice(7)}` : t.length === 10 ? `(${t.slice(0, 2)}) ${t.slice(2, 6)}-${t.slice(6)}` : t;
}

/** Variação relativa entre o período atual e o anterior. */
export function variacao(atual: number | null, anterior: number | null) {
  if (atual == null || anterior == null || anterior === 0) return null;
  return (atual - anterior) / Math.abs(anterior);
}
