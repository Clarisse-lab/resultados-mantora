"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { useTransition } from "react";

const hoje = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
const menos = (data: string, dias: number) => {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - dias);
  return d.toISOString().slice(0, 10);
};

const PRESETS = [
  { k: "hoje", rotulo: "Hoje", dias: 0, fim: 0 },
  { k: "ontem", rotulo: "Ontem", dias: 0, fim: 1 },
  { k: "7d", rotulo: "Últimos 7 dias", dias: 6, fim: 0 },
  { k: "30d", rotulo: "Últimos 30 dias", dias: 29, fim: 0 },
  { k: "90d", rotulo: "Últimos 90 dias", dias: 89, fim: 0 },
];

type Props = {
  from: string;
  to: string;
  recorte: string;
  categoria: string;
  granularidade?: string;
  titulo: string;
  extra?: React.ReactNode;
  semRecorte?: boolean; // leads não se separam por perpétuo/lançamento
  semPeriodo?: boolean;
};

export function BarraFiltros({ from, to, recorte, categoria, granularidade, titulo, extra, semRecorte, semPeriodo }: Props) {
  const router = useRouter();
  const caminho = usePathname();
  const busca = useSearchParams();
  const [carregando, iniciar] = useTransition();

  function aplicar(mudancas: Record<string, string | null>) {
    const p = new URLSearchParams(busca.toString());
    for (const [k, v] of Object.entries(mudancas)) (v == null ? p.delete(k) : p.set(k, v));
    iniciar(() => router.push(`${caminho}?${p.toString()}`, { scroll: false }));
  }

  const presetAtual = PRESETS.find((p) => menos(hoje(), p.fim) === to && menos(to, p.dias) === from)?.k ?? "custom";

  return (
    <header className="sticky top-0 z-20 border-b border-borda bg-fundo/85 backdrop-blur">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-2 px-4 py-3 pl-16 lg:px-8">
        <h1 className="mr-auto text-xl font-semibold tracking-tight">{titulo}</h1>
        {carregando && <span className="text-xs text-texto-3">Atualizando…</span>}
        {!semPeriodo && (<>
        <label className="relative">
          <CalendarDays size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-texto-3" />
          <select
            aria-label="Período"
            className="controle pl-8"
            value={presetAtual}
            onChange={(e) => {
              const p = PRESETS.find((x) => x.k === e.target.value);
              if (p) {
                const fim = menos(hoje(), p.fim);
                aplicar({ from: menos(fim, p.dias), to: fim });
              }
            }}
          >
            {PRESETS.map((p) => (
              <option key={p.k} value={p.k}>
                {p.rotulo}
              </option>
            ))}
            <option value="custom">Personalizado</option>
          </select>
        </label>
        <input type="date" aria-label="Data inicial" className="controle" value={from} max={to} onChange={(e) => e.target.value && aplicar({ from: e.target.value })} />
        <input type="date" aria-label="Data final" className="controle" value={to} min={from} onChange={(e) => e.target.value && aplicar({ to: e.target.value })} />
        </>)}
        {!semRecorte && !semPeriodo && (
        <select aria-label="Recorte" className="controle" value={recorte} onChange={(e) => aplicar({ recorte: e.target.value === "unificada" ? null : e.target.value })}>
          <option value="unificada">Unificada</option>
          <option value="perpetuo">Perpétuo</option>
          <option value="lancamento">Lançamento</option>
        </select>
        )}
        {!semPeriodo && (
        <select aria-label="Origem" className="controle" value={categoria} onChange={(e) => aplicar({ categoria: e.target.value === "all" ? null : e.target.value })}>
          <option value="all">Todas as origens</option>
          <option value="pago">Pago</option>
          <option value="organico">Orgânico</option>
          <option value="nao-definido">Não definido</option>
        </select>
        )}
        {granularidade && (
          <select aria-label="Agrupar por" className="controle" value={granularidade} onChange={(e) => aplicar({ granularidade: e.target.value === "dia" ? null : e.target.value })}>
            <option value="dia">Por dia</option>
            <option value="semana">Por semana</option>
            <option value="mes">Por mês</option>
          </select>
        )}
        {extra}
      </div>
    </header>
  );
}
