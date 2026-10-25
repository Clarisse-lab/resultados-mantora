import { sql } from "../db";
import { decifrar } from "../cripto";
import { mensagemErro, tokenGlobal } from "./meta-token";

// Criativo de um anúncio da Meta para o painel de detalhe do Top mídias.

export type Criativo = {
  id: string;
  nome: string | null;
  status: string | null; // ACTIVE, PAUSED, ARCHIVED...
  imagem: string | null;
  video: boolean;
  titulo: string | null;
  texto: string | null;
  link: string | null; // prévia compartilhável ou o anúncio no gerenciador
};

const CACHE_HORAS = 6;
const versao = () => process.env.META_API_VERSION ?? "v21.0";

async function graph<T>(caminho: string, token: string, fields: string): Promise<T> {
  const url = `https://graph.facebook.com/${versao()}/${caminho}?${new URLSearchParams({ fields, access_token: token })}`;
  const r = await fetch(url, { cache: "no-store" });
  const j = (await r.json().catch(() => ({}))) as T & { error?: { message: string; code?: number } };
  if (!r.ok || j.error) throw new Error(mensagemErro(j.error));
  return j;
}

/** Token da conta de anúncio do objeto: o próprio da integração ou o da Mantora. */
async function tokenDoObjeto(clienteId: string, objetoId: string) {
  const [i] = await sql<{ segredo: string | null; conta_id: string }[]>`
    select i.segredo, i.conta_id from integracoes i
    where i.cliente_id = ${clienteId} and i.tipo = 'meta_ads' and i.ativo
      and i.conta_id = (select conta_id from midia_diaria
                        where cliente_id = ${clienteId} and (anuncio_id = ${objetoId} or conjunto_id = ${objetoId} or campanha_id = ${objetoId})
                        limit 1)
    limit 1`;
  return { token: decifrar(i?.segredo ?? null) ?? (await tokenGlobal()), conta: i?.conta_id ?? null };
}

async function emCache<T>(clienteId: string, objetoId: string, buscar: () => Promise<T>): Promise<T> {
  const [c] = await sql<{ dados: T }[]>`
    select dados from criativos where cliente_id = ${clienteId} and objeto_id = ${objetoId}
      and atualizado_em > now() - make_interval(hours => ${CACHE_HORAS})`;
  if (c) return c.dados;
  const dados = await buscar();
  await sql`
    insert into criativos (cliente_id, objeto_id, dados) values (${clienteId}, ${objetoId}, ${sql.json(dados as never)})
    on conflict (cliente_id, objeto_id) do update set dados = excluded.dados, atualizado_em = now()`;
  return dados;
}

type AdMeta = {
  id: string;
  name?: string;
  effective_status?: string;
  preview_shareable_link?: string;
  account_id?: string;
  creative?: {
    thumbnail_url?: string;
    image_url?: string;
    title?: string;
    body?: string;
    video_id?: string;
    object_story_spec?: {
      video_data?: { image_url?: string; title?: string; message?: string };
      link_data?: { picture?: string; name?: string; message?: string };
    };
  };
};

export async function criativoDoAnuncio(clienteId: string, anuncioId: string): Promise<Criativo> {
  return emCache(clienteId, `ad:${anuncioId}`, async () => {
    const { token, conta } = await tokenDoObjeto(clienteId, anuncioId);
    if (!token) throw new Error("Sem token da Meta cadastrado.");
    const ad = await graph<AdMeta>(
      anuncioId,
      token,
      "name,effective_status,preview_shareable_link,account_id," +
        "creative.thumbnail_width(720).thumbnail_height(720){thumbnail_url,image_url,title,body,video_id,object_story_spec}",
    );
    const c = ad.creative ?? {};
    const spec = c.object_story_spec;
    let imagem = c.image_url ?? spec?.link_data?.picture ?? spec?.video_data?.image_url ?? c.thumbnail_url ?? null;
    if (c.video_id && !c.image_url) {
      // Miniatura grande do vídeo, quando a Meta libera
      try {
        const v = await graph<{ thumbnails?: { data: { uri: string; is_preferred?: boolean; width?: number }[] } }>(c.video_id, token, "thumbnails{uri,is_preferred,width}");
        const t = v.thumbnails?.data ?? [];
        imagem = (t.find((x) => x.is_preferred) ?? t.sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0])?.uri ?? imagem;
      } catch {
        // fica com a miniatura do criativo
      }
    }
    const contaId = ad.account_id ?? conta;
    return {
      id: ad.id,
      nome: ad.name ?? null,
      status: ad.effective_status ?? null,
      imagem,
      video: Boolean(c.video_id),
      titulo: c.title ?? spec?.link_data?.name ?? spec?.video_data?.title ?? null,
      texto: c.body ?? spec?.link_data?.message ?? spec?.video_data?.message ?? null,
      link:
        ad.preview_shareable_link ??
        (contaId ? `https://www.facebook.com/adsmanager/manage/ads?act=${contaId}&selected_ad_ids=${ad.id}` : null),
    };
  });
}

/** Status atual de uma campanha ou conjunto (ACTIVE, PAUSED...). */
export async function statusDoObjeto(clienteId: string, objetoId: string): Promise<string | null> {
  return emCache(clienteId, `st:${objetoId}`, async () => {
    const { token } = await tokenDoObjeto(clienteId, objetoId);
    if (!token) return null;
    try {
      return (await graph<{ effective_status?: string }>(objetoId, token, "effective_status")).effective_status ?? null;
    } catch {
      return null;
    }
  });
}
