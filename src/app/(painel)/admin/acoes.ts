"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirEquipe } from "@/lib/auth";
import { sql } from "@/lib/db";
import { reprocessar } from "@/lib/integracoes/ingestao";
import { sincronizarMeta } from "@/lib/integracoes/meta-ads";
import { criarEtapasPadrao } from "@/lib/comercial";
import { cifrar } from "@/lib/cripto";

const txt = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const slugDe = (nome: string) =>
  nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

export async function criarCliente(f: FormData) {
  await exigirEquipe();
  const nome = txt(f, "nome");
  if (!nome) return;
  const base = slugDe(nome) || "cliente";
  const [c] = await sql<{ id: string }[]>`
    insert into clientes (nome, slug)
    values (${nome}, ${base} || case when exists (select 1 from clientes where slug = ${base}) then '-' || substr(md5(random()::text), 1, 4) else '' end)
    returning id`;
  await criarEtapasPadrao(c.id);
  redirect(`/admin/clientes/${c.id}`);
}

export async function salvarCliente(f: FormData) {
  await exigirEquipe();
  const id = txt(f, "id");
  const palavras = txt(f, "palavras_lancamento").split(",").map((p) => p.trim()).filter(Boolean);
  await sql`update clientes set nome = ${txt(f, "nome")}, palavras_lancamento = ${palavras} where id = ${id}`;
  // Reclassifica o histórico com as palavras novas
  await sql`
    update midia_diaria set contexto = case when exists (
      select 1 from unnest(${palavras}::text[]) p where p <> '' and position(lower(p) in lower(campanha_nome)) > 0
    ) then 'lancamento' else 'perpetuo' end where cliente_id = ${id}`;
  await sql`
    update vendas v set contexto = coalesce((select m.contexto from midia_diaria m where m.cliente_id = v.cliente_id and m.campanha_id = v.campanha_id limit 1),
      case when exists (select 1 from unnest(${palavras}::text[]) p where p <> '' and position(lower(p) in lower(coalesce(v.utm_campaign, ''))) > 0)
      then 'lancamento' else 'perpetuo' end)
    where cliente_id = ${id}`;
  revalidatePath(`/admin/clientes/${id}`);
}

export async function criarIntegracao(f: FormData) {
  await exigirEquipe();
  const cliente = txt(f, "cliente_id");
  const tipo = txt(f, "tipo");
  if (!["hotmart", "kiwify", "pagtrust", "meta_ads", "captura_leads"].includes(tipo)) return;
  const nomes: Record<string, string> = { hotmart: "Hotmart", kiwify: "Kiwify", pagtrust: "PagTrust", meta_ads: "Meta Ads", captura_leads: "Captura de leads" };
  await sql`
    insert into integracoes (cliente_id, tipo, nome, segredo, conta_id)
    values (${cliente}, ${tipo}, ${txt(f, "nome") || nomes[tipo]}, ${txt(f, "segredo") ? cifrar(txt(f, "segredo")) : null}, ${txt(f, "conta_id").replace(/^act_/, "") || null})`;
  revalidatePath(`/admin/clientes/${cliente}`);
}

export async function atualizarIntegracao(f: FormData) {
  await exigirEquipe();
  const id = txt(f, "id");
  const segredo = txt(f, "segredo");
  const [i] = await sql<{ cliente_id: string }[]>`
    update integracoes set
      nome = ${txt(f, "nome")},
      conta_id = ${txt(f, "conta_id").replace(/^act_/, "") || null},
      segredo = case when ${segredo} = '' then segredo else ${segredo ? cifrar(segredo) : ""} end,
      ativo = ${f.get("ativo") === "on"}
    where id = ${id} returning cliente_id`;
  if (i) revalidatePath(`/admin/clientes/${i.cliente_id}`);
}

export async function excluirIntegracao(f: FormData) {
  await exigirEquipe();
  const [i] = await sql<{ cliente_id: string }[]>`delete from integracoes where id = ${txt(f, "id")} returning cliente_id`;
  if (i) revalidatePath(`/admin/clientes/${i.cliente_id}`);
}

export async function sincronizarAgora(f: FormData) {
  await exigirEquipe();
  const id = txt(f, "id");
  try {
    await sincronizarMeta(id, Number(txt(f, "dias")) || 30);
  } catch {
    // o erro fica gravado em integracoes.ultimo_erro e aparece na tela
  }
  const [i] = await sql<{ cliente_id: string }[]>`select cliente_id from integracoes where id = ${id}`;
  if (i) revalidatePath(`/admin/clientes/${i.cliente_id}`);
}

export async function reprocessarEventos(f: FormData) {
  await exigirEquipe();
  const id = txt(f, "id");
  await reprocessar(id);
  const [i] = await sql<{ cliente_id: string }[]>`select cliente_id from integracoes where id = ${id}`;
  if (i) revalidatePath(`/admin/clientes/${i.cliente_id}`);
}

export async function salvarMetas(f: FormData) {
  await exigirEquipe();
  const cliente = txt(f, "cliente_id");
  const mes = `${txt(f, "mes")}-01`;
  if (!/^\d{4}-\d{2}-01$/.test(mes)) return;
  for (const kpi of ["faturamento", "vendas", "leads", "investido"]) {
    const bruto = txt(f, kpi).replace(/\./g, "").replace(",", ".");
    if (bruto === "") {
      await sql`delete from metas where cliente_id = ${cliente} and mes = ${mes} and kpi = ${kpi}`;
    } else if (Number.isFinite(Number(bruto))) {
      await sql`insert into metas (cliente_id, mes, kpi, valor) values (${cliente}, ${mes}, ${kpi}, ${Number(bruto)})
                on conflict (cliente_id, mes, kpi) do update set valor = excluded.valor`;
    }
  }
  revalidatePath(`/admin/clientes/${cliente}`);
}

export async function criarUsuario(f: FormData) {
  await exigirEquipe();
  const cliente = txt(f, "cliente_id");
  const email = txt(f, "email").toLowerCase();
  const senha = txt(f, "senha");
  const papel = txt(f, "papel") === "equipe" ? "equipe" : "cliente";
  if (!email.includes("@") || senha.length < 8) return;
  const hash = await bcrypt.hash(senha, 10);
  const [u] = await sql<{ id: string }[]>`
    insert into usuarios (email, nome, senha_hash, papel) values (${email}, ${txt(f, "nome") || null}, ${hash}, ${papel})
    on conflict (email) do update set senha_hash = excluded.senha_hash, ativo = true returning id`;
  if (papel === "cliente" && cliente) {
    await sql`insert into usuarios_clientes (usuario_id, cliente_id) values (${u.id}, ${cliente}) on conflict do nothing`;
  }
  revalidatePath(`/admin/clientes/${cliente}`);
}

export async function removerAcesso(f: FormData) {
  await exigirEquipe();
  const cliente = txt(f, "cliente_id");
  await sql`delete from usuarios_clientes where usuario_id = ${txt(f, "usuario_id")} and cliente_id = ${cliente}`;
  revalidatePath(`/admin/clientes/${cliente}`);
}
