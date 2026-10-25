import { z } from "zod";
import { sql } from "../db";
import { atribuir, normalizarTelefone, normalizarUf, ufPorTelefone, utmsDaUrl } from "../atribuicao";
import type { Integracao } from "./ingestao";

// Formulários de captura (página de cadastro, typebot, ManyChat, Zapier...) postam aqui.
// Aceita JSON ou form-urlencoded, com nomes de campo em português ou inglês.
const texto = z.string().trim().max(500).optional().nullable();
const Lead = z.object({
  nome: texto,
  email: z.string().trim().max(200).optional().nullable(),
  telefone: texto,
  uf: texto,
  cidade: texto,
  pagina: z.string().trim().max(2000).optional().nullable(),
  utm_source: texto,
  utm_medium: texto,
  utm_campaign: texto,
  utm_content: texto,
  utm_term: texto,
  ctwaclid: texto,
});

const SINONIMOS: Record<string, keyof z.infer<typeof Lead>> = {
  name: "nome", full_name: "nome", first_name: "nome",
  phone: "telefone", whatsapp: "telefone", celular: "telefone", mobile: "telefone",
  state: "uf", estado: "uf", city: "cidade",
  page: "pagina", url: "pagina", page_url: "pagina", referrer: "pagina",
};

export function lerLead(bruto: Record<string, unknown>) {
  const o: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(bruto)) {
    const chave = SINONIMOS[k.toLowerCase()] ?? k.toLowerCase();
    if (o[chave] == null && v != null && v !== "") o[chave] = typeof v === "number" ? String(v) : v;
  }
  const lead = Lead.parse(o);
  // UTMs que não vieram nos campos podem estar na URL da página
  const daPagina = utmsDaUrl(lead.pagina);
  return {
    ...lead,
    utm_source: lead.utm_source ?? daPagina.utm_source ?? null,
    utm_medium: lead.utm_medium ?? daPagina.utm_medium ?? null,
    utm_campaign: lead.utm_campaign ?? daPagina.utm_campaign ?? null,
    utm_content: lead.utm_content ?? daPagina.utm_content ?? null,
    utm_term: lead.utm_term ?? daPagina.utm_term ?? null,
  };
}

export async function gravarLead(i: Integracao, bruto: Record<string, unknown>) {
  const l = lerLead(bruto);
  const telefone = normalizarTelefone(l.telefone);
  const email = l.email?.toLowerCase() || null;
  if (!telefone && !email) throw new Error("informe telefone ou e-mail");

  // O mesmo contato no mesmo dia conta uma vez só
  const [existente] = await sql<{ id: string }[]>`
    select id from leads
    where cliente_id = ${i.cliente_id}
      and criado_em > now() - interval '24 hours'
      and ((${telefone}::text is not null and telefone = ${telefone}) or (${email}::text is not null and email = ${email}))
    limit 1`;
  if (existente) return { id: existente.id, duplicado: true };

  const a = atribuir(l, { ctwaclid: l.ctwaclid });
  const [novo] = await sql<{ id: string }[]>`
    insert into leads ${sql({
      cliente_id: i.cliente_id,
      integracao_id: i.id,
      nome: l.nome ?? null,
      email,
      telefone,
      uf: normalizarUf(l.uf) ?? ufPorTelefone(telefone),
      cidade: l.cidade ?? null,
      pagina: l.pagina ?? null,
      utm_source: l.utm_source,
      utm_medium: l.utm_medium,
      utm_campaign: l.utm_campaign,
      utm_content: l.utm_content,
      utm_term: l.utm_term,
      ctwaclid: l.ctwaclid ?? null,
      campanha_id: a.campanha_id,
      conjunto_id: a.conjunto_id,
      anuncio_id: a.anuncio_id,
      categoria: a.categoria,
      origem: a.origem,
    })} returning id`;
  await sql`update integracoes set ultimo_evento_em = now() where id = ${i.id}`;
  return { id: novo.id, duplicado: false };
}
