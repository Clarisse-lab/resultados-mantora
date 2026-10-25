import { redirect } from "next/navigation";
import { clientesDoUsuario, exigirSessao } from "@/lib/auth";
import { lerFiltros } from "@/lib/metricas";
import { resumoPorCliente } from "@/lib/resumo-clientes";
import { BarraFiltros } from "@/components/BarraFiltros";
import { TabelaClientes } from "@/components/TabelaClientes";
import { SemCliente } from "@/components/Vazio";

export const dynamic = "force-dynamic";

export default async function TodosClientes({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const sessao = await exigirSessao();
  const clientes = await clientesDoUsuario(sessao);
  // Quem só tem um cliente vai direto para a visão geral dele
  if (sessao.papel !== "equipe" && clientes.length <= 1) redirect("/visao-geral");
  const f = lerFiltros(sp);
  const barra = <BarraFiltros titulo="Todos os clientes" from={f.from} to={f.to} recorte={f.recorte} categoria={f.categoria} semCliente />;
  if (clientes.length === 0) return (<>{barra}<SemCliente equipe={sessao.papel === "equipe"} /></>);

  const linhas = await resumoPorCliente(clientes, f);
  const periodo = new URLSearchParams();
  for (const k of ["from", "to", "recorte", "categoria"]) if (typeof sp[k] === "string") periodo.set(k, sp[k] as string);

  return (
    <>
      {barra}
      <main className="entrar mx-auto max-w-[1400px] px-4 py-6 lg:px-8">
        <TabelaClientes linhas={linhas} volta={`/visao-geral${periodo.size ? `?${periodo}` : ""}`} />
      </main>
    </>
  );
}
