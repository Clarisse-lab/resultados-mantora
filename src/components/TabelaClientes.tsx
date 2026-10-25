"use client";

import { AlertTriangle, ArrowDown, ArrowUp, Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { ResumoCliente } from "@/lib/resumo-clientes";
import { fmtInteiro, fmtMoeda, fmtMultiplo, fmtPct, variacao } from "@/lib/formato";

type Coluna = { k: keyof ResumoCliente; rotulo: string; fmt: (v: number | null) => string };
const COLUNAS: Coluna[] = [
  { k: "investido", rotulo: "Investido", fmt: fmtMoeda },
  { k: "faturamento", rotulo: "Faturamento", fmt: fmtMoeda },
  { k: "roas", rotulo: "ROAS", fmt: fmtMultiplo },
  { k: "vendas", rotulo: "Vendas", fmt: fmtInteiro },
  { k: "leads", rotulo: "Leads", fmt: fmtInteiro },
  { k: "cpl", rotulo: "CPL", fmt: fmtMoeda },
  { k: "cpv", rotulo: "Custo/venda", fmt: fmtMoeda },
];

export function TabelaClientes({ linhas, volta }: { linhas: ResumoCliente[]; volta: string }) {
  const [texto, setTexto] = useState("");
  const [soAlertas, setSoAlertas] = useState(false);
  const [ordem, setOrdem] = useState<{ k: keyof ResumoCliente; desc: boolean }>({ k: "faturamento", desc: true });

  const visiveis = useMemo(() => {
    const t = texto.trim().toLowerCase();
    return linhas
      .filter((l) => (!t || l.nome.toLowerCase().includes(t)) && (!soAlertas || l.alertas.length > 0))
      .sort((a, b) => {
        if (ordem.k === "nome") return (ordem.desc ? -1 : 1) * a.nome.localeCompare(b.nome, "pt-BR");
        const x = (a[ordem.k] as number | null) ?? -Infinity;
        const y = (b[ordem.k] as number | null) ?? -Infinity;
        return ordem.desc ? y - x : x - y;
      });
  }, [linhas, texto, soAlertas, ordem]);

  const soma = (k: "investido" | "faturamento" | "vendas" | "leads") => visiveis.reduce((s, l) => s + l[k], 0);
  const tInv = soma("investido");
  const tFat = soma("faturamento");
  const comAlerta = linhas.filter((l) => l.alertas.length).length;

  const cabecalho = (k: keyof ResumoCliente, rotulo: string, direita = true) => (
    <th className={direita ? "!text-right" : ""}>
      <button className="inline-flex items-center gap-1 hover:text-texto" onClick={() => setOrdem({ k, desc: ordem.k === k ? !ordem.desc : k !== "nome" })}>
        {rotulo}
        {ordem.k === k && (ordem.desc ? <ArrowDown size={12} /> : <ArrowUp size={12} />)}
      </button>
    </th>
  );

  return (
    <div className="space-y-4">
      <section aria-label="Totais" className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          ["Clientes", fmtInteiro(visiveis.length)],
          ["Investido", fmtMoeda(tInv)],
          ["Faturamento", fmtMoeda(tFat)],
          ["ROAS geral", fmtMultiplo(tInv > 0 ? tFat / tInv : null)],
          ["Vendas", fmtInteiro(soma("vendas"))],
        ].map(([r, v]) => (
          <div key={r} className="cartao p-4">
            <p className="rotulo">{r}</p>
            <p className="num mt-2 text-[22px] font-semibold">{v}</p>
          </div>
        ))}
      </section>

      <div className="cartao p-5">
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative mr-auto">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-texto-3" />
            <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar cliente…" className="controle w-64 pl-8" />
          </label>
          {comAlerta > 0 && (
            <label className="flex cursor-pointer items-center gap-2 text-sm text-texto-2">
              <input type="checkbox" checked={soAlertas} onChange={(e) => setSoAlertas(e.target.checked)} className="accent-[var(--marca)]" />
              Só com pendências ({comAlerta})
            </label>
          )}
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="tabela w-full">
            <thead>
              <tr>
                {cabecalho("nome", "Cliente", false)}
                {COLUNAS.map((c) => cabecalho(c.k, c.rotulo))}
                <th>Pendências</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((l) => {
                const v = variacao(l.faturamento, l.faturamentoAnterior);
                return (
                  <tr key={l.id}>
                    <td>
                      <form action="/api/cliente" method="post">
                        <input type="hidden" name="cliente" value={l.id} />
                        <input type="hidden" name="volta" value={volta} />
                        <button className="font-medium text-texto hover:text-marca hover:underline">{l.nome}</button>
                      </form>
                    </td>
                    {COLUNAS.map((c) => (
                      <td key={c.k} className="num text-right">
                        {c.fmt(l[c.k] as number | null)}
                        {c.k === "faturamento" && v != null && (
                          <span className={`ml-1.5 text-[11px] ${v >= 0 ? "text-sucesso" : "text-perigo"}`}>
                            {v >= 0 ? "▲" : "▼"}
                            {fmtPct(Math.abs(v))}
                          </span>
                        )}
                      </td>
                    ))}
                    <td>
                      {l.alertas.length ? (
                        <span className="inline-flex items-center gap-1 text-xs text-alerta" title={l.alertas.join(" · ")}>
                          <AlertTriangle size={13} /> {l.alertas.join(" · ")}
                        </span>
                      ) : (
                        <span className="text-xs text-texto-3">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {visiveis.length === 0 && <p className="py-10 text-center text-sm text-texto-3">Nenhum cliente encontrado.</p>}
        </div>
        <p className="mt-3 text-xs text-texto-3">Clique no nome para abrir a visão geral do cliente. A variação do faturamento compara com o período anterior de mesmo tamanho.</p>
      </div>
    </div>
  );
}
