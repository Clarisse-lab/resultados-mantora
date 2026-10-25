import { NextResponse } from "next/server";
import { clienteAtual, sessaoAtual } from "@/lib/auth";
import { cidadesDaUf, lerFiltros } from "@/lib/metricas";

export async function GET(req: Request) {
  const s = await sessaoAtual();
  if (!s) return NextResponse.json({ erro: "não autenticado" }, { status: 401 });
  const { atual } = await clienteAtual(s);
  if (!atual) return NextResponse.json([]);
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const uf = String(sp.uf ?? "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(uf)) return NextResponse.json({ erro: "uf inválida" }, { status: 400 });
  return NextResponse.json(await cidadesDaUf(atual.id, lerFiltros(sp), uf));
}
