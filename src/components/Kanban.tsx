"use client";

import { Download, MessageCircle, Plus, Search, Settings2, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import type { CartaoLead, Etapa } from "@/lib/comercial";
import { fmtDataHora, fmtInteiro, fmtMoeda, fmtPct, fmtTelefone } from "@/lib/formato";
import { criarLeadManual, moverLead, salvarEtapas, salvarLead } from "@/app/(painel)/comercial/acoes";
import { Portal } from "./Portal";

const POR_COLUNA = 40;

type Props = { etapas: Etapa[]; leads: CartaoLead[]; motivos: string[]; sdrs: string[]; equipe: boolean };

export function Kanban({ etapas, leads: inicial, motivos, sdrs, equipe }: Props) {
  const router = useRouter();
  const caminho = usePathname();
  const busca = useSearchParams();
  const [leads, setLeads] = useState(inicial);
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);
  const [aberto, setAberto] = useState<CartaoLead | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [limite, setLimite] = useState<Record<string, number>>({});
  const [modal, setModal] = useState<"novo" | "etapas" | null>(null);
  const [texto, setTexto] = useState(busca.get("q") ?? "");
  const [, iniciar] = useTransition();

  useEffect(() => setLeads(inicial), [inicial]);
  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 4000);
    return () => clearTimeout(t);
  }, [aviso]);
  useEffect(() => {
    const t = setTimeout(() => {
      if ((busca.get("q") ?? "") === texto) return;
      const p = new URLSearchParams(busca.toString());
      texto ? p.set("q", texto) : p.delete("q");
      router.replace(`${caminho}?${p}`, { scroll: false });
    }, 350);
    return () => clearTimeout(t);
  }, [texto, busca, caminho, router]);

  const porEtapa = useMemo(() => {
    const m = new Map<string, CartaoLead[]>(etapas.map((e) => [e.chave, []]));
    for (const l of leads) (m.get(l.etapa) ?? m.get("lead"))!.push(l);
    return m;
  }, [leads, etapas]);

  const podeReceber = (e: Etapa) => !e.estrutural || e.chave === "lead";

  // Quem está numa etapa passou por todas as anteriores: a conversão compara os que
  // chegaram até aqui (esta etapa e as seguintes) com os que chegaram até a anterior.
  const alcancaram = etapas.map((_, i) => etapas.slice(i).reduce((s, e) => s + (porEtapa.get(e.chave)?.length ?? 0), 0));

  function mover(id: string, etapa: string) {
    const lead = leads.find((l) => l.id === id);
    if (!lead || lead.etapa === etapa) return;
    if (lead.etapa === "venda" || lead.etapa === "checkout") {
      setAviso("Este lead já tem checkout ou venda registrada; a etapa vem do dado real.");
      return;
    }
    const antes = leads;
    setLeads(leads.map((l) => (l.id === id ? { ...l, etapa } : l)));
    iniciar(async () => {
      const r = await moverLead(id, etapa);
      if (!r.ok) {
        setLeads(antes);
        setAviso(r.erro);
      }
    });
  }

  function exportarCsv() {
    const cab = ["etapa", "criado_em", "nome", "telefone", "email", "origem", "campanha", "sdr", "motivo_perda", "valor"];
    const linhas = leads.map((l) =>
      [etapas.find((e) => e.chave === l.etapa)?.rotulo ?? l.etapa, new Date(l.criado_em).toISOString(), l.nome, l.telefone, l.email, l.origem, l.campanha, l.sdr, l.motivo_perda, l.valor]
        .map((v) => {
          const s = v == null ? "" : String(v);
          const seguro = /^[=+\-@]/.test(s) ? `'${s}` : s;
          return /[";\n]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
        })
        .join(";"),
    );
    const blob = new Blob(["﻿" + [cab.join(";"), ...linhas].join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "pipeline-comercial.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="cartao p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-lg font-semibold">Pipeline comercial</h2>
        <label className="relative">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-texto-3" />
          <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Nome, telefone, SDR, campanha…" className="controle w-60 pl-8" />
        </label>
        <button className="botao" onClick={() => setModal("novo")}>
          <Plus size={14} /> Novo lead
        </button>
        {equipe && (
          <button className="botao-sec" onClick={() => setModal("etapas")}>
            <Settings2 size={14} /> Etapas
          </button>
        )}
        <button className="botao-sec" onClick={exportarCsv} disabled={!leads.length}>
          <Download size={14} /> CSV
        </button>
      </div>

      <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
        {etapas.map((e, i) => {
          const cartoes = porEtapa.get(e.chave) ?? [];
          const anterior = i > 0 ? alcancaram[i - 1] : null;
          const soma = cartoes.reduce((s, c) => s + (c.valor ?? 0), 0);
          const max = limite[e.chave] ?? POR_COLUNA;
          return (
            <section
              key={e.chave}
              aria-label={e.rotulo}
              onDragOver={(ev) => {
                if (podeReceber(e)) {
                  ev.preventDefault();
                  setSobre(e.chave);
                }
              }}
              onDragLeave={() => setSobre(null)}
              onDrop={(ev) => {
                ev.preventDefault();
                setSobre(null);
                if (arrastando) mover(arrastando, e.chave);
                setArrastando(null);
              }}
              className={`flex w-72 shrink-0 flex-col rounded-xl border bg-superficie-2/40 ${sobre === e.chave ? "border-marca" : "border-borda"}`}
            >
              <header className="border-b border-borda px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <span className="h-2 w-2 rounded-full" style={{ background: e.estrutural && e.chave !== "lead" ? "var(--marca-2)" : "var(--marca)" }} />
                    {e.rotulo}
                  </span>
                  <span className="num text-sm">{fmtInteiro(cartoes.length)}</span>
                </div>
                <div className="mt-1 flex justify-between text-[11px] text-texto-3">
                  <span>{anterior ? `${fmtPct(alcancaram[i] / anterior)} chegaram aqui` : e.estrutural && e.chave !== "lead" ? "automático" : " "}</span>
                  {soma > 0 && <span className="num">{fmtMoeda(soma)}</span>}
                </div>
              </header>
              <div className="flex max-h-[62vh] flex-col gap-2 overflow-y-auto p-2">
                {cartoes.slice(0, max).map((c) => (
                  <article
                    key={c.id}
                    draggable={c.etapa !== "venda" && c.etapa !== "checkout"}
                    onDragStart={() => setArrastando(c.id)}
                    onDragEnd={() => setArrastando(null)}
                    onClick={() => setAberto(c)}
                    className={`cursor-pointer rounded-lg border border-borda bg-superficie p-3 hover:border-borda-forte ${arrastando === c.id ? "opacity-50" : ""} ${c.motivo_perda ? "opacity-60" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-[13px] font-semibold">{c.nome ?? "Sem nome"}</p>
                      {c.valor != null && <span className="num shrink-0 text-[12px] text-sucesso">{fmtMoeda(c.valor)}</span>}
                    </div>
                    {c.campanha && <p className="mt-0.5 truncate text-[11px] text-texto-3">{c.campanha}</p>}
                    <p className="num mt-1 text-[11px] text-texto-2">{fmtTelefone(c.telefone)}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10.5px]">
                      <span className={`rounded px-1.5 py-0.5 ${c.categoria === "pago" ? "bg-marca-suave text-texto" : "bg-superficie-2 text-texto-2"}`}>{c.origem}</span>
                      {c.ctwa && <span className="rounded bg-superficie-2 px-1.5 py-0.5 text-texto-2">CTWA</span>}
                      {c.motivo_perda && <span className="rounded bg-perigo/15 px-1.5 py-0.5 text-perigo">Perdido</span>}
                    </div>
                    <div className="mt-2 flex justify-between text-[10.5px] text-texto-3">
                      <span>{c.sdr ?? "Sem SDR"}</span>
                      <span>{new Date(c.criado_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" })}</span>
                    </div>
                  </article>
                ))}
                {cartoes.length > max && (
                  <button className="py-2 text-xs text-texto-3 hover:text-texto" onClick={() => setLimite({ ...limite, [e.chave]: max + POR_COLUNA })}>
                    Mostrar mais ({fmtInteiro(cartoes.length - max)} restantes)
                  </button>
                )}
                {cartoes.length === 0 && <p className="rounded-lg border border-dashed border-borda py-6 text-center text-xs text-texto-3">Sem leads</p>}
              </div>
            </section>
          );
        })}
      </div>

      {aviso && (
        <Portal>
          <div role="status" className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-borda bg-superficie-2 px-4 py-2.5 text-sm shadow-xl">
            {aviso}
          </div>
        </Portal>
      )}
      {aberto && (
        <DetalheLead
          lead={aberto}
          etapas={etapas}
          motivos={motivos}
          sdrs={sdrs}
          onFechar={() => setAberto(null)}
          onMover={(etapa) => {
            mover(aberto.id, etapa);
            setAberto({ ...aberto, etapa });
          }}
          onSalvo={(dados) => setLeads(leads.map((l) => (l.id === aberto.id ? { ...l, ...dados } : l)))}
        />
      )}
      {modal === "novo" && <NovoLead sdrs={sdrs} onFechar={() => setModal(null)} onErro={setAviso} />}
      {modal === "etapas" && <GerenciarEtapas etapas={etapas} onFechar={() => setModal(null)} onErro={setAviso} />}
    </div>
  );
}

function Gaveta({ titulo, onFechar, children }: { titulo: string; onFechar: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onFechar]);
  return (
    <Portal>
    <div className="fixed inset-0 z-40" role="dialog" aria-label={titulo}>
      <div className="absolute inset-0 bg-black/55" onClick={onFechar} />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-borda bg-superficie">
        <header className="flex items-center justify-between border-b border-borda px-5 py-4">
          <h3 className="font-semibold">{titulo}</h3>
          <button onClick={onFechar} aria-label="Fechar" className="text-texto-3 hover:text-texto">
            <X size={18} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </aside>
    </div>
    </Portal>
  );
}

function DetalheLead({
  lead, etapas, motivos, sdrs, onFechar, onMover, onSalvo,
}: {
  lead: CartaoLead; etapas: Etapa[]; motivos: string[]; sdrs: string[];
  onFechar: () => void; onMover: (etapa: string) => void; onSalvo: (d: Partial<CartaoLead>) => void;
}) {
  const [sdr, setSdr] = useState(lead.sdr ?? "");
  const [motivo, setMotivo] = useState(lead.motivo_perda ?? "");
  const [obs, setObs] = useState(lead.observacao ?? "");
  const [estado, setEstado] = useState<"" | "salvando" | "salvo">("");
  const travado = lead.etapa === "venda" || lead.etapa === "checkout";
  const linha = (r: string, v: React.ReactNode) => (
    <div className="flex justify-between gap-4 border-b border-borda py-2 text-sm">
      <span className="text-texto-3">{r}</span>
      <span className="text-right">{v}</span>
    </div>
  );
  return (
    <Gaveta titulo={lead.nome ?? "Lead"} onFechar={onFechar}>
      {lead.telefone && (
        <a href={`https://wa.me/55${lead.telefone}`} target="_blank" rel="noreferrer" className="botao mb-4 w-full justify-center">
          <MessageCircle size={15} /> Abrir no WhatsApp
        </a>
      )}
      {linha("Telefone", <span className="num">{fmtTelefone(lead.telefone)}</span>)}
      {linha("E-mail", lead.email ?? "—")}
      {linha("Entrou em", fmtDataHora(lead.criado_em))}
      {linha("Origem", lead.origem)}
      {linha("Campanha", lead.campanha || "—")}
      {lead.ctwa && linha("Click-to-WhatsApp", "Sim (tem ctwaclid)")}
      {lead.valor != null && linha(lead.etapa === "venda" ? "Venda" : "Checkout", `${fmtMoeda(lead.valor)}${lead.produto ? ` · ${lead.produto}` : ""}`)}

      <label className="mt-5 block">
        <span className="rotulo mb-1 block">Etapa</span>
        <select className="controle w-full" value={lead.etapa} disabled={travado} onChange={(e) => onMover(e.target.value)}>
          {etapas.map((e) => (
            <option key={e.chave} value={e.chave} disabled={e.estrutural && e.chave !== "lead"}>
              {e.rotulo}
              {e.estrutural && e.chave !== "lead" ? " (automático)" : ""}
            </option>
          ))}
        </select>
        {travado && <span className="mt-1 block text-xs text-texto-3">Etapa definida pela plataforma de venda.</span>}
      </label>
      <label className="mt-4 block">
        <span className="rotulo mb-1 block">SDR responsável</span>
        <input className="controle w-full" list="lista-sdrs" value={sdr} onChange={(e) => setSdr(e.target.value)} placeholder="Nome do SDR" />
        <datalist id="lista-sdrs">
          {sdrs.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </label>
      <label className="mt-4 block">
        <span className="rotulo mb-1 block">Motivo de perda</span>
        <select className="controle w-full" value={motivo} onChange={(e) => setMotivo(e.target.value)}>
          <option value="">Não perdido</option>
          {motivos.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </label>
      <label className="mt-4 block">
        <span className="rotulo mb-1 block">Observações</span>
        <textarea className="controle h-28 w-full py-2" value={obs} onChange={(e) => setObs(e.target.value)} />
      </label>
      <button
        className="botao mt-4"
        disabled={estado === "salvando"}
        onClick={async () => {
          setEstado("salvando");
          await salvarLead(lead.id, { sdr, motivo_perda: motivo || null, observacao: obs });
          onSalvo({ sdr: sdr || null, motivo_perda: motivo || null, observacao: obs || null });
          setEstado("salvo");
        }}
      >
        {estado === "salvando" ? "Salvando…" : estado === "salvo" ? "Salvo ✓" : "Salvar"}
      </button>
    </Gaveta>
  );
}

function NovoLead({ sdrs, onFechar, onErro }: { sdrs: string[]; onFechar: () => void; onErro: (m: string) => void }) {
  const [enviando, setEnviando] = useState(false);
  return (
    <Gaveta titulo="Novo lead" onFechar={onFechar}>
      <form
        className="flex flex-col gap-3"
        action={async (f) => {
          setEnviando(true);
          const r = await criarLeadManual(f);
          setEnviando(false);
          if (r.ok) onFechar();
          else onErro(r.erro);
        }}
      >
        <input name="nome" placeholder="Nome do lead" className="controle" />
        <input name="telefone" required placeholder="Telefone com DDD *" className="controle" inputMode="tel" />
        <input name="email" type="email" placeholder="E-mail" className="controle" />
        <input name="origem" placeholder="Origem (ex.: indicação, instagram)" className="controle" />
        <input name="sdr" list="lista-sdrs-novo" placeholder="SDR" className="controle" />
        <datalist id="lista-sdrs-novo">
          {sdrs.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
        <button className="botao mt-2 justify-center" disabled={enviando}>
          {enviando ? "Criando…" : "Criar lead"}
        </button>
      </form>
    </Gaveta>
  );
}

function GerenciarEtapas({ etapas, onFechar, onErro }: { etapas: Etapa[]; onFechar: () => void; onErro: (m: string) => void }) {
  const [lista, setLista] = useState(etapas.map((e) => ({ chave: e.chave, rotulo: e.rotulo, estrutural: e.estrutural })));
  const [nova, setNova] = useState("");
  const [salvando, setSalvando] = useState(false);
  const mover = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= lista.length) return;
    const l = [...lista];
    [l[i], l[j]] = [l[j], l[i]];
    setLista(l);
  };
  return (
    <Gaveta titulo="Etapas do funil" onFechar={onFechar}>
      <p className="mb-4 text-xs text-texto-3">Lead, Checkout e Venda são estruturais: vêm do dado real e não podem ser removidas.</p>
      <ul className="space-y-2">
        {lista.map((e, i) => (
          <li key={e.chave} className="flex items-center gap-2">
            <input
              className="controle flex-1"
              value={e.rotulo}
              maxLength={40}
              onChange={(ev) => setLista(lista.map((x, k) => (k === i ? { ...x, rotulo: ev.target.value } : x)))}
            />
            <button className="botao-sec !px-2" onClick={() => mover(i, -1)} aria-label="Subir etapa">↑</button>
            <button className="botao-sec !px-2" onClick={() => mover(i, 1)} aria-label="Descer etapa">↓</button>
            <button
              className="botao-sec !px-2 disabled:opacity-30"
              disabled={e.estrutural}
              onClick={() => setLista(lista.filter((_, k) => k !== i))}
              aria-label="Remover etapa"
            >
              <X size={14} />
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex gap-2">
        <input className="controle flex-1" placeholder="Nova etapa (ex.: Proposta)" value={nova} maxLength={40} onChange={(e) => setNova(e.target.value)} />
        <button
          className="botao-sec"
          onClick={() => {
            const chave = nova.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 30);
            if (!chave || lista.some((e) => e.chave === chave)) return onErro("Nome inválido ou repetido.");
            const iCheckout = lista.findIndex((e) => e.chave === "checkout");
            const l = [...lista];
            l.splice(iCheckout < 0 ? l.length : iCheckout, 0, { chave, rotulo: nova.trim(), estrutural: false });
            setLista(l);
            setNova("");
          }}
        >
          Adicionar
        </button>
      </div>
      <button
        className="botao mt-5"
        disabled={salvando}
        onClick={async () => {
          setSalvando(true);
          const r = await salvarEtapas(lista.map(({ chave, rotulo }) => ({ chave, rotulo })));
          setSalvando(false);
          if (r.ok) onFechar();
          else onErro(r.erro);
        }}
      >
        {salvando ? "Salvando…" : "Salvar etapas"}
      </button>
    </Gaveta>
  );
}
