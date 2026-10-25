import Link from "next/link";
import type { LinhaTop, Nivel, OrdemTop } from "@/lib/metricas";
import { fmtInteiro, fmtMoeda, fmtMultiplo, variacao } from "@/lib/formato";

const NIVEIS: { k: Nivel; rotulo: string }[] = [
  { k: "campanha", rotulo: "Campanhas" },
  { k: "conjunto", rotulo: "Conjuntos" },
  { k: "anuncio", rotulo: "Anúncios" },
];
const ORDENS: { k: OrdemTop; rotulo: string }[] = [
  { k: "leads", rotulo: "Leads" },
  { k: "vendas", rotulo: "Vendas" },
  { k: "faturamento", rotulo: "Faturamento" },
  { k: "investido", rotulo: "Investido" },
  { k: "roas", rotulo: "ROAS" },
];

const valor = (r: LinhaTop, o: OrdemTop) => (o === "roas" ? r.roas ?? 0 : r[o]);
const fmt = (o: OrdemTop, v: number) => (o === "faturamento" || o === "investido" ? fmtMoeda(v) : o === "roas" ? fmtMultiplo(v) : fmtInteiro(v));

function tendencia(r: LinhaTop, o: OrdemTop) {
  const v = variacao(valor(r, o), r.anterior);
  if (v == null) return { cor: "var(--texto-3)", rotulo: "Sem base" };
  // "Investido" maior não é melhor nem pior; tratamos como neutro-positivo
  if (Math.abs(v) <= 0.05) return { cor: "var(--alerta)", rotulo: "Estável" };
  return v > 0 ? { cor: "var(--sucesso)", rotulo: "Melhorou" } : { cor: "var(--perigo)", rotulo: "Piorou" };
}

type Props = { linhas: LinhaTop[]; nivel: Nivel; ordem: OrdemTop; limite: number; parametros: Record<string, string>; periodoAnterior: string };

export function TopMidias({ linhas, nivel, ordem, limite, parametros, periodoAnterior }: Props) {
  const link = (m: Record<string, string>) => `?${new URLSearchParams({ ...parametros, ...m })}#top-midias`;
  const max = Math.max(...linhas.map((r) => valor(r, ordem)), 1);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-borda p-0.5">
          {NIVEIS.map((n) => (
            <Link key={n.k} href={link({ nivel: n.k })} scroll={false} className={`rounded-md px-3 py-1.5 text-xs font-medium ${n.k === nivel ? "bg-marca-suave text-texto" : "text-texto-3 hover:text-texto"}`}>
              {n.rotulo}
            </Link>
          ))}
        </div>
        <span className="ml-auto text-xs text-texto-3">Classificar por</span>
        <div className="flex flex-wrap rounded-lg border border-borda p-0.5">
          {ORDENS.map((o) => (
            <Link key={o.k} href={link({ ordem: o.k })} scroll={false} className={`rounded-md px-2.5 py-1.5 text-xs ${o.k === ordem ? "bg-marca-suave text-texto" : "text-texto-3 hover:text-texto"}`}>
              {o.rotulo}
            </Link>
          ))}
        </div>
        <div className="flex rounded-lg border border-borda p-0.5">
          {[10, 20, 50].map((n) => (
            <Link key={n} href={link({ top: String(n) })} scroll={false} className={`num rounded-md px-2.5 py-1.5 text-xs ${n === limite ? "bg-marca-suave text-texto" : "text-texto-3 hover:text-texto"}`}>
              {n}
            </Link>
          ))}
        </div>
      </div>
      <p className="mt-3 text-xs text-texto-3">
        Top {limite} por {ORDENS.find((o) => o.k === ordem)?.rotulo.toLowerCase()} · cor = vs. período anterior ({periodoAnterior})
      </p>
      <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-texto-3">
        {[["var(--sucesso)", "Melhorou"], ["var(--alerta)", "Estável (±5%)"], ["var(--perigo)", "Piorou"], ["var(--texto-3)", "Sem base"]].map(([c, r]) => (
          <span key={r} className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm" style={{ background: c }} />
            {r}
          </span>
        ))}
      </div>

      {linhas.length === 0 ? (
        <p className="py-10 text-center text-sm text-texto-3">Nenhuma mídia com {ORDENS.find((o) => o.k === ordem)?.rotulo.toLowerCase()} no período.</p>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {linhas.map((r) => {
            const t = tendencia(r, ordem);
            const v = valor(r, ordem);
            return (
              <li key={r.id} className="grid grid-cols-1 gap-1 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:items-center md:gap-4">
                <p className="truncate text-[13px]" title={r.nome}>
                  {r.nome}
                </p>
                <div className="flex items-center gap-3">
                  <div className="h-5 flex-1 overflow-hidden rounded bg-superficie-2">
                    <div className="h-full rounded" style={{ width: `${(v / max) * 100}%`, background: t.cor, opacity: 0.85 }} title={t.rotulo} />
                  </div>
                  <span className="num w-24 text-right text-[13px] font-medium">{fmt(ordem, v)}</span>
                  <span className="num hidden w-44 text-right text-[11px] text-texto-3 lg:inline">
                    {fmtMoeda(r.investido)} · {fmtInteiro(r.leads)} leads · {fmtInteiro(r.vendas)} vendas
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
