"use client";

import { geoMercator, geoPath } from "d3-geo";
import type { FeatureCollection, MultiPolygon } from "geojson";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import brasil from "@/lib/br-uf.json";
import type { Geo } from "@/lib/metricas";
import { fmtInteiro, fmtMoeda } from "@/lib/formato";

type Metrica = "faturamento" | "vendas" | "leads";
const ROTULOS: Record<Metrica, string> = { faturamento: "Faturamento", vendas: "Vendas", leads: "Leads" };
const fmt = (m: Metrica, v: number) => (m === "faturamento" ? fmtMoeda(v) : fmtInteiro(v));

const geo = brasil as unknown as FeatureCollection<MultiPolygon, { uf: string; nome: string }>;
const L = 420;

export function MapaBrasil({ estados, semGeo }: { estados: Geo[]; semGeo: { vendas: number; leads: number } }) {
  const busca = useSearchParams();
  const [metrica, setMetrica] = useState<Metrica>("faturamento");
  const [uf, setUf] = useState<string | null>(null);
  const [cidades, setCidades] = useState<{ cidade: string; faturamento: number; vendas: number }[] | null>(null);
  const [verLista, setVerLista] = useState(false);

  const caminhos = useMemo(() => {
    const proj = geoMercator().fitSize([L, L], geo);
    const path = geoPath(proj);
    return geo.features.map((f) => ({ uf: f.properties.uf, nome: f.properties.nome, d: path(f) ?? "" }));
  }, []);

  const porUf = new Map(estados.map((e) => [e.uf, e]));
  const valores = estados.map((e) => e[metrica]).filter((v) => v > 0);
  const max = Math.max(...valores, 0);
  const min = Math.min(...valores, max);
  const total = estados.reduce((s, e) => s + e[metrica], 0);
  const cor = (v: number) =>
    v <= 0 ? "var(--superficie-2)" : `color-mix(in srgb, var(--marca) ${Math.round(18 + 82 * (max > 0 ? v / max : 0))}%, var(--superficie-2))`;

  async function abrir(sigla: string) {
    if (uf === sigla) return fechar();
    setUf(sigla);
    setCidades(null);
    const p = new URLSearchParams(busca.toString());
    p.set("uf", sigla);
    const r = await fetch(`/api/geo/cidades?${p}`);
    setCidades(r.ok ? await r.json() : []);
  }
  function fechar() {
    setUf(null);
    setCidades(null);
  }

  const ranking = [...estados].sort((a, b) => b[metrica] - a[metrica]);

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rotulo">Métrica</span>
        <select className="controle" value={metrica} onChange={(e) => setMetrica(e.target.value as Metrica)}>
          {(Object.keys(ROTULOS) as Metrica[]).map((m) => (
            <option key={m} value={m}>
              {ROTULOS[m]}
            </option>
          ))}
        </select>
        <span className="num ml-auto rounded-full border border-borda px-3 py-1 text-[11px] text-texto-2">
          {fmt(metrica, total)} · {ROTULOS[metrica].toLowerCase()}
        </span>
      </div>

      <div className="relative mt-3 flex flex-1 items-center justify-center">
        <svg viewBox={`0 0 ${L} ${L}`} className="w-full max-w-[420px]" role="img" aria-label={`Mapa do Brasil por ${ROTULOS[metrica]}`}>
          {caminhos.map((c) => {
            const e = porUf.get(c.uf);
            const v = e?.[metrica] ?? 0;
            return (
              <path
                key={c.uf}
                d={c.d}
                fill={cor(v)}
                stroke={uf === c.uf ? "var(--texto)" : "var(--fundo)"}
                strokeWidth={uf === c.uf ? 1.6 : 0.7}
                className="cursor-pointer transition-opacity hover:opacity-80"
                onClick={() => abrir(c.uf)}
              >
                <title>{`${c.nome}: ${fmt(metrica, v)}`}</title>
              </path>
            );
          })}
        </svg>
        {uf && (
          <div className="absolute right-0 top-0 max-h-full w-64 overflow-auto rounded-xl border border-borda bg-superficie-2 p-3 shadow-xl">
            <div className="mb-2 flex items-center justify-between">
              <p className="font-semibold">{caminhos.find((c) => c.uf === uf)?.nome}</p>
              <button className="text-xs text-texto-3 hover:text-texto" onClick={fechar}>
                fechar
              </button>
            </div>
            {cidades == null ? (
              <p className="text-xs text-texto-3">Carregando…</p>
            ) : cidades.length === 0 ? (
              <p className="text-xs text-texto-3">Nenhuma venda neste estado no período.</p>
            ) : (
              <ul className="space-y-1 text-xs">
                {cidades.map((c) => (
                  <li key={c.cidade} className="flex justify-between gap-2">
                    <span className="truncate text-texto-2">{c.cidade}</span>
                    <span className="num">{fmtMoeda(c.faturamento)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {max > 0 && (
        <div className="mx-auto mt-3 flex w-full max-w-sm items-center gap-2 text-[11px] text-texto-3">
          <span className="num">{fmt(metrica, min)}</span>
          <div className="h-1.5 flex-1 rounded-full" style={{ background: `linear-gradient(90deg, ${cor(min)}, ${cor(max)})` }} />
          <span className="num">{fmt(metrica, max)}</span>
        </div>
      )}
      <p className="mt-2 text-center text-[11px] text-texto-3">Clique num estado para ver as cidades.</p>

      <div className="mt-3 text-center">
        <button className="botao-sec" onClick={() => setVerLista(!verLista)}>
          {verLista ? "Ocultar estados" : "Ver estados"}
        </button>
      </div>
      {verLista && (
        <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
          {ranking.map((e) => (
            <li key={e.uf} className="flex justify-between">
              <span className="text-texto-2">{e.uf}</span>
              <span className="num">{fmt(metrica, e[metrica])}</span>
            </li>
          ))}
        </ul>
      )}
      {(semGeo.vendas > 0 || semGeo.leads > 0) && (
        <p className="mt-3 text-[11px] text-texto-3">
          {fmtInteiro(semGeo.leads)} leads e {fmtInteiro(semGeo.vendas)} vendas do período sem estado identificado — fora do mapa, mas dentro do total dos cards.
        </p>
      )}
    </div>
  );
}
