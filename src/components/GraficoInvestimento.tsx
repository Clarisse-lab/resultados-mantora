"use client";

import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { PontoSerie } from "@/lib/metricas";
import { fmtDiaCurto, fmtMoeda, fmtMoedaCurta, fmtMultiplo } from "@/lib/formato";

export function GraficoInvestimento({ serie }: { serie: PontoSerie[] }) {
  const dados = serie.map((p) => ({ ...p, dia: fmtDiaCurto(p.periodo) }));
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={dados} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--borda)" strokeDasharray="3 4" />
          <XAxis dataKey="dia" tick={{ fill: "var(--texto-3)", fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={12} />
          <YAxis yAxisId="r" tickFormatter={(v: number) => fmtMoedaCurta(v)} tick={{ fill: "var(--texto-3)", fontSize: 11 }} axisLine={false} tickLine={false} width={70} />
          <YAxis yAxisId="roas" orientation="right" tickFormatter={(v: number) => `${v}×`} tick={{ fill: "var(--texto-3)", fontSize: 11 }} axisLine={false} tickLine={false} width={34} />
          <Tooltip
            cursor={{ fill: "var(--superficie-2)" }}
            contentStyle={{ background: "var(--superficie-2)", border: "1px solid var(--borda)", borderRadius: 10, fontSize: 12 }}
            labelStyle={{ color: "var(--texto)" }}
            formatter={(v: number, nome: string) => [nome === "ROAS" ? fmtMultiplo(v) : fmtMoeda(v), nome]}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: "var(--texto-2)" }} />
          <Bar yAxisId="r" dataKey="investido" name="Investimento" fill="var(--neutro-barra)" radius={[3, 3, 0, 0]} maxBarSize={22} />
          <Bar yAxisId="r" dataKey="faturamento" name="Faturamento" fill="var(--marca)" radius={[3, 3, 0, 0]} maxBarSize={22} />
          <Line yAxisId="roas" dataKey="roas" name="ROAS" stroke="var(--marca-2)" strokeWidth={2} dot={{ r: 2.5 }} connectNulls type="monotone" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
