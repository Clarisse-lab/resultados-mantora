import { clienteAtual, sessaoAtual } from "@/lib/auth";
import { lerFiltros } from "@/lib/metricas";
import { listarVendas } from "@/lib/vendas";

const COLUNAS = ["data", "nome", "telefone", "email", "valor", "produto", "status", "provedor", "origem", "categoria", "contexto", "uf", "cidade", "metodo", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

function celula(v: unknown) {
  if (v == null) return "";
  const s = v instanceof Date ? v.toISOString() : typeof v === "number" ? String(v).replace(".", ",") : String(v);
  // Evita que o Excel interprete o texto como fórmula
  const seguro = /^[=+\-@]/.test(s) && typeof v !== "number" ? `'${s}` : s;
  return /[";\n]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}

export async function GET(req: Request) {
  const s = await sessaoAtual();
  if (!s) return new Response("não autenticado", { status: 401 });
  const { atual } = await clienteAtual(s);
  if (!atual) return new Response("sem cliente", { status: 404 });
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const f = lerFiltros(sp);
  const linhas = await listarVendas(atual.id, f, { busca: sp.q, status: sp.status, limite: 50000 });
  // ";" e BOM: abre direto no Excel em português
  const csv = "﻿" + [COLUNAS.join(";"), ...linhas.map((l) => COLUNAS.map((c) => celula(l[c])).join(";"))].join("\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="vendas-${atual.slug}-${f.from}-a-${f.to}.csv"`,
    },
  });
}
