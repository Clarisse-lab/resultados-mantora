"use client";

import { createContext, useContext } from "react";

type Valor = { clientes: { id: string; nome: string }[]; atual: string | null };
const Ctx = createContext<Valor>({ clientes: [], atual: null });

// O layout do painel conhece os clientes do usuário; as barras de filtro de cada tela leem daqui.
export function ClientesProvider({ valor, children }: { valor: Valor; children: React.ReactNode }) {
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export const useClientes = () => useContext(Ctx);
