import { clienteAtual, exigirSessao } from "@/lib/auth";
import { lerFiltros } from "@/lib/metricas";
import { MOTIVOS_PERDA, etapasDo, pipeline, sdrsDo } from "@/lib/comercial";
import { fmtInteiro, fmtMoeda, fmtPct } from "@/lib/formato";
import { BarraFiltros } from "@/components/BarraFiltros";
import { Indicadores } from "@/components/Indicadores";
import { Kanban } from "@/components/Kanban";
import { SemCliente } from "@/components/Vazio";

export const dynamic = "force-dynamic";

export default async function Comercial({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const sessao = await exigirSessao();
  const { atual } = await clienteAtual(sessao);
  const f = lerFiltros(sp);
  const barra = <BarraFiltros titulo="Comercial" from={f.from} to={f.to} recorte={f.recorte} categoria={f.categoria} semRecorte />;
  if (!atual) return (<>{barra}<SemCliente equipe={sessao.papel === "equipe"} /></>);

  const [etapas, leads, sdrs] = await Promise.all([etapasDo(atual.id), pipeline(atual.id, f, typeof sp.q === "string" ? sp.q : undefined), sdrsDo(atual.id)]);
  const n = (k: string) => leads.filter((l) => l.etapa === k).length;
  const vendas = leads.filter((l) => l.etapa === "venda");
  const perdidos = leads.filter((l) => l.motivo_perda);
  const motivoTop = Object.entries(perdidos.reduce<Record<string, number>>((m, l) => ({ ...m, [l.motivo_perda!]: (m[l.motivo_perda!] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1])[0];

  return (
    <>
      {barra}
      <main className="entrar mx-auto max-w-[1600px] space-y-5 px-4 py-6 lg:px-8">
        <Indicadores
          itens={[
            { rotulo: "Leads", valor: fmtInteiro(leads.length), detalhe: "entraram no período" },
            { rotulo: "Em atendimento", valor: fmtInteiro(leads.length - n("lead") - n("checkout") - n("venda")), detalhe: "etapas entre Lead e Checkout" },
            { rotulo: "Checkouts", valor: fmtInteiro(n("checkout")), detalhe: "abriram e não pagaram" },
            { rotulo: "Vendas", valor: fmtInteiro(vendas.length), detalhe: fmtMoeda(vendas.reduce((s, l) => s + (l.valor ?? 0), 0)) },
            { rotulo: "Conversão", valor: fmtPct(leads.length ? vendas.length / leads.length : null), detalhe: "lead → venda" },
            { rotulo: "Perdidos", valor: fmtInteiro(perdidos.length), detalhe: motivoTop ? `mais comum: ${motivoTop[0]}` : "nenhum marcado" },
          ]}
        />
        <Kanban etapas={etapas} leads={leads} motivos={MOTIVOS_PERDA} sdrs={sdrs} equipe={sessao.papel === "equipe"} />
      </main>
    </>
  );
}
