import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Check, Circle, Loader2 } from "lucide-react";
import { exigirEquipe } from "@/lib/auth";
import { sql } from "@/lib/db";
import { fmtDataHora, fmtInteiro } from "@/lib/formato";
import {
  conectarContaMeta, criarIntegracao, criarUsuario, excluirIntegracao, removerAcesso,
  reprocessarEventos, salvarCliente, salvarMetas, salvarSegredo, sincronizarAgora,
} from "../../acoes";
import { CopiarTexto } from "@/components/CopiarTexto";
import { AtualizarSozinho } from "@/components/admin/AtualizarSozinho";
import { BotaoEnviar } from "@/components/admin/BotaoEnviar";
import { contasDeAnuncio, infoTokenGlobal, type ContaAnuncio } from "@/lib/integracoes/meta-token";
import { SYNC_TRAVADA_MIN } from "@/lib/integracoes/meta-ads";

export const dynamic = "force-dynamic";

type Integracao = {
  id: string; tipo: string; nome: string; token: string; conta_id: string | null; tem_segredo: boolean; ativo: boolean;
  ultimo_evento_em: Date | null; ultima_sync_em: Date | null; ultimo_erro: string | null; eventos: number;
  sincronizando: boolean; dias_midia: number;
};

const PLATAFORMAS: { tipo: "kiwify" | "hotmart" | "pagtrust"; nome: string; segredo: string; passos: string[] }[] = [
  {
    tipo: "kiwify",
    nome: "Kiwify",
    segredo: "Token do webhook (aparece na Kiwify ao criar o webhook)",
    passos: [
      "Na Kiwify, abra Apps → Webhooks → Criar webhook.",
      "Cole a URL abaixo e escolha os produtos (ou todos).",
      "Marque: compra aprovada, reembolso, chargeback e carrinho abandonado.",
      "Copie o token que a Kiwify mostra e salve no campo abaixo.",
    ],
  },
  {
    tipo: "hotmart",
    nome: "Hotmart",
    segredo: "Hottok (Hotmart → Ferramentas → Webhook)",
    passos: [
      "Na Hotmart, abra Ferramentas → Webhook (API e notificações) → Cadastrar webhook.",
      "Versão 2.0.0. Cole a URL abaixo.",
      "Marque os eventos de compra (aprovada, completa, cancelada, reembolsada, chargeback) e abandono de carrinho.",
      "Copie o hottok da página de webhooks e salve no campo abaixo.",
    ],
  },
  {
    tipo: "pagtrust",
    nome: "PagTrust",
    segredo: "Segredo (opcional)",
    passos: [
      "No painel da PagTrust, cadastre a URL abaixo como webhook/postback de vendas.",
      "Faça ou aguarde uma venda e confira em “Últimos eventos recebidos”, no fim desta página.",
    ],
  },
];

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
             coalesce(i.sincronizando_desde > now() - make_interval(mins => ${SYNC_TRAVADA_MIN}), false) as sincronizando,
             case when i.tipo = 'captura_leads' then (select count(*)::int from leads l where l.integracao_id = i.id)
                  else (select count(*)::int from eventos_webhook e where e.integracao_id = i.id) end as eventos,
             case when i.tipo = 'meta_ads' then (select count(distinct data)::int from midia_diaria m
                  where m.cliente_id = i.cliente_id and m.conta_id = i.conta_id) else 0 end as dias_midia
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

  const tokenMeta = await infoTokenGlobal();
  let contasMeta: ContaAnuncio[] = [];
  let erroMeta: string | null = null;
  if (tokenMeta) {
    try {
      contasMeta = await contasDeAnuncio();
    } catch (e) {
      erroMeta = e instanceof Error ? e.message : "Erro ao listar as contas de anúncio.";
    }
  }

  const h = await headers();
  const base = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
  const mesAtual = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }).slice(0, 7);
  const meta = (k: string) => metas.find((m) => m.kpi === k)?.valor ?? "";

  const metaAds = integracoes.filter((i) => i.tipo === "meta_ads");
  const vendas = integracoes.filter((i) => ["kiwify", "hotmart", "pagtrust"].includes(i.tipo));
  const captura = integracoes.filter((i) => i.tipo === "captura_leads");
  const contasLigadas = new Set(metaAds.map((i) => i.conta_id));
  const nomeConta = new Map(contasMeta.map((c) => [c.id, c]));
  const algumSincronizando = metaAds.some((i) => i.sincronizando);

  const passos = [
    { rotulo: "Meta Ads", feito: metaAds.length > 0, ancora: "#meta" },
    { rotulo: "Plataforma de venda", feito: vendas.length > 0, ancora: "#vendas" },
    { rotulo: "Captura de leads", feito: captura.length > 0, ancora: "#leads", opcional: true },
    { rotulo: "Acesso do cliente", feito: usuarios.length > 0, ancora: "#acesso", opcional: true },
  ];

  return (
    <main className="entrar mx-auto max-w-4xl space-y-6 px-4 py-8 pl-16 lg:px-8">
      <AtualizarSozinho ativo={algumSincronizando} />
      <div>
        <Link href="/admin/clientes" className="text-xs text-texto-3 hover:text-texto">
          ← Clientes
        </Link>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">{cliente.nome}</h1>
        <ol className="mt-4 flex flex-wrap gap-2">
          {passos.map((p, n) => (
            <li key={p.rotulo}>
              <a
                href={p.ancora}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs ${p.feito ? "border-sucesso/40 text-sucesso" : "border-borda text-texto-2 hover:text-texto"}`}
              >
                {p.feito ? <Check size={13} /> : <Circle size={13} />}
                {n + 1}. {p.rotulo}
                {p.opcional && !p.feito && <span className="text-texto-3">(opcional)</span>}
              </a>
            </li>
          ))}
        </ol>
      </div>

      {/* 1. META */}
      <section id="meta" className="cartao scroll-mt-6 p-5">
        <h2 className="font-semibold">1. Meta Ads</h2>
        <p className="mt-1 text-sm text-texto-3">Investimento, cliques e page views de cada anúncio. Atualiza sozinho de hora em hora.</p>

        {metaAds.map((i) => {
          const conta = i.conta_id ? nomeConta.get(i.conta_id) : undefined;
          return (
            <div key={i.id} className="mt-4 rounded-xl border border-borda p-4">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-medium">{conta?.nome ?? i.nome}</span>
                <span className="num text-xs text-texto-3">act_{i.conta_id}</span>
                <span className="ml-auto text-xs">
                  {i.sincronizando ? (
                    <span className="inline-flex items-center gap-1.5 text-marca">
                      <Loader2 size={13} className="animate-spin" /> Sincronizando… pode levar alguns minutos
                    </span>
                  ) : i.ultima_sync_em ? (
                    <span className="text-texto-3">
                      Atualizado {fmtDataHora(i.ultima_sync_em)} · {fmtInteiro(i.dias_midia)} dias de dados
                    </span>
                  ) : (
                    <span className="text-texto-3">Ainda não sincronizado</span>
                  )}
                </span>
              </div>
              {i.ultimo_erro && !i.sincronizando && <p className="mt-2 rounded-md bg-perigo/10 px-3 py-2 text-xs text-perigo">{i.ultimo_erro}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                <form action={sincronizarAgora}>
                  <input type="hidden" name="id" value={i.id} />
                  <input type="hidden" name="dias" value="90" />
                  <BotaoEnviar className="botao-sec" pendente="Iniciando…">
                    Trazer últimos 90 dias de novo
                  </BotaoEnviar>
                </form>
                <form action={excluirIntegracao}>
                  <input type="hidden" name="id" value={i.id} />
                  <BotaoEnviar className="botao-sec !text-perigo" pendente="Desconectando…">
                    Desconectar
                  </BotaoEnviar>
                </form>
              </div>
            </div>
          );
        })}

        <div className="mt-4">
          {!tokenMeta ? (
            <p className="rounded-xl border border-dashed border-borda p-4 text-sm text-texto-2">
              Primeiro cadastre o token da Mantora em{" "}
              <Link href="/admin/meta" className="text-marca underline underline-offset-2">Token da Meta</Link>.
            </p>
          ) : erroMeta ? (
            <p className="rounded-md bg-perigo/10 px-3 py-2 text-sm text-perigo">{erroMeta}</p>
          ) : (
            <form action={conectarContaMeta} className="flex flex-wrap gap-2">
              <input type="hidden" name="cliente_id" value={cliente.id} />
              <select name="conta" required className="controle min-w-0 flex-1" aria-label="Conta de anúncio" defaultValue="">
                <option value="" disabled>
                  {metaAds.length ? "Conectar outra conta de anúncio…" : "Escolha a conta de anúncio deste cliente…"}
                </option>
                {contasMeta.map((c) => (
                  <option key={c.id} value={`${c.id}|${c.nome}`} disabled={contasLigadas.has(c.id)}>
                    {c.nome}
                    {c.negocio ? ` · ${c.negocio}` : ""} · {c.id}
                    {contasLigadas.has(c.id) ? " (já conectada)" : ""}
                  </option>
                ))}
              </select>
              <BotaoEnviar pendente="Conectando…">Conectar</BotaoEnviar>
            </form>
          )}
        </div>
      </section>

      {/* 2. VENDAS */}
      <section id="vendas" className="cartao scroll-mt-6 p-5">
        <h2 className="font-semibold">2. Plataforma de venda</h2>
        <p className="mt-1 text-sm text-texto-3">Vendas, reembolsos e carrinhos abandonados chegam na hora, por webhook.</p>

        {vendas.map((i) => {
          const p = PLATAFORMAS.find((x) => x.tipo === i.tipo)!;
          return (
            <div key={i.id} className="mt-4 rounded-xl border border-borda p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-marca-suave px-2 py-0.5 text-xs font-semibold">{p.nome}</span>
                <span className="ml-auto text-xs text-texto-3">
                  {i.ultimo_evento_em ? `Último evento ${fmtDataHora(i.ultimo_evento_em)} · ${fmtInteiro(i.eventos)} recebidos` : "Aguardando o primeiro evento"}
                </span>
              </div>
              <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-texto-2">
                {p.passos.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ol>
              <CopiarTexto texto={`${base}/api/webhooks/${i.token}`} />
              <form action={salvarSegredo} className="mt-3 flex flex-wrap items-end gap-2">
                <input type="hidden" name="id" value={i.id} />
                <label className="min-w-0 flex-1 text-sm">
                  <span className="rotulo mb-1 block">{p.segredo}</span>
                  <input
                    name="segredo"
                    type="password"
                    autoComplete="off"
                    placeholder={i.tem_segredo ? "•••••• salvo (cole outro para trocar)" : "Cole aqui"}
                    className="controle w-full"
                  />
                </label>
                <BotaoEnviar className="botao-sec" pendente="Salvando…">
                  Salvar
                </BotaoEnviar>
              </form>
              {i.ultimo_erro && <p className="mt-2 rounded-md bg-perigo/10 px-3 py-2 text-xs text-perigo">Último erro: {i.ultimo_erro}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                {i.eventos > 0 && (
                  <form action={reprocessarEventos}>
                    <input type="hidden" name="id" value={i.id} />
                    <BotaoEnviar className="botao-sec" pendente="Reprocessando…">
                      Reprocessar {fmtInteiro(i.eventos)} eventos
                    </BotaoEnviar>
                  </form>
                )}
                <form action={excluirIntegracao}>
                  <input type="hidden" name="id" value={i.id} />
                  <BotaoEnviar className="botao-sec !text-perigo" pendente="Removendo…">
                    Remover
                  </BotaoEnviar>
                </form>
              </div>
            </div>
          );
        })}

        <div className="mt-4 flex flex-wrap gap-2">
          {PLATAFORMAS.map((p) => (
            <form key={p.tipo} action={criarIntegracao}>
              <input type="hidden" name="cliente_id" value={cliente.id} />
              <input type="hidden" name="tipo" value={p.tipo} />
              <BotaoEnviar className="botao-sec" pendente="Criando…">
                + Conectar {p.nome}
              </BotaoEnviar>
            </form>
          ))}
        </div>
      </section>

      {/* 3. LEADS */}
      <section id="leads" className="cartao scroll-mt-6 p-5">
        <h2 className="font-semibold">3. Captura de leads <span className="text-sm font-normal text-texto-3">(opcional)</span></h2>
        <p className="mt-1 text-sm text-texto-3">Para contar cadastros e alimentar o Kanban comercial. Use se a página de captura puder enviar os dados para uma URL.</p>
        {captura.map((i) => (
          <div key={i.id} className="mt-4 rounded-xl border border-borda p-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-texto-3">
              <span className="text-sm font-medium text-texto">URL de captura</span>
              <span className="ml-auto">{i.eventos ? `${fmtInteiro(i.eventos)} leads recebidos` : "Nenhum lead recebido ainda"}</span>
            </div>
            <CopiarTexto texto={`${base}/api/captura/${i.token}`} />
            <p className="mt-2 text-xs text-texto-3">
              Envie um POST (JSON ou formulário) a cada cadastro com <code>nome</code>, <code>email</code>, <code>telefone</code> e <code>pagina</code> (a URL
              completa, com as UTMs). Funciona com formulários de página, Typebot, ManyChat, Zapier ou n8n.
            </p>
            <form action={excluirIntegracao} className="mt-3">
              <input type="hidden" name="id" value={i.id} />
              <BotaoEnviar className="botao-sec !text-perigo" pendente="Removendo…">
                Remover
              </BotaoEnviar>
            </form>
          </div>
        ))}
        {captura.length === 0 && (
          <form action={criarIntegracao} className="mt-4">
            <input type="hidden" name="cliente_id" value={cliente.id} />
            <input type="hidden" name="tipo" value="captura_leads" />
            <BotaoEnviar className="botao-sec" pendente="Criando…">
              + Gerar URL de captura
            </BotaoEnviar>
          </form>
        )}
      </section>

      {/* 4. ACESSO */}
      <section id="acesso" className="cartao scroll-mt-6 p-5">
        <h2 className="font-semibold">4. Acesso do cliente <span className="text-sm font-normal text-texto-3">(opcional)</span></h2>
        <p className="mt-1 text-sm text-texto-3">Quem do cliente pode entrar no painel. Cada pessoa vê só os dados deste cliente.</p>
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
        </ul>
        <form action={criarUsuario} className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
          <input type="hidden" name="cliente_id" value={cliente.id} />
          <input type="hidden" name="papel" value="cliente" />
          <input name="nome" placeholder="Nome" className="controle" />
          <input name="email" type="email" required placeholder="email@cliente.com" className="controle" />
          <input name="senha" type="password" required minLength={8} autoComplete="new-password" placeholder="Senha (mín. 8)" className="controle" />
          <BotaoEnviar pendente="Criando…">Dar acesso</BotaoEnviar>
        </form>
      </section>

      {/* CONFIGURAÇÕES */}
      <details className="cartao group p-5">
        <summary className="cursor-pointer font-semibold">Configurações: nome, lançamentos e metas</summary>
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
            Campanhas cujo nome contém alguma dessas palavras entram no recorte “Lançamento”; o resto é “Perpétuo”. Deixe vazio se o cliente só tem perpétuo.
          </p>
          <div>
            <BotaoEnviar pendente="Salvando…">Salvar</BotaoEnviar>
          </div>
        </form>

        <h3 className="mt-6 text-sm font-semibold">Metas de {mesAtual.slice(5)}/{mesAtual.slice(0, 4)}</h3>
        <form action={salvarMetas} className="mt-3 grid gap-3 sm:grid-cols-4">
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
            <BotaoEnviar pendente="Salvando…">Salvar metas</BotaoEnviar>
          </div>
        </form>
      </details>

      <details className="cartao p-5">
        <summary className="cursor-pointer font-semibold">Últimos eventos recebidos ({eventos.length})</summary>
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
      </details>
    </main>
  );
}
