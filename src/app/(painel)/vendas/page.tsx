import { clienteAtual, exigirSessao } from "@/lib/auth";
import { lerFiltros } from "@/lib/metricas";
import { listarVendas, resumoPorContexto } from "@/lib/vendas";
import { fmtDiaCurto } from "@/lib/formato";
import { BarraFiltros } from "@/components/BarraFiltros";
import { TabelaVendas } from "@/components/TabelaVendas";
import { SemCliente } from "@/components/Vazio";

export const dynamic = "force-dynamic";

export default async function Vendas({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const sessao = await exigirSessao();
  const { atual } = await clienteAtual(sessao);
  const f = lerFiltros(sp);
  const barra = <BarraFiltros titulo="Vendas detalhadas" from={f.from} to={f.to} recorte={f.recorte} categoria={f.categoria} />;
  if (!atual) return (<>{barra}<SemCliente equipe={sessao.papel === "equipe"} /></>);

  const [linhas, contextos] = await Promise.all([
    listarVendas(atual.id, f, { busca: typeof sp.q === "string" ? sp.q : undefined, status: typeof sp.status === "string" ? sp.status : undefined }),
    resumoPorContexto(atual.id, f),
  ]);
  const n = (c: string) => contextos.find((x) => x.contexto === c)?.vendas ?? 0;
  const resumo = `${fmtDiaCurto(f.from)} → ${fmtDiaCurto(f.to)} · aprovadas no período: ${n("perpetuo")} perpétuo · ${n("lancamento")} lançamento`;

  return (
    <>
      {barra}
      <main className="entrar mx-auto max-w-[1400px] px-4 py-6 lg:px-8">
        <TabelaVendas linhas={linhas} resumo={resumo} />
      </main>
    </>
  );
}
