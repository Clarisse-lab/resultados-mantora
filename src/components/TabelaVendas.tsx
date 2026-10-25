"use client";

import { ArrowDown, ArrowUp, Columns3, Download, Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { LinhaVenda } from "@/lib/vendas";
import { fmtDataHora, fmtMoeda, fmtTelefone } from "@/lib/formato";

type Coluna = { k: string; rotulo: string; padrao: boolean; render: (v: LinhaVenda) => React.ReactNode; valor: (v: LinhaVenda) => string | number };

const STATUS_COR: Record<string, string> = {
  aprovada: "text-sucesso", reembolsada: "text-alerta", chargeback: "text-perigo",
  cancelada: "text-texto-3", pendente: "text-texto-2", recusada: "text-texto-3",
};

const COLUNAS: Coluna[] = [
  { k: "data", rotulo: "Data", padrao: true, render: (v) => fmtDataHora(v.data), valor: (v) => new Date(v.data).getTime() },
  { k: "nome", rotulo: "Cliente", padrao: true, render: (v) => v.nome ?? "—", valor: (v) => v.nome ?? "" },
  { k: "telefone", rotulo: "Telefone", padrao: true, render: (v) => fmtTelefone(v.telefone), valor: (v) => v.telefone ?? "" },
  { k: "email", rotulo: "E-mail", padrao: false, render: (v) => v.email ?? "—", valor: (v) => v.email ?? "" },
  { k: "valor", rotulo: "Valor", padrao: true, render: (v) => <span className="num">{fmtMoeda(v.valor)}</span>, valor: (v) => v.valor },
  { k: "produto", rotulo: "Produto", padrao: true, render: (v) => v.produto ?? "—", valor: (v) => v.produto ?? "" },
  { k: "status", rotulo: "Status", padrao: true, render: (v) => <span className={STATUS_COR[v.status]}>{v.status}</span>, valor: (v) => v.status },
  { k: "origem", rotulo: "Origem", padrao: true, render: (v) => v.origem, valor: (v) => v.origem },
  { k: "categoria", rotulo: "Categoria", padrao: true, render: (v) => v.categoria, valor: (v) => v.categoria },
  { k: "contexto", rotulo: "Funil", padrao: false, render: (v) => (v.contexto === "lancamento" ? "Lançamento" : "Perpétuo"), valor: (v) => v.contexto },
  { k: "uf", rotulo: "Cidade/UF", padrao: false, render: (v) => [v.cidade, v.uf].filter(Boolean).join("/") || "—", valor: (v) => `${v.uf ?? ""}${v.cidade ?? ""}` },
  { k: "plataforma", rotulo: "Plataforma", padrao: false, render: (v) => v.provedor, valor: (v) => v.provedor },
  { k: "metodo", rotulo: "Pagamento", padrao: false, render: (v) => v.metodo ?? "—", valor: (v) => v.metodo ?? "" },
  { k: "utm_campaign", rotulo: "Campanha (UTM)", padrao: false, render: (v) => v.utm_campaign ?? "—", valor: (v) => v.utm_campaign ?? "" },
  { k: "utm_medium", rotulo: "Conjunto (UTM)", padrao: false, render: (v) => v.utm_medium ?? "—", valor: (v) => v.utm_medium ?? "" },
  { k: "utm_content", rotulo: "Anúncio (UTM)", padrao: false, render: (v) => v.utm_content ?? "—", valor: (v) => v.utm_content ?? "" },
  { k: "utm_source", rotulo: "UTM Source", padrao: false, render: (v) => v.utm_source ?? "—", valor: (v) => v.utm_source ?? "" },
  { k: "utm_term", rotulo: "UTM Term", padrao: false, render: (v) => v.utm_term ?? "—", valor: (v) => v.utm_term ?? "" },
];

const CHAVE = "vendas.colunas";

export function TabelaVendas({ linhas, resumo }: { linhas: LinhaVenda[]; resumo: string }) {
  const router = useRouter();
  const caminho = usePathname();
  const busca = useSearchParams();
  const [visiveis, setVisiveis] = useState<string[]>(COLUNAS.filter((c) => c.padrao).map((c) => c.k));
  const [painel, setPainel] = useState(false);
  const [ordem, setOrdem] = useState<{ k: string; desc: boolean }>({ k: "data", desc: true });
  const [texto, setTexto] = useState(busca.get("q") ?? "");

  useEffect(() => {
    try {
      const salvo = JSON.parse(localStorage.getItem(CHAVE) ?? "null");
      if (Array.isArray(salvo) && salvo.length) setVisiveis(salvo);
    } catch {}
  }, []);
  const alternar = (k: string) => {
    const novo = visiveis.includes(k) ? visiveis.filter((x) => x !== k) : COLUNAS.map((c) => c.k).filter((x) => x === k || visiveis.includes(x));
    if (!novo.length) return;
    setVisiveis(novo);
    try {
      localStorage.setItem(CHAVE, JSON.stringify(novo));
    } catch {}
  };

  // Busca vai para o servidor (debounce), para valer também no CSV
  useEffect(() => {
    const t = setTimeout(() => {
      if ((busca.get("q") ?? "") === texto) return;
      const p = new URLSearchParams(busca.toString());
      texto ? p.set("q", texto) : p.delete("q");
      router.replace(`${caminho}?${p}`, { scroll: false });
    }, 350);
    return () => clearTimeout(t);
  }, [texto, busca, caminho, router]);

  const cols = COLUNAS.filter((c) => visiveis.includes(c.k));
  const ordenadas = useMemo(() => {
    const col = COLUNAS.find((c) => c.k === ordem.k)!;
    return [...linhas].sort((a, b) => {
      const x = col.valor(a);
      const y = col.valor(b);
      const r = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "pt-BR");
      return ordem.desc ? -r : r;
    });
  }, [linhas, ordem]);

  const status = busca.get("status") ?? "aprovada";
  const setStatus = (s: string) => {
    const p = new URLSearchParams(busca.toString());
    s === "aprovada" ? p.delete("status") : p.set("status", s);
    router.replace(`${caminho}?${p}`, { scroll: false });
  };

  return (
    <div className="cartao p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-lg font-semibold">
          Vendas detalhadas <span className="text-sm font-normal text-texto-3">{linhas.length} {linhas.length === 1 ? "venda" : "vendas"}</span>
        </h2>
        <label className="relative">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-texto-3" />
          <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar cliente, produto, campanha…" className="controle w-64 pl-8" />
        </label>
        <select className="controle" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="aprovada">Aprovadas</option>
          <option value="reembolsada">Reembolsadas</option>
          <option value="chargeback">Chargeback</option>
          <option value="pendente">Pendentes</option>
          <option value="cancelada">Canceladas</option>
          <option value="recusada">Recusadas</option>
          <option value="todas">Todas</option>
        </select>
        <div className="relative">
          <button className="botao-sec" onClick={() => setPainel(!painel)}>
            <Columns3 size={14} /> Colunas <span className="text-texto-3">{COLUNAS.length - cols.length} ocultas</span>
          </button>
          {painel && (
            <div className="absolute right-0 z-10 mt-1 w-56 rounded-xl border border-borda bg-superficie-2 p-2 shadow-xl">
              {COLUNAS.map((c) => (
                <label key={c.k} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-[13px] hover:bg-superficie">
                  <input type="checkbox" checked={visiveis.includes(c.k)} onChange={() => alternar(c.k)} className="accent-[var(--marca)]" />
                  {c.rotulo}
                </label>
              ))}
            </div>
          )}
        </div>
        <a className="botao-sec" href={`/api/vendas/csv?${busca}`}>
          <Download size={14} /> CSV
        </a>
      </div>
      <p className="mt-3 inline-block rounded-full border border-borda px-3 py-1 text-[11px] text-texto-3">{resumo}</p>

      <div className="mt-4 max-h-[70vh] overflow-auto">
        <table className="tabela w-full">
          <thead>
            <tr>
              {cols.map((c) => (
                <th key={c.k}>
                  <button className="inline-flex items-center gap-1 hover:text-texto" onClick={() => setOrdem({ k: c.k, desc: ordem.k === c.k ? !ordem.desc : true })}>
                    {c.rotulo}
                    {ordem.k === c.k && (ordem.desc ? <ArrowDown size={12} /> : <ArrowUp size={12} />)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ordenadas.map((v) => (
              <tr key={v.id}>
                {cols.map((c) => (
                  <td key={c.k}>{c.render(v)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {linhas.length === 0 && <p className="py-12 text-center text-sm text-texto-3">Nenhuma venda no período com esses filtros.</p>}
      </div>
    </div>
  );
}
