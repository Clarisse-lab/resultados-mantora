"use client";

import { Building2 } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useClientes } from "./ClientesContexto";

// Troca o cliente visto mantendo a tela e os filtros atuais.
export function SeletorCliente() {
  const { clientes, atual } = useClientes();
  const caminho = usePathname();
  const busca = useSearchParams();
  if (clientes.length === 0) return null;
  if (clientes.length === 1) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg bg-marca-suave px-3 py-1.5 text-sm font-medium">
        <Building2 size={14} className="text-marca" /> {clientes[0].nome}
      </span>
    );
  }
  return (
    <form action="/api/cliente" method="post" className="relative">
      <input type="hidden" name="volta" value={caminho + (busca.toString() ? `?${busca}` : "")} />
      <Building2 size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-marca" />
      <select
        name="cliente"
        aria-label="Cliente"
        defaultValue={atual ?? undefined}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="controle max-w-[16rem] bg-marca-suave pl-8 font-medium"
      >
        {clientes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nome}
          </option>
        ))}
      </select>
    </form>
  );
}
