import Link from "next/link";
import { exigirEquipe } from "@/lib/auth";
import { sql } from "@/lib/db";
import { criarCliente } from "../acoes";
import { diasParaVencer, infoTokenGlobal } from "@/lib/integracoes/meta-token";

export const dynamic = "force-dynamic";

export default async function Clientes() {
  await exigirEquipe();
  const clientes = await sql<{ id: string; nome: string; integracoes: number; com_erro: number; ultimo: Date | null }[]>`
    select c.id, c.nome, count(i.id)::int as integracoes, count(i.ultimo_erro)::int as com_erro,
           greatest(max(i.ultimo_evento_em), max(i.ultima_sync_em)) as ultimo
    from clientes c left join integracoes i on i.cliente_id = c.id
    group by c.id order by c.nome`;
  const token = await infoTokenGlobal();
  const dias = diasParaVencer(token);
  const aviso = !token
    ? "Ainda não há token da Meta: os dados de mídia não serão puxados."
    : dias != null && dias < 0
      ? "O token da Meta venceu: a sincronização de mídia parou."
      : dias != null && dias < 7
        ? `O token da Meta vence em ${dias} ${dias === 1 ? "dia" : "dias"}.`
        : null;
  return (
    <main className="entrar mx-auto max-w-4xl px-4 py-8 pl-16 lg:px-8">
      <h1 className="text-xl font-semibold tracking-tight">Clientes e integrações</h1>
      {aviso && (
        <Link href="/admin/meta" className="mt-4 block rounded-xl border border-alerta/40 bg-alerta/10 px-4 py-3 text-sm text-alerta hover:bg-alerta/15">
          {aviso} Atualizar token →
        </Link>
      )}
      <form action={criarCliente} className="mt-6 flex gap-2">
        <input name="nome" required placeholder="Nome do novo cliente" className="controle flex-1" />
        <button className="botao">Cadastrar</button>
      </form>
      <ul className="cartao mt-6 divide-y divide-borda">
        {clientes.map((c) => (
          <li key={c.id}>
            <Link href={`/admin/clientes/${c.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-superficie-2">
              <span className="flex-1 font-medium">{c.nome}</span>
              <span className="text-xs text-texto-3">{c.integracoes} integrações</span>
              {c.com_erro > 0 && <span className="text-xs text-perigo">{c.com_erro} com erro</span>}
              <span className="w-40 text-right text-xs text-texto-3">
                {c.ultimo ? `último dado ${new Date(c.ultimo).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })}` : "sem dados ainda"}
              </span>
            </Link>
          </li>
        ))}
        {clientes.length === 0 && <li className="px-5 py-8 text-center text-sm text-texto-3">Nenhum cliente cadastrado.</li>}
      </ul>
    </main>
  );
}
