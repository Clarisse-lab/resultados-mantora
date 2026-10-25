"use client";

import { ChevronDown, Info } from "lucide-react";
import { useState } from "react";
import type { Kpi } from "@/lib/metricas";
import { fmtKpi, fmtPct, variacao } from "@/lib/formato";

// Para custos, cair é bom
const MENOR_MELHOR = new Set(["custoPorVenda", "custoPorLead", "investido"]);

function Sparkline({ pontos }: { pontos: number[] }) {
  if (pontos.length < 2) return null;
  const max = Math.max(...pontos, 1);
  const w = 100;
  const h = 32;
  const xy = pontos.map((v, i) => [(i / (pontos.length - 1)) * w, h - (v / max) * (h - 4) - 2]);
  const linha = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-12 w-full opacity-60" aria-hidden>
      <path d={`${linha} L${w},${h} L0,${h} Z`} fill="var(--marca)" opacity="0.10" />
      <path d={linha} fill="none" stroke="var(--marca)" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Cartao({ k }: { k: Kpi }) {
  const v = variacao(k.valor, k.anterior);
  const bom = v == null ? null : MENOR_MELHOR.has(k.key) ? v < 0 : v > 0;
  const progresso = k.meta && k.valor != null ? k.valor / k.meta : null;
  return (
    <div className="cartao relative overflow-hidden p-4">
      <div className="flex items-center justify-between">
        <span className="rotulo">{k.label}</span>
        <span title={k.descricao} className="text-texto-3">
          <Info size={14} />
        </span>
      </div>
      <p className="num relative mt-2 text-[26px] font-semibold leading-tight">{fmtKpi(k.valor, k.formato)}</p>
      <p className="relative mt-1 text-xs text-texto-3">
        {v == null ? (
          "sem base de comparação"
        ) : (
          <>
            <span className={bom ? "text-sucesso" : "text-perigo"}>
              {v > 0 ? "▲" : "▼"} {fmtPct(Math.abs(v))}
            </span>{" "}
            vs. período anterior
          </>
        )}
      </p>
      {progresso != null && (
        <div className="relative mt-3" title={`Meta do período: ${fmtKpi(k.meta!, k.formato)}`}>
          <div className="h-1.5 overflow-hidden rounded-full bg-superficie-2">
            <div className="h-full rounded-full bg-marca" style={{ width: `${Math.min(progresso, 1) * 100}%` }} />
          </div>
          <p className="mt-1 text-[11px] text-texto-3">
            {fmtPct(progresso)} da meta ({fmtKpi(k.meta!, k.formato)})
          </p>
        </div>
      )}
      {k.serie && progresso == null && <Sparkline pontos={k.serie} />}
    </div>
  );
}

export function CartoesKpi({ kpis, visiveis = 3 }: { kpis: Kpi[]; visiveis?: number }) {
  const [todos, setTodos] = useState(false);
  const mostrar = todos ? kpis : kpis.slice(0, visiveis);
  const resto = kpis.length - visiveis;
  return (
    <section aria-label="Indicadores">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {mostrar.map((k) => (
          <Cartao key={k.key} k={k} />
        ))}
      </div>
      {resto > 0 && (
        <button onClick={() => setTodos(!todos)} className="mt-2 inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-texto-3 hover:text-texto">
          <ChevronDown size={14} className={todos ? "rotate-180" : ""} />
          {todos ? "Menos detalhes" : `Mais detalhes (+${resto})`}
        </button>
      )}
    </section>
  );
}
