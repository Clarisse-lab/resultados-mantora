"use client";

import { MessageCircle, Search } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import type { ClienteAscensao } from "@/lib/ascensao";
import { ETAPAS_ASCENSAO } from "@/lib/ascensao-etapas";
import { fmtDataHora, fmtInteiro, fmtMoeda, fmtTelefone } from "@/lib/formato";
import { moverAscensao, salvarAscensao } from "@/app/(painel)/comercial/acoes";
import { Portal } from "./Portal";

const COLUNAS = [
  { id: "alta", rotulo: "Prioridade alta", etapa: "fila" },
  { id: "media", rotulo: "Prioridade média", etapa: "fila" },
  { id: "baixa", rotulo: "Prioridade baixa", etapa: "fila" },
  ...ETAPAS_ASCENSAO.map((e) => ({ id: e.chave, rotulo: e.rotulo, etapa: e.chave })),
] as const;
const POR_COLUNA = 30;

function colunaDe(c: ClienteAscensao) {
  return c.etapa === "fila" ? c.prioridade : c.etapa;
}

export function Carteira({ clientes: inicial, visao }: { clientes: ClienteAscensao[]; visao: "quadro" | "tabela" }) {
  const router = useRouter();
  const caminho = usePathname();
  const busca = useSearchParams();
  const [clientes, setClientes] = useState(inicial);
  const [texto, setTexto] = useState(busca.get("q") ?? "");
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [limite, setLimite] = useState<Record<string, number>>({});
  const [aberto, setAberto] = useState<ClienteAscensao | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [, iniciar] = useTransition();

  useEffect(() => setClientes(inicial), [inicial]);
  useEffect(() => {
    const t = setTimeout(() => {
      if ((busca.get("q") ?? "") === texto) return;
      const p = new URLSearchParams(busca.toString());
      texto ? p.set("q", texto) : p.delete("q");
      router.replace(`${caminho}?${p}`, { scroll: false });
    }, 350);
    return () => clearTimeout(t);
  }, [texto, busca, caminho, router]);

  const porColuna = useMemo(() => {
    const m = new Map<string, ClienteAscensao[]>(COLUNAS.map((c) => [c.id, []]));
    for (const c of clientes) m.get(colunaDe(c))?.push(c);
    return m;
  }, [clientes]);

  function mover(pessoa: string, etapa: string) {
    const antes = clientes;
    setClientes(clientes.map((c) => (c.pessoa === pessoa ? { ...c, etapa: etapa as ClienteAscensao["etapa"] } : c)));
    iniciar(async () => {
      const r = await moverAscensao(pessoa, etapa);
      if (!r.ok) {
        setClientes(antes);
        setAviso(r.erro);
        setTimeout(() => setAviso(null), 4000);
      }
    });
  }

  const link = (v: string) => {
    const p = new URLSearchParams(busca.toString());
    p.set("visao", v);
    return `${caminho}?${p}`;
  };

  return (
    <div className="cartao p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-lg font-semibold">Carteira</h2>
        <label className="relative">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-texto-3" />
          <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar cliente…" className="controle w-56 pl-8" />
        </label>
        <div className="flex rounded-lg border border-borda p-0.5">
          {(["quadro", "tabela"] as const).map((v) => (
            <Link key={v} href={link(v)} className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize ${v === visao ? "bg-marca-suave text-texto" : "text-texto-3 hover:text-texto"}`}>
              {v}
            </Link>
          ))}
        </div>
      </div>
      <p className="mt-3 text-xs text-texto-3">
        Fila de entrada por ordem de score (valor gasto, nº de compras e recência). Arraste para uma etapa ao abordar. Quem comprar de novo durante a abordagem vai sozinho para “Recomprou”.
      </p>

      {visao === "quadro" ? (
        <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
          {COLUNAS.map((col) => {
            const itens = porColuna.get(col.id) ?? [];
            const max = limite[col.id] ?? POR_COLUNA;
            return (
              <section
                key={col.id}
                aria-label={col.rotulo}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (arrastando) mover(arrastando, col.etapa);
                  setArrastando(null);
                }}
                className="flex w-64 shrink-0 flex-col rounded-xl border border-borda bg-superficie-2/40"
              >
                <header className="flex items-center justify-between border-b border-borda px-3 py-2.5 text-sm font-semibold">
                  {col.rotulo}
                  <span className="num">{fmtInteiro(itens.length)}</span>
                </header>
                <div className="flex max-h-[62vh] flex-col gap-2 overflow-y-auto p-2">
                  {itens.slice(0, max).map((c) => (
                    <article
                      key={c.pessoa}
                      draggable
                      onDragStart={() => setArrastando(c.pessoa)}
                      onClick={() => setAberto(c)}
                      className="cursor-pointer rounded-lg border border-borda bg-superficie p-3 hover:border-borda-forte"
                    >
                      <div className="flex justify-between gap-2">
                        <p className="truncate text-[13px] font-semibold">{c.nome ?? "Sem nome"}</p>
                        <span className="num rounded bg-marca-suave px-1.5 text-[11px]">{c.score.toFixed(1)}</span>
                      </div>
                      <p className="mt-1 text-[11.5px]">
                        LTV <span className="num font-semibold">{fmtMoeda(c.ltv)}</span> · {c.compras} {c.compras === 1 ? "compra" : "compras"}
                      </p>
                      <p className="mt-0.5 text-[11px] text-texto-3">Última compra há {c.dias_desde} dias</p>
                      {c.responsavel && <p className="mt-1 text-[11px] text-texto-2">{c.responsavel}</p>}
                    </article>
                  ))}
                  {itens.length > max && (
                    <button className="py-2 text-xs text-texto-3 hover:text-texto" onClick={() => setLimite({ ...limite, [col.id]: max + POR_COLUNA })}>
                      Mostrar mais ({fmtInteiro(itens.length - max)})
                    </button>
                  )}
                  {itens.length === 0 && <p className="rounded-lg border border-dashed border-borda py-6 text-center text-xs text-texto-3">Vazio</p>}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="mt-4 max-h-[70vh] overflow-auto">
          <table className="tabela w-full">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Score</th>
                <th>LTV</th>
                <th>Compras</th>
                <th>Última compra</th>
                <th>Último produto</th>
                <th>Etapa</th>
                <th>Responsável</th>
              </tr>
            </thead>
            <tbody>
              {clientes.slice(0, 1000).map((c) => (
                <tr key={c.pessoa} className="cursor-pointer" onClick={() => setAberto(c)}>
                  <td>{c.nome ?? "—"}</td>
                  <td className="num">{c.score.toFixed(1)}</td>
                  <td className="num">{fmtMoeda(c.ltv)}</td>
                  <td className="num">{c.compras}</td>
                  <td>há {c.dias_desde} dias</td>
                  <td>{c.ultimo_produto ?? "—"}</td>
                  <td>{COLUNAS.find((x) => x.id === colunaDe(c))?.rotulo}</td>
                  <td>{c.responsavel ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {clientes.length > 1000 && <p className="py-3 text-center text-xs text-texto-3">Mostrando os 1.000 maiores scores. Use a busca para achar os demais.</p>}
        </div>
      )}

      {aviso && (
        <Portal>
          <div role="status" className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-borda bg-superficie-2 px-4 py-2.5 text-sm shadow-xl">{aviso}</div>
        </Portal>
      )}
      {aberto && (
        <Detalhe
          c={aberto}
          onFechar={() => setAberto(null)}
          onMover={(etapa) => {
            mover(aberto.pessoa, etapa);
            setAberto({ ...aberto, etapa: etapa as ClienteAscensao["etapa"] });
          }}
          onSalvo={(d) => setClientes(clientes.map((x) => (x.pessoa === aberto.pessoa ? { ...x, ...d } : x)))}
        />
      )}
    </div>
  );
}

function Detalhe({ c, onFechar, onMover, onSalvo }: { c: ClienteAscensao; onFechar: () => void; onMover: (e: string) => void; onSalvo: (d: Partial<ClienteAscensao>) => void }) {
  const [resp, setResp] = useState(c.responsavel ?? "");
  const [obs, setObs] = useState(c.observacao ?? "");
  const [estado, setEstado] = useState("");
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onFechar]);
  const linha = (r: string, v: React.ReactNode) => (
    <div className="flex justify-between gap-4 border-b border-borda py-2 text-sm">
      <span className="text-texto-3">{r}</span>
      <span className="text-right">{v}</span>
    </div>
  );
  return (
    <Portal>
    <div className="fixed inset-0 z-40" role="dialog" aria-label={c.nome ?? "Cliente"}>
      <div className="absolute inset-0 bg-black/55" onClick={onFechar} />
      <aside className="absolute inset-y-0 right-0 w-full max-w-md overflow-y-auto border-l border-borda bg-superficie p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold">{c.nome ?? "Cliente"}</h3>
          <button onClick={onFechar} className="text-sm text-texto-3 hover:text-texto">fechar</button>
        </div>
        {c.telefone && (
          <a href={`https://wa.me/55${c.telefone}`} target="_blank" rel="noreferrer" className="botao mb-4 w-full justify-center">
            <MessageCircle size={15} /> Abrir no WhatsApp
          </a>
        )}
        {linha("Score", <span className="num">{c.score.toFixed(1)}</span>)}
        {linha("LTV", <span className="num">{fmtMoeda(c.ltv)}</span>)}
        {linha("Compras", c.compras)}
        {linha("Primeira compra", fmtDataHora(c.primeira))}
        {linha("Última compra", `${fmtDataHora(c.ultima)} (há ${c.dias_desde} dias)`)}
        {linha("Último produto", c.ultimo_produto ?? "—")}
        {linha("Telefone", <span className="num">{fmtTelefone(c.telefone)}</span>)}
        {linha("E-mail", c.email ?? "—")}
        <label className="mt-5 block">
          <span className="rotulo mb-1 block">Etapa</span>
          <select className="controle w-full" value={c.etapa} onChange={(e) => onMover(e.target.value)}>
            <option value="fila">Fila (prioridade {c.prioridade === "media" ? "média" : c.prioridade})</option>
            {ETAPAS_ASCENSAO.map((e) => (
              <option key={e.chave} value={e.chave}>
                {e.rotulo}
              </option>
            ))}
          </select>
        </label>
        <label className="mt-4 block">
          <span className="rotulo mb-1 block">Responsável</span>
          <input className="controle w-full" value={resp} onChange={(e) => setResp(e.target.value)} />
        </label>
        <label className="mt-4 block">
          <span className="rotulo mb-1 block">Observações</span>
          <textarea className="controle h-28 w-full py-2" value={obs} onChange={(e) => setObs(e.target.value)} />
        </label>
        <button
          className="botao mt-4"
          onClick={async () => {
            setEstado("salvando");
            await salvarAscensao(c.pessoa, { responsavel: resp, observacao: obs });
            onSalvo({ responsavel: resp || null, observacao: obs || null });
            setEstado("salvo");
          }}
        >
          {estado === "salvando" ? "Salvando…" : estado === "salvo" ? "Salvo ✓" : "Salvar"}
        </button>
      </aside>
    </div>
    </Portal>
  );
}
