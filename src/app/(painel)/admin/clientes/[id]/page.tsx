import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { exigirEquipe } from "@/lib/auth";
import { sql } from "@/lib/db";
import { fmtDataHora } from "@/lib/formato";
import {
  atualizarIntegracao, criarIntegracao, criarUsuario, excluirIntegracao, removerAcesso,
  reprocessarEventos, salvarCliente, salvarMetas, sincronizarAgora,
} from "../../acoes";
import { CopiarTexto } from "@/components/CopiarTexto";

export const dynamic = "force-dynamic";

type Integracao = {
  id: string; tipo: string; nome: string; token: string; conta_id: string | null; tem_segredo: boolean; ativo: boolean;
  ultimo_evento_em: Date | null; ultima_sync_em: Date | null; ultimo_erro: string | null; eventos: number; eventos_erro: number;
};

const AJUDA: Record<string, { titulo: string; segredo?: string; conta?: string; passos: string }> = {
  hotmart: {
    titulo: "Hotmart",
    segredo: "Hottok (opcional, recomendado)",
    passos: "Hotmart → Ferramentas → Webhook (API e notificações) → Cadastrar webhook. Versão 2.0.0, cole a URL abaixo e marque os eventos de compra (aprovada, completa, cancelada, reembolsada, chargeback, abandono de carrinho).",
  },
  kiwify: {
    titulo: "Kiwify",
    segredo: "Token do webhook (opcional, recomendado)",
    passos: "Kiwify → Apps → Webhooks → Criar webhook. Cole a URL abaixo, escolha os produtos e marque: compra aprovada, reembolso, chargeback, carrinho abandonado. O token mostrado lá vai no campo de segredo.",
  },
  pagtrust: {
    titulo: "PagTrust",
    segredo: "Segredo (opcional; envie como ?secret= na URL)",
    passos: "No painel da PagTrust, cadastre a URL abaixo como webhook/postback de vendas. O primeiro evento que chegar fica registrado aqui embaixo: confira se a venda apareceu corretamente.",
  },
  meta_ads: {
    titulo: "Meta Ads",
    segredo: "Access token com permissão ads_read",
    conta: "ID da conta de anúncio (act_…)",
    passos: "Business Manager → Usuários do sistema → gere um token com ads_read e acesso à conta de anúncio. Os dados são puxados de hora em hora; use “Sincronizar agora” para trazer o histórico.",
  },
  captura_leads: {
    titulo: "Captura de leads",
    passos: "Envie um POST (JSON ou formulário) para a URL abaixo a cada cadastro, com nome, email, telefone, pagina (URL com as UTMs) e, se tiver, utm_source/utm_medium/utm_campaign/utm_content/utm_term e ctwaclid.",
  },
};

