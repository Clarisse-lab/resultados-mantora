import { createHmac, timingSafeEqual } from "node:crypto";
import { sql } from "../db";
import { atribuir, contextoPorNome, nomeSemId } from "../atribuicao";
import { normalizar, tipoEvento, type Provedor, type Resultado } from "./normalizar";

export type Integracao = {
  id: string;
  cliente_id: string;
  tipo: string;
  segredo: string | null;
  conta_id: string | null;
  ativo: boolean;
};

export async function integracaoPorToken(token: string): Promise<Integracao | null> {
  if (!/^[a-f0-9]{16,64}$/.test(token)) return null;
  const [i] = await sql<Integracao[]>`
    select id, cliente_id, tipo, segredo, conta_id, ativo from integracoes where token = ${token}`;
  return i ?? null;
}

/** Confere a assinatura de cada plataforma quando um segredo foi cadastrado. */
export function assinaturaValida(i: Integracao, corpo: string, headers: Headers, url: URL): boolean {
  if (!i.segredo) return true;
  if (i.tipo === "hotmart") {
    const hottok = headers.get("x-hotmart-hottok") ?? safeHottok(corpo);
    return hottok != null && igual(hottok, i.segredo);
  }
  if (i.tipo === "kiwify") {
    const assinatura = url.searchParams.get("signature");
    if (!assinatura) return false;
    const esperado = createHmac("sha1", i.segredo).update(corpo).digest("hex");
    return igual(assinatura, esperado);
  }
  // PagTrust e outros: segredo opcional enviado como ?secret= ou cabeçalho x-webhook-secret
  const enviado = url.searchParams.get("secret") ?? headers.get("x-webhook-secret");
  return enviado != null && igual(enviado, i.segredo);
}

function safeHottok(corpo: string): string | null {
  try {
    const j = JSON.parse(corpo);
    return typeof j?.hottok === "string" ? j.hottok : null;
  } catch {
    return null;
  }
}

function igual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Descobre se a campanha é de lançamento: pelo nome na mídia sincronizada ou pela própria UTM. */
async function contextoDa(clienteId: string, campanhaId: string | null, utmCampaign: string | null | undefined) {
  const [c] = await sql<{ palavras_lancamento: string[] }[]>`select palavras_lancamento from clientes where id = ${clienteId}`;
  const palavras = c?.palavras_lancamento ?? [];
  if (palavras.length === 0) return "perpetuo" as const;
  let nome = nomeSemId(utmCampaign);
  if (campanhaId) {
    const [m] = await sql<{ campanha_nome: string }[]>`
      select campanha_nome from midia_diaria where cliente_id = ${clienteId} and campanha_id = ${campanhaId} limit 1`;
    nome = m?.campanha_nome ?? nome;
  }
  return contextoPorNome(nome, palavras);
}

export async function gravar(i: Integracao, r: Resultado) {
  if (r.tipo === "ignorado") return;
  if (r.tipo === "venda") {
    const v = r.venda;
    const a = atribuir(v);
    const contexto = await contextoDa(i.cliente_id, a.campanha_id, v.utm_campaign);
    // Upsert: o mesmo pedido chega várias vezes (gerado → aprovado → reembolsado).
    // Uma venda já aprovada nunca volta a "pendente" por um evento atrasado.
    await sql`
      insert into vendas ${sql({
        cliente_id: i.cliente_id,
        integracao_id: i.id,
        provedor: i.tipo,
        id_externo: v.id_externo,
        criado_em: v.criado_em,
        aprovado_em: v.aprovado_em,
        status: v.status,
        status_bruto: v.status_bruto,
        nome: v.nome,
        email: v.email,
        telefone: v.telefone,
        documento: v.documento,
        uf: v.uf,
        cidade: v.cidade,
        produto: v.produto,
        produto_id: v.produto_id,
        valor: v.valor,
        moeda: v.moeda,
        metodo: v.metodo,
        utm_source: v.utm_source ?? null,
        utm_medium: v.utm_medium ?? null,
        utm_campaign: v.utm_campaign ?? null,
        utm_content: v.utm_content ?? null,
        utm_term: v.utm_term ?? null,
        src: v.src,
        sck: v.sck,
        campanha_id: a.campanha_id,
        conjunto_id: a.conjunto_id,
        anuncio_id: a.anuncio_id,
        categoria: a.categoria,
        origem: a.origem,
        contexto,
      })}
      on conflict (cliente_id, provedor, id_externo) do update set
        status = case when vendas.status = 'aprovada' and excluded.status = 'pendente' then vendas.status else excluded.status end,
        status_bruto = excluded.status_bruto,
        aprovado_em = coalesce(vendas.aprovado_em, excluded.aprovado_em),
        valor = case when excluded.valor > 0 then excluded.valor else vendas.valor end,
        uf = coalesce(vendas.uf, excluded.uf),
        cidade = coalesce(vendas.cidade, excluded.cidade),
        atualizado_em = now()`;
    return;
  }
  const c = r.checkout;
  const a = atribuir(c);
  await sql`
    insert into checkouts ${sql({
      cliente_id: i.cliente_id,
      integracao_id: i.id,
      provedor: i.tipo,
      id_externo: c.id_externo,
      criado_em: c.criado_em,
      nome: c.nome,
      email: c.email,
      telefone: c.telefone,
      uf: c.uf,
      cidade: c.cidade,
      produto: c.produto,
      valor: c.valor,
      utm_source: c.utm_source ?? null,
      utm_medium: c.utm_medium ?? null,
      utm_campaign: c.utm_campaign ?? null,
      utm_content: c.utm_content ?? null,
      utm_term: c.utm_term ?? null,
      campanha_id: a.campanha_id,
      conjunto_id: a.conjunto_id,
      anuncio_id: a.anuncio_id,
      categoria: a.categoria,
      origem: a.origem,
    })}
    on conflict (cliente_id, provedor, id_externo) do nothing`;
}

/** Guarda o evento cru, converte e grava. Erros ficam no log do evento, sem derrubar o webhook. */
export async function processarWebhook(i: Integracao, payload: unknown) {
  const [ev] = await sql<{ id: number }[]>`
    insert into eventos_webhook (integracao_id, tipo_evento, payload)
    values (${i.id}, ${tipoEvento(payload)}, ${sql.json(payload as never)}) returning id`;
  try {
    const r = normalizar(i.tipo as Provedor, payload);
    await gravar(i, r);
    await sql`update eventos_webhook set processado = true, erro = ${r.tipo === "ignorado" ? r.motivo : null} where id = ${ev.id}`;
    await sql`update integracoes set ultimo_evento_em = now(), ultimo_erro = null where id = ${i.id}`;
    return r;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await sql`update eventos_webhook set erro = ${msg} where id = ${ev.id}`;
    await sql`update integracoes set ultimo_erro = ${msg} where id = ${i.id}`;
    throw e;
  }
}

/** Reprocessa eventos já recebidos (útil depois de ajustar um adaptador). */
export async function reprocessar(integracaoId: string) {
  const [i] = await sql<Integracao[]>`select id, cliente_id, tipo, segredo, conta_id, ativo from integracoes where id = ${integracaoId}`;
  if (!i) return 0;
  const eventos = await sql<{ id: number; payload: unknown }[]>`
    select id, payload from eventos_webhook where integracao_id = ${i.id} order by recebido_em`;
  for (const e of eventos) {
    const r = normalizar(i.tipo as Provedor, e.payload);
    await gravar(i, r);
    await sql`update eventos_webhook set processado = true, erro = ${r.tipo === "ignorado" ? r.motivo : null} where id = ${e.id}`;
  }
  return eventos.length;
}
