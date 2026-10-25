"use server";

import { revalidatePath } from "next/cache";
import { clienteAtual, exigirSessao } from "@/lib/auth";
import { sql } from "@/lib/db";
import { atribuir, normalizarTelefone, ufPorTelefone } from "@/lib/atribuicao";
import { MOTIVOS_PERDA, etapasDo } from "@/lib/comercial";
import { ETAPAS_ASCENSAO } from "@/lib/ascensao-etapas";

type Retorno = { ok: true } | { ok: false; erro: string };

/** Cliente que o usuário está vendo agora; todas as escritas ficam presas a ele. */
async function clienteDaSessao() {
  const s = await exigirSessao();
  const { atual } = await clienteAtual(s);
  if (!atual) throw new Error("sem cliente");
  return { sessao: s, clienteId: atual.id };
}

export async function moverLead(id: string, etapa: string): Promise<Retorno> {
  const { clienteId } = await clienteDaSessao();
  const etapas = await etapasDo(clienteId);
  const destino = etapas.find((e) => e.chave === etapa);
  // Checkout e Venda vêm do dado real; não dá para arrastar um lead para lá
  if (!destino || (destino.estrutural && destino.chave !== "lead")) {
    return { ok: false, erro: "Checkout e Venda são preenchidos automaticamente pelas plataformas de venda." };
  }
  const r = await sql`update leads set etapa = ${etapa}, movido_em = now() where id = ${id} and cliente_id = ${clienteId}`;
  if (r.count === 0) return { ok: false, erro: "Lead não encontrado." };
  revalidatePath("/comercial");
  return { ok: true };
}

export async function salvarLead(id: string, dados: { sdr?: string; motivo_perda?: string | null; observacao?: string }): Promise<Retorno> {
  const { clienteId } = await clienteDaSessao();
  const motivo = dados.motivo_perda && MOTIVOS_PERDA.includes(dados.motivo_perda) ? dados.motivo_perda : null;
  await sql`
    update leads set sdr = ${dados.sdr?.trim().slice(0, 80) || null}, motivo_perda = ${motivo},
           observacao = ${dados.observacao?.trim().slice(0, 2000) || null}
    where id = ${id} and cliente_id = ${clienteId}`;
  revalidatePath("/comercial");
  return { ok: true };
}

export async function criarLeadManual(f: FormData): Promise<Retorno> {
  const { clienteId } = await clienteDaSessao();
  const telefone = normalizarTelefone(String(f.get("telefone") ?? ""));
  if (!telefone) return { ok: false, erro: "Telefone obrigatório (com DDD, mín. 10 dígitos)." };
  const [existe] = await sql`select 1 from leads where cliente_id = ${clienteId} and telefone = ${telefone} limit 1`;
  if (existe) return { ok: false, erro: "Já existe um lead com este telefone." };
  const origem = String(f.get("origem") ?? "").trim();
  const a = atribuir({ utm_source: origem || null, utm_medium: origem ? "manual" : null });
  await sql`
    insert into leads ${sql({
      cliente_id: clienteId,
      nome: String(f.get("nome") ?? "").trim().slice(0, 120) || null,
      telefone,
      email: String(f.get("email") ?? "").trim().toLowerCase() || null,
      uf: ufPorTelefone(telefone),
      sdr: String(f.get("sdr") ?? "").trim() || null,
      manual: true,
      categoria: origem ? a.categoria : "nao-definido",
      origem: origem || "Manual",
    })}`;
  revalidatePath("/comercial");
  return { ok: true };
}

export async function salvarEtapas(etapas: { chave: string; rotulo: string }[]): Promise<Retorno> {
  const { sessao, clienteId } = await clienteDaSessao();
  if (sessao.papel !== "equipe") return { ok: false, erro: "Só a equipe Mantora altera as etapas." };
  const atuais = await etapasDo(clienteId);
  const estruturais = atuais.filter((e) => e.estrutural).map((e) => e.chave);
  if (!estruturais.every((c) => etapas.some((e) => e.chave === c))) return { ok: false, erro: "Lead, Checkout e Venda não podem ser removidas." };
  if (etapas.length > 12) return { ok: false, erro: "Máximo de 12 etapas." };
  if (new Set(etapas.map((e) => e.chave)).size !== etapas.length) return { ok: false, erro: "Duas etapas com o mesmo identificador." };
  if (etapas.some((e) => !/^[a-z0-9_]{1,30}$/.test(e.chave) || !e.rotulo.trim() || e.rotulo.length > 40)) {
    return { ok: false, erro: "Nome de etapa inválido (até 40 caracteres)." };
  }
  await sql.begin(async (tx) => {
    await tx`delete from pipeline_etapas where cliente_id = ${clienteId}`;
    await tx`insert into pipeline_etapas ${tx(
      etapas.map((e, i) => ({ cliente_id: clienteId, chave: e.chave, rotulo: e.rotulo.trim(), ordem: i + 1, estrutural: estruturais.includes(e.chave) })),
    )}`;
    // Leads em etapas removidas voltam para "Lead"
    await tx`update leads set etapa = 'lead' where cliente_id = ${clienteId} and etapa <> all(${etapas.map((e) => e.chave)})`;
  });
  revalidatePath("/comercial");
  return { ok: true };
}

export async function moverAscensao(pessoa: string, etapa: string, responsavel?: string): Promise<Retorno> {
  const { clienteId } = await clienteDaSessao();
  if (etapa !== "fila" && !ETAPAS_ASCENSAO.some((e) => e.chave === etapa)) return { ok: false, erro: "Etapa inválida." };
  const [existe] = await sql`select 1 from vendas where cliente_id = ${clienteId} and chave_pessoa(telefone, email, documento) = ${pessoa} limit 1`;
  if (!existe) return { ok: false, erro: "Cliente não encontrado." };
  await sql`
    insert into ascensao_status (cliente_id, pessoa, etapa, responsavel)
    values (${clienteId}, ${pessoa}, ${etapa}, ${responsavel?.trim() || null})
    on conflict (cliente_id, pessoa) do update set etapa = excluded.etapa,
      responsavel = coalesce(excluded.responsavel, ascensao_status.responsavel), atualizado_em = now()`;
  revalidatePath("/comercial/ascensao");
  return { ok: true };
}

export async function salvarAscensao(pessoa: string, dados: { responsavel?: string; observacao?: string }): Promise<Retorno> {
  const { clienteId } = await clienteDaSessao();
  await sql`
    insert into ascensao_status (cliente_id, pessoa, responsavel, observacao)
    values (${clienteId}, ${pessoa}, ${dados.responsavel?.trim() || null}, ${dados.observacao?.trim().slice(0, 2000) || null})
    on conflict (cliente_id, pessoa) do update set responsavel = excluded.responsavel, observacao = excluded.observacao`;
  revalidatePath("/comercial/ascensao");
  return { ok: true };
}
