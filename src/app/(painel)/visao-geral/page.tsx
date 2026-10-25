import { clienteAtual, exigirSessao } from "@/lib/auth";
import { lerFiltros, periodoAnterior, topMidias, visaoGeral, type Nivel, type OrdemTop } from "@/lib/metricas";
import { fmtDiaCurto } from "@/lib/formato";
import { BarraFiltros } from "@/components/BarraFiltros";
import { CartoesKpi } from "@/components/CartoesKpi";
import { Funil } from "@/components/Funil";
import { GraficoInvestimento } from "@/components/GraficoInvestimento";
import { MapaBrasil } from "@/components/MapaBrasil";
import { TopMidias } from "@/components/TopMidias";
import { SemCliente } from "@/components/Vazio";

export const dynamic = "force-dynamic";

type Busca = Promise<Record<string, string | string[] | undefined>>;

export default async function VisaoGeral({ searchParams }: { searchParams: Busca }) {
  const sp = await searchParams;
  const sessao = await exigirSessao();
  const { atual } = await clienteAtual(sessao);
  const f = lerFiltros(sp);
  const barra = <BarraFiltros titulo="Visão geral" from={f.from} to={f.to} recorte={f.recorte} categoria={f.categoria} granularidade={f.granularidade} />;
  if (!atual) return (<>{barra}<SemCliente equipe={sessao.papel === "equipe"} /></>);

  const nivel = (["campanha", "conjunto", "anuncio"] as const).find((n) => n === sp.nivel) ?? "campanha";
  const ORDENS = ["leads", "vendas", "faturamento", "investido", "roas", "cpl", "cpa", "ctr", "impressoes", "cliques"] as const;
  const ordemPedida = ORDENS.find((o) => o === sp.ordem);
  const limite = [10, 20, 50].find((n) => String(n) === sp.top) ?? 10;

  const dados = await visaoGeral(atual.id, f);
  // Sem vendas no período, ordenar por faturamento deixaria o ranking vazio: começa pelo investimento
  const ordem: OrdemTop = ordemPedida ?? (dados.totais.vendas > 0 ? "faturamento" : "investido");
  const top = await topMidias(atual.id, f, nivel as Nivel, ordem, limite);
  const ant = periodoAnterior(f);

  return (
    <>
      {barra}
      <main className="entrar mx-auto max-w-[1400px] space-y-5 px-4 py-6 lg:px-8">
        <p className="text-sm text-texto-3">
          {atual.nome} · {fmtDiaCurto(f.from)} a {fmtDiaCurto(f.to)}
        </p>
        <CartoesKpi kpis={dados.kpis} />

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="flex flex-col gap-4">
            <div className="cartao p-5">
              <h2 className="mb-4 text-lg font-semibold">Funil · {f.recorte === "unificada" ? "Unificada" : f.recorte === "perpetuo" ? "Perpétuo" : "Lançamento"}</h2>
              <Funil etapas={dados.funil} />
            </div>
            <div className="cartao p-5">
              <h2 className="mb-1 text-lg font-semibold">Investimento, faturamento e ROAS</h2>
              <p className="mb-3 text-xs text-texto-3">R$ por {f.granularidade === "dia" ? "dia" : f.granularidade === "semana" ? "semana" : "mês"} · ROAS no eixo à direita</p>
              <GraficoInvestimento serie={dados.serie} />
            </div>
          </div>
          <div className="cartao flex flex-col p-5">
            <h2 className="mb-4 text-lg font-semibold">Distribuição geográfica</h2>
            <MapaBrasil estados={dados.geo.estados} semGeo={dados.geo.semGeo} />
          </div>
        </section>

        <section id="top-midias" className="cartao scroll-mt-24 p-5" aria-label="Top mídias do período">
          <h2 className="mb-4 text-lg font-semibold">Top mídias</h2>
          <TopMidias linhas={top} nivel={nivel} ordem={ordem} limite={limite} periodoAnterior={`${fmtDiaCurto(ant.from)} a ${fmtDiaCurto(ant.to)}`} />
        </section>
      </main>
    </>
  );
}