export default async function ClienteDetalhe({ params }: { params: Promise<{ id: string }> }) {
  await exigirEquipe();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [cliente] = await sql<{ id: string; nome: string; palavras_lancamento: string[] }[]>`
    select id, nome, palavras_lancamento from clientes where id = ${id}`;
  if (!cliente) notFound();

  const [integracoes, eventos, usuarios, metas] = await Promise.all([
    sql<Integracao[]>`
      select i.id, i.tipo, i.nome, i.token, i.conta_id, i.segredo is not null as tem_segredo, i.ativo,
             i.ultimo_evento_em, i.ultima_sync_em, i.ultimo_erro,
             case when i.tipo = 'captura_leads' then (select count(*)::int from leads l where l.integracao_id = i.id)
                  else (select count(*)::int from eventos_webhook e where e.integracao_id = i.id) end as eventos,
             (select count(*)::int from eventos_webhook e where e.integracao_id = i.id and e.erro is not null) as eventos_erro
      from integracoes i where i.cliente_id = ${id} order by i.criado_em`,
    sql<{ id: number; recebido_em: Date; tipo_evento: string | null; erro: string | null; processado: boolean; integracao: string }[]>`
      select e.id, e.recebido_em, e.tipo_evento, e.erro, e.processado, i.nome as integracao
      from eventos_webhook e join integracoes i on i.id = e.integracao_id
      where i.cliente_id = ${id} order by e.recebido_em desc limit 15`,
    sql<{ id: string; email: string; nome: string | null }[]>`
      select u.id, u.email, u.nome from usuarios u join usuarios_clientes uc on uc.usuario_id = u.id
      where uc.cliente_id = ${id} order by u.email`,
    sql<{ kpi: string; valor: number }[]>`
      select kpi, valor from metas where cliente_id = ${id} and mes = date_trunc('month', now() at time zone 'America/Sao_Paulo')::date`,
  ]);

  const h = await headers();
  const base = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
  const urlDe = (i: Integracao) =>
    i.tipo === "captura_leads" ? `${base}/api/captura/${i.token}` : i.tipo === "meta_ads" ? null : `${base}/api/webhooks/${i.token}`;
  const mesAtual = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }).slice(0, 7);
  const meta = (k: string) => metas.find((m) => m.kpi === k)?.valor ?? "";

  return (
    <main className="entrar mx-auto max-w-4xl space-y-6 px-4 py-8 pl-16 lg:px-8">
      <div>
        <Link href="/admin/clientes" className="text-xs text-texto-3 hover:text-texto">
          ← Clientes
        </Link>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">{cliente.nome}</h1>
      </div>

      <section className="cartao p-5">
        <h2 className="font-semibold">Dados do cliente</h2>
        <form action={salvarCliente} className="mt-4 grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="id" value={cliente.id} />
          <label className="text-sm">
            <span className="rotulo mb-1 block">Nome</span>
            <input name="nome" defaultValue={cliente.nome} required className="controle w-full" />
          </label>
          <label className="text-sm">
            <span className="rotulo mb-1 block">Palavras que marcam campanha de lançamento</span>
            <input name="palavras_lancamento" defaultValue={cliente.palavras_lancamento.join(", ")} placeholder="ex.: lanc_, black, captacao" className="controle w-full" />
          </label>
          <p className="text-xs text-texto-3 sm:col-span-2">
            Campanhas cujo nome contém alguma dessas palavras entram no recorte “Lançamento”; o resto é “Perpétuo”. Salvar reclassifica o histórico.
          </p>
          <div>
            <button className="botao">Salvar</button>
          </div>
        </form>
      </section>

      <section className="cartao p-5">
        <h2 className="font-semibold">Integrações</h2>
        <div className="mt-4 space-y-4">
          {integracoes.map((i) => {
            const ajuda = AJUDA[i.tipo];
            const url = urlDe(i);
            return (
              <div key={i.id} className="rounded-xl border border-borda p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-marca-suave px-2 py-0.5 text-xs font-semibold">{ajuda.titulo}</span>
                  <span className="font-medium">{i.nome}</span>
                  {!i.ativo && <span className="text-xs text-alerta">desativada</span>}
                  <span className="ml-auto text-xs text-texto-3">
                    {i.tipo === "meta_ads"
                      ? i.ultima_sync_em ? `sincronizado ${fmtDataHora(i.ultima_sync_em)}` : "nunca sincronizado"
                      : i.ultimo_evento_em ? `último evento ${fmtDataHora(i.ultimo_evento_em)} · ${i.eventos} recebidos` : "nenhum evento recebido"}
                  </span>
                </div>
                <p className="mt-2 text-xs text-texto-3">{ajuda.passos}</p>
                {url && <CopiarTexto texto={url} />}
                {i.ultimo_erro && <p className="mt-2 rounded-md bg-perigo/10 px-3 py-2 text-xs text-perigo">Último erro: {i.ultimo_erro}</p>}

                <details className="mt-3">
                  <summary className="cursor-pointer text-xs text-texto-2 hover:text-texto">Editar</summary>
                  <form action={atualizarIntegracao} className="mt-3 grid gap-3 sm:grid-cols-2">
                    <input type="hidden" name="id" value={i.id} />
                    <label className="text-sm">
                      <span className="rotulo mb-1 block">Nome</span>
                      <input name="nome" defaultValue={i.nome} className="controle w-full" />
                    </label>
                    {ajuda.conta && (
                      <label className="text-sm">
                        <span className="rotulo mb-1 block">{ajuda.conta}</span>
                        <input name="conta_id" defaultValue={i.conta_id ?? ""} className="controle w-full" />
                      </label>
                    )}
                    {ajuda.segredo && (
                      <label className="text-sm">
                        <span className="rotulo mb-1 block">{ajuda.segredo}</span>
                        <input name="segredo" type="password" autoComplete="off" placeholder={i.tem_segredo ? "•••••• (deixe vazio para manter)" : ""} className="controle w-full" />
                      </label>
                    )}
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="ativo" defaultChecked={i.ativo} /> Ativa
                    </label>
                    <div className="flex flex-wrap gap-2 sm:col-span-2">
                      <button className="botao">Salvar</button>
                    </div>
                  </form>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {i.tipo === "meta_ads" && (
                      <form action={sincronizarAgora}>
                        <input type="hidden" name="id" value={i.id} />
                        <input type="hidden" name="dias" value="90" />
                        <button className="botao-sec">Sincronizar agora (90 dias)</button>
                      </form>
                    )}
                    {["hotmart", "kiwify", "pagtrust"].includes(i.tipo) && i.eventos > 0 && (
                      <form action={reprocessarEventos}>
                        <input type="hidden" name="id" value={i.id} />
                        <button className="botao-sec">Reprocessar {i.eventos} eventos</button>
                      </form>
                    )}
                    <form action={excluirIntegracao}>
                      <input type="hidden" name="id" value={i.id} />
                      <button className="botao-sec !text-perigo">Excluir integração</button>
                    </form>
                  </div>
                </details>
              </div>
            );
          })}
        </div>

        <form action={criarIntegracao} className="mt-5 grid gap-2 border-t border-borda pt-5 sm:grid-cols-[auto_1fr_1fr_auto]">
          <input type="hidden" name="cliente_id" value={cliente.id} />
          <select name="tipo" className="controle" aria-label="Tipo de integração">
            <option value="kiwify">Kiwify</option>
            <option value="hotmart">Hotmart</option>
            <option value="pagtrust">PagTrust</option>
            <option value="meta_ads">Meta Ads</option>
            <option value="captura_leads">Captura de leads</option>
          </select>
          <input name="nome" placeholder="Nome (opcional)" className="controle" />
          <input name="conta_id" placeholder="Conta de anúncio (só Meta)" className="controle" />
          <button className="botao">Adicionar</button>
        </form>
      </section>

      <section className="cartao p-5">
        <h2 className="font-semibold">Metas de {mesAtual.slice(5)}/{mesAtual.slice(0, 4)}</h2>
        <form action={salvarMetas} className="mt-4 grid gap-3 sm:grid-cols-4">
          <input type="hidden" name="cliente_id" value={cliente.id} />
          <input type="hidden" name="mes" value={mesAtual} />
          {[["faturamento", "Faturamento (R$)"], ["vendas", "Vendas"], ["leads", "Leads"], ["investido", "Investimento (R$)"]].map(([k, r]) => (
            <label key={k} className="text-sm">
              <span className="rotulo mb-1 block">{r}</span>
              <input name={k} defaultValue={String(meta(k))} inputMode="decimal" className="controle w-full" />
            </label>
          ))}
          <p className="text-xs text-texto-3 sm:col-span-4">A meta do mês é distribuída pelos dias: num filtro de 7 dias, o cartão compara com 7/30 da meta.</p>
          <div>
            <button className="botao">Salvar metas</button>
          </div>
        </form>
      </section>

      <section className="cartao p-5">
        <h2 className="font-semibold">Acessos do cliente</h2>
        <ul className="mt-3 divide-y divide-borda text-sm">
          {usuarios.map((u) => (
            <li key={u.id} className="flex items-center justify-between py-2">
              <span>
                {u.nome ? `${u.nome} · ` : ""}
                <span className="text-texto-2">{u.email}</span>
              </span>
              <form action={removerAcesso}>
                <input type="hidden" name="cliente_id" value={cliente.id} />
                <input type="hidden" name="usuario_id" value={u.id} />
                <button className="text-xs text-texto-3 hover:text-perigo">remover acesso</button>
              </form>
            </li>
          ))}
          {usuarios.length === 0 && <li className="py-2 text-texto-3">Ninguém do cliente tem acesso ainda.</li>}
        </ul>
        <form action={criarUsuario} className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
          <input type="hidden" name="cliente_id" value={cliente.id} />
          <input type="hidden" name="papel" value="cliente" />
          <input name="nome" placeholder="Nome" className="controle" />
          <input name="email" type="email" required placeholder="email@cliente.com" className="controle" />
          <input name="senha" type="password" required minLength={8} autoComplete="new-password" placeholder="Senha (mín. 8)" className="controle" />
          <button className="botao">Dar acesso</button>
        </form>
      </section>

      <section className="cartao p-5">
        <h2 className="font-semibold">Últimos eventos recebidos</h2>
        <table className="tabela mt-3 w-full">
          <thead>
            <tr>
              <th>Quando</th>
              <th>Integração</th>
              <th>Evento</th>
              <th>Resultado</th>
            </tr>
          </thead>
          <tbody>
            {eventos.map((e) => (
              <tr key={e.id}>
                <td>{fmtDataHora(e.recebido_em)}</td>
                <td>{e.integracao}</td>
                <td>{e.tipo_evento ?? "—"}</td>
                <td className={e.erro ? (e.processado ? "text-texto-3" : "text-perigo") : "text-sucesso"}>{e.erro ?? "gravado"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {eventos.length === 0 && <p className="py-6 text-center text-sm text-texto-3">Nenhum webhook recebido ainda.</p>}
      </section>
    </main>
  );
}
