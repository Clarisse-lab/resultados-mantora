import { exigirEquipe } from "@/lib/auth";
import { sql } from "@/lib/db";
import { contasDeAnuncio, diasParaVencer, infoTokenGlobal, type ContaAnuncio } from "@/lib/integracoes/meta-token";
import { fmtDataHora } from "@/lib/formato";
import { removerTokenMeta } from "../acoes";
import { FormToken } from "./FormToken";

export const dynamic = "force-dynamic";

const STATUS: Record<number, string> = { 1: "Ativa", 2: "Desativada", 3: "Pagamento pendente", 7: "Em análise", 9: "Período de carência", 101: "Encerrada" };

export default async function TokenMeta() {
  await exigirEquipe();
  const info = await infoTokenGlobal();
  let contas: ContaAnuncio[] = [];
  let erroContas: string | null = null;
  if (info) {
    try {
      contas = await contasDeAnuncio();
    } catch (e) {
      erroContas = e instanceof Error ? e.message : "Erro ao listar as contas.";
    }
  }
  const ligadas = await sql<{ conta_id: string; cliente: string }[]>`
    select i.conta_id, c.nome as cliente from integracoes i join clientes c on c.id = i.cliente_id
    where i.tipo = 'meta_ads' and i.conta_id is not null`;
  const clienteDa = new Map(ligadas.map((l) => [l.conta_id, l.cliente]));
  const dias = diasParaVencer(info);
  const semAdsRead = info && info.escopos.length > 0 && !info.escopos.includes("ads_read") && !info.escopos.includes("ads_management");

  return (
    <main className="entrar mx-auto max-w-4xl space-y-6 px-4 py-8 pl-16 lg:px-8">
      <h1 className="text-xl font-semibold tracking-tight">Token da Meta</h1>

      <section className="cartao p-5">
        <p className="text-sm text-texto-2">
          Um token só para todos os clientes: cada integração Meta Ads usa este token para puxar os dados da conta de anúncio escolhida.
        </p>
        <details className="mt-3 text-sm text-texto-3">
          <summary className="cursor-pointer text-texto-2 hover:text-texto">Como gerar um token de 60 dias</summary>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>No Explorador da Graph API, escolha o app (ex.: N8N Mantora), “Token do usuário”, permissão <b>ads_read</b>, e clique em <b>Generate Access Token</b>.</li>
            <li>Abra o <b>Depurador de token de acesso</b> (developers.facebook.com/tools/debug/accesstoken), cole o token, clique em <b>Depurar</b> e depois em <b>Estender token de acesso</b>.</li>
            <li>Copie o token estendido (vale cerca de 60 dias) e cole abaixo.</li>
          </ol>
          <p className="mt-2">Quando o usuário do sistema do Business Manager estiver liberado, troque por um token dele, que não expira.</p>
        </details>

        {info && (
          <div className="mt-4 grid gap-2 rounded-xl border border-borda p-4 text-sm sm:grid-cols-2">
            <p>
              <span className="text-texto-3">Usuário: </span>
              {info.nome ?? info.usuarioId}
            </p>
            <p>
              <span className="text-texto-3">Validade: </span>
              {info.expiraEm == null ? (
                "sem data de expiração informada"
              ) : (
                <span className={dias! < 7 ? "text-perigo" : dias! < 15 ? "text-alerta" : ""}>
                  {fmtDataHora(info.expiraEm)} ({dias! < 0 ? "vencido" : `${dias} dias`})
                </span>
              )}
            </p>
            <p>
              <span className="text-texto-3">Salvo em: </span>
              {fmtDataHora(info.salvoEm)}
            </p>
            <p>
              <span className="text-texto-3">Permissões: </span>
              {info.escopos.length ? info.escopos.join(", ") : "não informadas"}
            </p>
            {semAdsRead && <p className="text-perigo sm:col-span-2">Este token não tem ads_read: gere de novo marcando essa permissão.</p>}
          </div>
        )}
        <FormToken temToken={Boolean(info)} />
        {info && (
          <form action={removerTokenMeta} className="mt-3">
            <button className="text-xs text-texto-3 hover:text-perigo">Remover token</button>
          </form>
        )}
      </section>

      {info && (
        <section className="cartao p-5">
          <h2 className="font-semibold">Contas de anúncio que o token enxerga</h2>
          {erroContas ? (
            <p className="mt-3 text-sm text-perigo">{erroContas}</p>
          ) : (
            <table className="tabela mt-3 w-full">
              <thead>
                <tr>
                  <th>Conta</th>
                  <th>ID</th>
                  <th>Portfólio</th>
                  <th>Status</th>
                  <th>Cliente no painel</th>
                </tr>
              </thead>
              <tbody>
                {contas.map((c) => (
                  <tr key={c.id}>
                    <td>{c.nome}</td>
                    <td className="num">{c.id}</td>
                    <td>{c.negocio ?? "—"}</td>
                    <td>{STATUS[c.status] ?? c.status}</td>
                    <td className={clienteDa.has(c.id) ? "" : "text-texto-3"}>{clienteDa.get(c.id) ?? "não ligada"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!erroContas && contas.length === 0 && <p className="mt-3 text-sm text-texto-3">Nenhuma conta de anúncio acessível com este token.</p>}
        </section>
      )}
    </main>
  );
}
