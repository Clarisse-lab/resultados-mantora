import type { EtapaFunil } from "@/lib/metricas";
import { fmtInteiro, fmtPct } from "@/lib/formato";

// Cada etapa é uma faixa cuja largura é proporcional à raiz do volume
// (com escala linear as últimas etapas sumiriam ao lado dos cliques).
export function Funil({ etapas }: { etapas: EtapaFunil[] }) {
  const max = Math.max(...etapas.map((e) => e.valor), 1);
  const larg = (v: number) => 18 + 82 * Math.sqrt(v / max);
  return (
    <ol className="space-y-2">
      {etapas.map((e, i) => {
        const anterior = i > 0 ? etapas[i - 1].valor : null;
        const conv = anterior ? e.valor / anterior : null;
        return (
          <li key={e.key} className="grid grid-cols-[1fr_auto] items-center gap-4">
            <div className="flex justify-center">
              <div
                className="h-11 rounded-md"
                style={{
                  width: `${larg(e.valor)}%`,
                  background: `color-mix(in srgb, var(--marca) ${92 - i * 14}%, var(--superficie-2))`,
                }}
              />
            </div>
            <div className="w-40 rounded-lg border border-borda bg-superficie-2 px-3 py-2">
              <p className="rotulo !text-[10px]">{e.label}</p>
              <p className="flex items-baseline justify-between">
                <span className="num text-[17px] font-semibold">{fmtInteiro(e.valor)}</span>
                {conv != null && <span className="num text-[11px] text-texto-3">{fmtPct(conv)}</span>}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
