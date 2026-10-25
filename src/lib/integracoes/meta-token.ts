import { sql } from "../db";
import { cifrar, decifrar } from "../cripto";

// Token da Meta da Mantora: um só token (de usuário de longa duração ou de usuário do sistema)
// que enxerga as contas de anúncio de todos os clientes. Cada integração Meta usa este token,
// a menos que tenha um token próprio.

export type InfoToken = {
  nome: string | null;
  usuarioId: string | null;
  expiraEm: string | null; // ISO; null = não expira ou desconhecido
  escopos: string[];
  salvoEm: string;
};

export type ContaAnuncio = { id: string; nome: string; status: number; negocio: string | null };

const versao = () => process.env.META_API_VERSION ?? "v21.0";

async function graph<T>(caminho: string, token: string, params: Record<string, string> = {}): Promise<T> {
  const url = `https://graph.facebook.com/${versao()}/${caminho}?${new URLSearchParams({ ...params, access_token: token })}`;
  const r = await fetch(url, { cache: "no-store" });
  const j = (await r.json().catch(() => ({}))) as T & { error?: { message: string; code?: number } };
  if (!r.ok || j.error) throw new Error(mensagemErro(j.error));
  return j;
}

export function mensagemErro(e?: { message?: string; code?: number }) {
  if (e?.code === 190) return "Token da Meta inválido ou expirado. Gere um novo e atualize em Admin → Token da Meta.";
  if (e?.code === 200 || e?.code === 10) return "O token não tem permissão para esta conta de anúncio (precisa de ads_read e acesso à conta).";
  return `Meta: ${e?.message ?? "erro desconhecido"}`;
}

/** Confere o token na Meta: de quem é, quando expira e quais permissões tem. */
export async function inspecionarToken(token: string): Promise<Omit<InfoToken, "salvoEm">> {
  const eu = await graph<{ id: string; name?: string }>("me", token, { fields: "id,name" });
  let expiraEm: string | null = null;
  let escopos: string[] = [];
  try {
    // O próprio token consegue se depurar quando é do app que o gerou
    const d = await graph<{ data: { expires_at?: number; data_access_expires_at?: number; scopes?: string[] } }>("debug_token", token, { input_token: token });
    const exp = d.data.expires_at;
    expiraEm = exp && exp > 0 ? new Date(exp * 1000).toISOString() : null;
    escopos = d.data.scopes ?? [];
  } catch {
    // sem informação de validade; segue com o token assim mesmo
  }
  return { nome: eu.name ?? null, usuarioId: eu.id, expiraEm, escopos };
}

export async function salvarTokenGlobal(token: string) {
  const info = await inspecionarToken(token);
  const valor = { token: cifrar(token), ...info, salvoEm: new Date().toISOString() };
  await sql`
    insert into configuracoes (chave, valor) values ('meta_token', ${sql.json(valor)})
    on conflict (chave) do update set valor = excluded.valor, atualizado_em = now()`;
  cacheContas = null;
  return info;
}

export async function removerTokenGlobal() {
  await sql`delete from configuracoes where chave = 'meta_token'`;
  cacheContas = null;
}

async function lerRegistro() {
  const [r] = await sql<{ valor: InfoToken & { token: string } }[]>`select valor from configuracoes where chave = 'meta_token'`;
  return r?.valor ?? null;
}

export async function infoTokenGlobal(): Promise<InfoToken | null> {
  const r = await lerRegistro();
  if (!r) return null;
  const { token: _t, ...info } = r;
  return info;
}

export async function tokenGlobal(): Promise<string | null> {
  const r = await lerRegistro();
  return r ? decifrar(r.token) : null;
}

/** Dias até o token vencer (null = não vence ou desconhecido). */
export function diasParaVencer(info: InfoToken | null) {
  if (!info?.expiraEm) return null;
  return Math.floor((Date.parse(info.expiraEm) - Date.now()) / 86400000);
}

let cacheContas: { quando: number; contas: ContaAnuncio[] } | null = null;

/** Contas de anúncio que o token da Mantora enxerga (cache de 5 minutos). */
export async function contasDeAnuncio(): Promise<ContaAnuncio[]> {
  if (cacheContas && Date.now() - cacheContas.quando < 5 * 60_000) return cacheContas.contas;
  const token = await tokenGlobal();
  if (!token) return [];
  type Pagina = { data: { account_id: string; name: string; account_status: number; business?: { name: string } }[]; paging?: { next?: string } };
  const contas: ContaAnuncio[] = [];
  let pagina = await graph<Pagina>("me/adaccounts", token, { fields: "account_id,name,account_status,business{name}", limit: "200" });
  for (let n = 0; n < 20; n++) {
    contas.push(...pagina.data.map((c) => ({ id: c.account_id, nome: c.name, status: c.account_status, negocio: c.business?.name ?? null })));
    if (!pagina.paging?.next) break;
    const r = await fetch(pagina.paging.next, { cache: "no-store" });
    pagina = (await r.json()) as Pagina;
    if (!Array.isArray(pagina.data)) break;
  }
  contas.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  cacheContas = { quando: Date.now(), contas };
  return contas;
}
