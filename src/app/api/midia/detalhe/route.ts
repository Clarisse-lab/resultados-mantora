import { NextResponse } from "next/server";
import { clienteAtual, sessaoAtual } from "@/lib/auth";
import { lerFiltros, topMidias, type Nivel, type OrdemTop } from "@/lib/metricas";
import { criativoDoAnuncio, statusDoObjeto } from "@/lib/integracoes/criativos";

const ORDENS: OrdemTop[] = ["leads", "vendas", "faturamento", "investido", "roas", "cpl", "cpa", "ctr", "impressoes", "cliques"];

// Detalhe de um item do Top mídias: o criativo (do próprio anúncio ou, para campanha/conjunto,
// do anúncio com melhor resultado dentro dele na métrica escolhida) e o status.
export async function GET(req: Request) {
  const s = await sessaoAtual();
  if (!s) return NextResponse.json({ erro: "não autenticado" }, { status: 401 });
  const { atual } = await clienteAtual(s);
  if (!atual) return NextResponse.json({ erro: "sem cliente" }, { status: 404 });

  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const nivel = (["campanha", "conjunto", "anuncio"] as Nivel[]).find((n) => n === sp.nivel);
  const id = /^\d{5,25}$/.test(sp.id ?? "") ? sp.id : null;
  if (!nivel || !id) return NextResponse.json({ erro: "parâmetros inválidos" }, { status: 400 });
  const ordem = ORDENS.find((o) => o === sp.ordem) ?? "investido";
  const f = lerFiltros(sp);

  try {
    let anuncioId = id;
    let status: string | null = null;
    let melhorPor: OrdemTop | null = null;
    let metricas: Awaited<ReturnType<typeof topMidias>>[number] | null = null;
    if (nivel !== "anuncio") {
      const dentro = { nivel, id } as const;
      const [melhor] = await topMidias(atual.id, f, "anuncio", ordem, 1, dentro);
      melhorPor = melhor ? ordem : "investido";
      const [porGasto] = melhor ? [melhor] : await topMidias(atual.id, f, "anuncio", "investido", 1, dentro);
      if (!porGasto) return NextResponse.json({ anuncio: null, status: await statusDoObjeto(atual.id, id) });
      anuncioId = porGasto.id;
      metricas = porGasto;
      status = await statusDoObjeto(atual.id, id);
    }
    const criativo = await criativoDoAnuncio(atual.id, anuncioId);
    return NextResponse.json({ anuncio: criativo, status: status ?? criativo.status, metricas, escolhidoPor: metricas ? (melhorPor ?? null) : null });
  } catch (e) {
    return NextResponse.json({ erro: e instanceof Error ? e.message : "Não foi possível carregar o anúncio." }, { status: 502 });
  }
}
