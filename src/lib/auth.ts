import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sql } from "./db";
import { COOKIE_SESSAO, lerSessao, type Sessao } from "./sessao-token";

export const COOKIE_CLIENTE = "cliente";

export type ClienteResumo = { id: string; nome: string; slug: string };

export async function sessaoAtual(): Promise<Sessao | null> {
  const jar = await cookies();
  const s = await lerSessao(jar.get(COOKIE_SESSAO)?.value);
  if (!s) return null;
  // Usuário desativado perde o acesso na hora, mesmo com cookie válido
  const [u] = await sql<{ ativo: boolean; papel: Sessao["papel"] }[]>`select ativo, papel from usuarios where id = ${s.uid}`;
  return u?.ativo ? { ...s, papel: u.papel } : null;
}

export async function exigirSessao(): Promise<Sessao> {
  const s = await sessaoAtual();
  if (!s) redirect("/login");
  return s;
}

export async function exigirEquipe(): Promise<Sessao> {
  const s = await exigirSessao();
  if (s.papel !== "equipe") redirect("/visao-geral");
  return s;
}

export async function clientesDoUsuario(s: Sessao): Promise<ClienteResumo[]> {
  return s.papel === "equipe"
    ? sql<ClienteResumo[]>`select id, nome, slug from clientes order by nome`
    : sql<ClienteResumo[]>`
        select c.id, c.nome, c.slug from clientes c
        join usuarios_clientes uc on uc.cliente_id = c.id
        where uc.usuario_id = ${s.uid} order by c.nome`;
}

/** Cliente escolhido no seletor (cookie), validado contra o acesso do usuário. */
export async function clienteAtual(s: Sessao): Promise<{ atual: ClienteResumo | null; todos: ClienteResumo[] }> {
  const todos = await clientesDoUsuario(s);
  const escolhido = (await cookies()).get(COOKIE_CLIENTE)?.value;
  return { atual: todos.find((c) => c.id === escolhido) ?? todos[0] ?? null, todos };
}

export async function podeVerCliente(s: Sessao, clienteId: string) {
  return (await clientesDoUsuario(s)).some((c) => c.id === clienteId);
}
