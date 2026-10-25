import { sql } from "../db";
import { contextoPorNome } from "../atribuicao";
import { decifrar } from "../cripto";
import { mensagemErro, tokenGlobal } from "./meta-token";

// Sincroniza a Meta Ads Insights por anúncio e por dia.
// Usa o token próprio da integração ou, se não houver, o token da Meta da Mantora (ads_read).

type Linha = {
  date_start: string;
  campaign_id: string;
  campaign_name: string;
  adset_id: string;
  adset_name: string;
  ad_id: string;
  ad_name: string;
  spend?: string;
  impressions?: string;
  inline_link_clicks?: string;
  actions?: { action_type: string; value: string }[];
};

const CAMPOS = [
  "campaign_id", "campaign_name", "adset_id", "adset_name", "ad_id", "ad_name",
  "spend", "impressions", "inline_link_clicks", "actions",
].join(",");

function acao(l: Linha, ...tipos: string[]) {
  return (l.actions ?? []).filter((a) => tipos.includes(a.action_type)).reduce((s, a) => s + Number(a.value || 0), 0);
}

export async function buscarInsights(contaId: string, token: string, de: string, ate: string): Promise<Linha[]> {
  const versao = process.env.META_API_VERSION ?? "v21.0";
  const conta = contaId.replace(/^act_/, "");
  const params = new URLSearchParams({
    level: "ad",
    time_increment: "1",
    fields: CAMPOS,
    time_range: JSON.stringify({ since: de, until: ate }),
    limit: "500",
    access_token: token,
  });
  let url: string | null = `https://graph.facebook.com/${versao}/act_${conta}/insights?${params}`;
  const linhas: Linha[] = [];
  while (url) {
    const r: Response = await fetch(url, { cache: "no-store" });
    const j = (await r.json()) as { data?: Linha[]; paging?: { next?: string }; error?: { message: string; code?: number } };
    if (!r.ok || j.error) throw new Error(mensagemErro(j.error ?? { message: r.statusText }));
    linhas.push(...(j.data ?? []));
    url = j.paging?.next ?? null;
  }
  return linhas;
}

export async function sincronizarMeta(integracaoId: string, dias = 7) {
  const [i] = await sql<{ id: string; cliente_id: string; segredo: string | null; conta_id: string | null }[]>`
    select id, cliente_id, segredo, conta_id from integracoes where id = ${integracaoId} and tipo = 'meta_ads' and ativo`;
  if (!i?.conta_id) throw new Error("integração Meta sem conta de anúncio");
  const token = decifrar(i.segredo) ?? (await tokenGlobal());
  if (!token) throw new Error("Sem token da Meta: cadastre o token da Mantora em Admin → Token da Meta.");
  const [c] = await sql<{ palavras_lancamento: string[] }[]>`select palavras_lancamento from clientes where id = ${i.cliente_id}`;

  const ate = new Date();
  const de = new Date(ate.getTime() - (dias - 1) * 86400000);
  const fmt = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

  try {
    const linhas = await buscarInsights(i.conta_id, token, fmt(de), fmt(ate));
    for (let k = 0; k < linhas.length; k += 200) {
      const lote = linhas.slice(k, k + 200).map((l) => ({
        cliente_id: i.cliente_id,
        plataforma: "meta",
        data: l.date_start,
        conta_id: i.conta_id!,
        campanha_id: l.campaign_id,
        campanha_nome: l.campaign_name,
        conjunto_id: l.adset_id,
        conjunto_nome: l.adset_name,
        anuncio_id: l.ad_id,
        anuncio_nome: l.ad_name,
        investido: Number(l.spend ?? 0),
        impressoes: Number(l.impressions ?? 0),
        cliques: Number(l.inline_link_clicks ?? 0),
        page_views: acao(l, "landing_page_view", "omni_landing_page_view"),
        leads_plataforma: acao(l, "lead", "onsite_conversion.lead_grouped", "offsite_conversion.fb_pixel_lead"),
        contexto: contextoPorNome(l.campaign_name, c?.palavras_lancamento ?? []),
      }));
      await sql`
        insert into midia_diaria ${sql(lote)}
        on conflict (cliente_id, plataforma, data, anuncio_id) do update set
          campanha_nome = excluded.campanha_nome, conjunto_nome = excluded.conjunto_nome, anuncio_nome = excluded.anuncio_nome,
          investido = excluded.investido, impressoes = excluded.impressoes, cliques = excluded.cliques,
          page_views = excluded.page_views, leads_plataforma = excluded.leads_plataforma,
          contexto = excluded.contexto, atualizado_em = now()`;
    }
    await sql`update integracoes set ultima_sync_em = now(), ultimo_erro = null where id = ${i.id}`;
    return linhas.length;
  } catch (e) {
    await sql`update integracoes set ultimo_erro = ${e instanceof Error ? e.message : String(e)} where id = ${i.id}`;
    throw e;
  }
}

export async function sincronizarTodas(dias = 3) {
  const contas = await sql<{ id: string }[]>`select id from integracoes where tipo = 'meta_ads' and ativo`;
  const resultado: Record<string, number | string> = {};
  for (const c of contas) {
    try {
      resultado[c.id] = await sincronizarMeta(c.id, dias);
    } catch (e) {
      resultado[c.id] = e instanceof Error ? e.message : String(e);
    }
  }
  return resultado;
}
