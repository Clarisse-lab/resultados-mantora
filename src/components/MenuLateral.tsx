"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { BarChart3, Building2, KanbanSquare, LogOut, Menu, Receipt, TrendingUp, X } from "lucide-react";
import { useState } from "react";
import { Marca } from "./Marca";

type Props = {
  email: string;
  equipe: boolean;
  clientes: { id: string; nome: string }[];
  clienteAtual: string | null;
};

export function MenuLateral({ email, equipe, clientes, clienteAtual }: Props) {
  const caminho = usePathname();
  const busca = useSearchParams();
  const [aberto, setAberto] = useState(false);
  // Mantém o período escolhido ao trocar de página
  const periodo = new URLSearchParams();
  for (const k of ["from", "to", "recorte", "categoria", "granularidade"]) {
    const v = busca.get(k);
    if (v) periodo.set(k, v);
  }
  const q = periodo.toString() ? `?${periodo}` : "";

  const itens = [
    { href: "/visao-geral", rotulo: "Visão geral", icone: BarChart3, comFiltro: true },
    { href: "/vendas", rotulo: "Vendas detalhadas", icone: Receipt, comFiltro: true },
    { href: "/comercial", rotulo: "Kanban comercial", icone: KanbanSquare, comFiltro: true, exato: true },
    { href: "/comercial/ascensao", rotulo: "LTV Ascensão", icone: TrendingUp, comFiltro: false },
    ...(equipe ? [{ href: "/admin/clientes", rotulo: "Clientes e integrações", icone: Building2, comFiltro: false }] : []),
  ];

  const conteudo = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between px-5">
        <Marca />
        <button className="text-texto-3 lg:hidden" onClick={() => setAberto(false)} aria-label="Fechar menu">
          <X size={20} />
        </button>
      </div>

      {clientes.length > 1 && (
        <form action="/api/cliente" method="post" className="px-4 pb-3">
          <input type="hidden" name="volta" value={caminho + (busca.toString() ? `?${busca}` : "")} />
          <label className="rotulo mb-1.5 block">Cliente</label>
          <select
            name="cliente"
            defaultValue={clienteAtual ?? undefined}
            onChange={(e) => e.currentTarget.form?.requestSubmit()}
            className="controle w-full"
          >
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </form>
      )}

      <nav className="flex-1 space-y-0.5 px-3 pt-2" aria-label="Navegação principal">
        <p className="rotulo px-2 pb-2">Painel</p>
        {itens.map(({ href, rotulo, icone: Icone, comFiltro, ...resto }) => {
          const ativo = caminho === href || (!("exato" in resto) && caminho.startsWith(`${href}/`));
          return (
            <Link
              key={href}
              href={comFiltro ? href + q : href}
              onClick={() => setAberto(false)}
              className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] ${
                ativo ? "bg-marca-suave font-semibold text-texto" : "text-texto-2 hover:bg-superficie-2 hover:text-texto"
              }`}
            >
              <Icone size={16} className={ativo ? "text-marca" : ""} />
              {rotulo}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-borda p-4">
        <p className="truncate text-xs text-texto-3" title={email}>
          {email}
        </p>
        <form action="/api/auth/sair" method="post">
          <button className="mt-2 flex items-center gap-2 text-[13px] text-texto-2 hover:text-texto">
            <LogOut size={15} /> Sair
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <>
      <button
        className="fixed left-3 top-3 z-30 grid h-10 w-10 place-items-center rounded-lg border border-borda bg-superficie lg:hidden"
        onClick={() => setAberto(true)}
        aria-label="Abrir menu"
      >
        <Menu size={18} />
      </button>
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-r border-borda bg-superficie lg:block">{conteudo}</aside>
      {aberto && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setAberto(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 border-r border-borda bg-superficie">{conteudo}</aside>
        </div>
      )}
    </>
  );
}
