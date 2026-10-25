import { clienteAtual, exigirSessao } from "@/lib/auth";
import { carteira, resumoCarteira } from "@/lib/ascensao";
import { lerFiltros } from "@/lib/metricas";
import { fmtInteiro, fmtMoeda, fmtPct } from "@/lib/formato";
import { BarraFiltros } from "@/components/BarraFiltros";
import { Carteira } from "@/components/Carteira";
import { Indicadores } from "@/components/Indicadores";
import { SemCliente } from "@/components/Vazio";

export const dynamic = "force-dynamic";

export default async function Ascensao({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const sessao = await exigirSessao();
  const { atual } = await clienteAtual(sessao);
  const f = lerFiltros(sp);
  // A carteira considera todo o histórico de compras, então não há filtro de período
  const barra = <BarraFiltros titulo="LTV Ascensão" from={f.from} to={f.to} recorte={f.recorte} categoria={f.categoria} semPeriodo />;
  if (!atual) return (<>{barra}<SemCliente equipe={sessao.papel === "equipe"} /></>);

  const busca = typeof sp.q === "string" ? sp.q : undefined;
  const [todos, filtrados] = await Promise.all([carteira(atual.id), busca ? carteira(atual.id, busca) : null]);
  const r = resumoCarteira(todos);

  return (
    <>
      {barra}
      <main className="entrar mx-auto max-w-[1600px] space-y-5 px-4 py-6 lg:px-8">
        <Indicadores
          itens={[
            { rotulo: "Clientes únicos", valor: fmtInteiro(r.clientes), detalhe: "compraram ao menos uma vez" },
            { rotulo: "Receita histórica", valor: fmtMoeda(r.receita) },
            { rotulo: "LTV médio", valor: fmtMoeda(r.ltvMedio) },
            { rotulo: "Ticket médio", valor: fmtMoeda(r.ticketMedio) },
            { rotulo: "Recompra", valor: fmtPct(r.recompra), detalhe: "clientes com 2+ compras" },
            { rotulo: "Em abordagem", valor: fmtInteiro(r.emAbordagem), detalhe: "em contato ou com proposta" },
          ]}
        />
        <Carteira clientes={filtrados ?? todos} visao={sp.visao === "tabela" ? "tabela" : "quadro"} />
      </main>
    </>
  );
}
