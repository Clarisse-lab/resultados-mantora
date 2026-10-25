// Dados fictícios para desenvolvimento: um cliente de demonstração com 60 dias de mídia, leads e vendas.
// Uso: npm run db:seed   (não rode em produção — cria um usuário de teste)
import bcrypt from "bcryptjs";
import { sql } from "../src/lib/db";
import { atribuir, ufPorTelefone } from "../src/lib/atribuicao";

if (process.env.NODE_ENV === "production") {
  console.error("seed é só para desenvolvimento");
  process.exit(1);
}

let semente = 42;
const rnd = () => ((semente = (semente * 16807) % 2147483647) - 1) / 2147483646;
const escolher = <T>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];
const DIAS = 60;

const [cliente] = await sql<{ id: string }[]>`
  insert into clientes (nome, slug, palavras_lancamento) values ('Cliente Demonstração', 'demo', '{lanc_}')
  on conflict (slug) do update set nome = excluded.nome returning id`;
const cid = cliente.id;
await sql`delete from vendas where cliente_id = ${cid}`;
await sql`delete from leads where cliente_id = ${cid}`;
await sql`delete from checkouts where cliente_id = ${cid}`;
await sql`delete from midia_diaria where cliente_id = ${cid}`;
await sql`delete from integracoes where cliente_id = ${cid}`;
await sql`delete from metas where cliente_id = ${cid}`;
await sql`delete from ascensao_status where cliente_id = ${cid}`;

await sql`insert into integracoes (cliente_id, tipo, nome) values
  (${cid}, 'kiwify', 'Kiwify'), (${cid}, 'hotmart', 'Hotmart'), (${cid}, 'captura_leads', 'Página de cadastro')`;
await sql`insert into integracoes (cliente_id, tipo, nome, conta_id) values (${cid}, 'meta_ads', 'Meta Ads', '1234567890')`;

const hash = await bcrypt.hash("mantora123", 10);
await sql`insert into usuarios (email, nome, senha_hash, papel) values ('equipe@mantora.local', 'Equipe Mantora', ${hash}, 'equipe')
  on conflict (email) do nothing`;
const [ucli] = await sql<{ id: string }[]>`insert into usuarios (email, nome, senha_hash, papel) values ('cliente@demo.local', 'Cliente Demo', ${hash}, 'cliente')
  on conflict (email) do update set nome = excluded.nome returning id`;
await sql`insert into usuarios_clientes values (${ucli.id}, ${cid}) on conflict do nothing`;

// Estrutura de campanhas
const campanhas = [
  { id: "120200000000000101", nome: "fase3_venda_consultoria_abo_quente", peso: 1.4 },
  { id: "120200000000000102", nome: "fase3_venda_consultoria_cbo_lal", peso: 1.0 },
  { id: "120200000000000103", nome: "fase5_mensagens_treino_gratuito", peso: 0.7 },
  { id: "120200000000000104", nome: "lanc_black_captacao", peso: 0.6 },
];
const anuncios = campanhas.flatMap((c, ci) =>
  [1, 2].flatMap((cj) => {
    const conjunto = { id: `1202000000000${ci}${cj}00`, nome: `${c.nome.split("_")[0]}_conj_${cj === 1 ? "quente" : "frio"}` };
    return [1, 2, 3].map((a) => ({
      campanha: c,
      conjunto,
      id: `1202000000000${ci}${cj}0${a}`,
      nome: `AD${a}_${escolher(["video_depoimento", "carrossel_antes_depois", "reels_rotina", "estatico_oferta"])}`,
      eficiencia: 0.5 + rnd(),
    }));
  }),
);

const produtos = [
  { nome: "Consultoria Personalizada Bimestral", valor: 494 },
  { nome: "Consultoria Personalizada Semestral", valor: 1077.3 },
  { nome: "Consultoria Personalizada Anual", valor: 1197 },
];
const nomes = ["Ana", "Bruna", "Carla", "Daniela", "Elisa", "Fernanda", "Gabriela", "Helena", "Isabela", "Juliana", "Karina", "Larissa", "Mariana", "Natália", "Patrícia", "Renata", "Sabrina", "Tatiane", "Vanessa"];
const sobrenomes = ["Silva", "Souza", "Oliveira", "Santos", "Lima", "Pereira", "Costa", "Almeida", "Rocha", "Martins"];
const ddds = [11, 11, 11, 11, 21, 21, 31, 41, 47, 51, 61, 62, 67, 71, 81, 85, 91, 35, 19, 12];
const cidades: Record<string, string[]> = { SP: ["São Paulo", "Campinas", "Santos"], RJ: ["Rio de Janeiro", "Niterói"], MG: ["Belo Horizonte", "Uberlândia"] };

const telefone = () => `${escolher(ddds)}9${String(Math.floor(rnd() * 1e8)).padStart(8, "0")}`;
const hoje = new Date();
const midia: Record<string, unknown>[] = [];
const leads: Record<string, unknown>[] = [];
const vendas: Record<string, unknown>[] = [];
const checkouts: Record<string, unknown>[] = [];

for (let d = DIAS - 1; d >= 0; d--) {
  const dia = new Date(hoje.getTime() - d * 86400000);
  const data = dia.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const sazonal = 1 + 0.35 * Math.sin(d / 4) + (d === 3 ? 1.8 : 0); // um pico para o gráfico ficar interessante
  for (const ad of anuncios) {
    const lanc = ad.campanha.nome.startsWith("lanc_");
    if (lanc && d > 20) continue;
    const investido = Math.round(55 * ad.campanha.peso * sazonal * (0.6 + rnd()) * 100) / 100;
    const impressoes = Math.round(investido * (55 + rnd() * 40));
    const cliques = Math.round(impressoes * (0.012 + rnd() * 0.01));
    const pv = Math.round(cliques * (0.12 + rnd() * 0.08));
    midia.push({
      cliente_id: cid, plataforma: "meta", data, conta_id: "1234567890",
      campanha_id: ad.campanha.id, campanha_nome: ad.campanha.nome,
      conjunto_id: ad.conjunto.id, conjunto_nome: ad.conjunto.nome,
      anuncio_id: ad.id, anuncio_nome: ad.nome,
      investido, impressoes, cliques, page_views: pv, leads_plataforma: 0,
      contexto: lanc ? "lancamento" : "perpetuo",
    });
    const nLeads = Math.round(pv * (0.12 + rnd() * 0.06) * ad.eficiencia);
    for (let k = 0; k < nLeads; k++) {
      const quando = new Date(dia.getTime() - rnd() * 86400000 * 0.9);
      const tel = telefone();
      const utms = {
        utm_source: "FB",
        utm_campaign: `${ad.campanha.nome}|${ad.campanha.id}`,
        utm_medium: `${ad.conjunto.nome}|${ad.conjunto.id}`,
        utm_content: `${ad.nome}|${ad.id}`,
        utm_term: escolher(["Instagram_Feed", "Instagram_Stories", "Instagram_Reels", "Facebook_Mobile_Feed"]),
      };
      const a = atribuir(utms);
      const nome = `${escolher(nomes)} ${escolher(sobrenomes)}`;
      const uf = ufPorTelefone(tel);
      leads.push({ cliente_id: cid, criado_em: quando, nome, telefone: tel, uf, ...utms, ...a, categoria: a.categoria, origem: a.origem });
      const r = rnd();
      if (r < 0.11 * ad.eficiencia) {
        const p = escolher(produtos);
        vendas.push({
          cliente_id: cid, provedor: escolher(["kiwify", "hotmart"]), id_externo: `demo-${vendas.length}`,
          criado_em: quando, aprovado_em: new Date(quando.getTime() + rnd() * 3600000), status: rnd() < 0.04 ? "reembolsada" : "aprovada",
          status_bruto: "demo", nome, telefone: tel, uf, cidade: uf && cidades[uf] ? escolher(cidades[uf]) : null,
          produto: p.nome, valor: p.valor, metodo: escolher(["pix", "credit_card"]), ...utms, ...a,
          contexto: lanc ? "lancamento" : "perpetuo",
        });
      } else if (r < 0.2) {
        checkouts.push({
          cliente_id: cid, provedor: "kiwify", id_externo: `demo-ck-${checkouts.length}`, criado_em: quando, nome,
          telefone: tel, uf, produto: escolher(produtos).nome, ...utms, ...a,
        });
      }
    }
  }
  // Vendas e leads orgânicos / sem origem
  for (let k = 0; k < 3 + Math.floor(rnd() * 4); k++) {
    const quando = new Date(dia.getTime() - rnd() * 86400000 * 0.9);
    const tel = telefone();
    const origemBruta = escolher([{ utm_source: "ig", utm_medium: "bio" }, { utm_source: "ig", utm_medium: "stories" }, {}]);
    const a = atribuir(origemBruta);
    const nome = `${escolher(nomes)} ${escolher(sobrenomes)}`;
    leads.push({ cliente_id: cid, criado_em: quando, nome, telefone: tel, uf: rnd() < 0.9 ? ufPorTelefone(tel) : null, ...origemBruta, ...a });
    if (rnd() < 0.35) {
      const p = escolher(produtos);
      vendas.push({
        cliente_id: cid, provedor: "kiwify", id_externo: `demo-${vendas.length}`, criado_em: quando, aprovado_em: quando,
        status: "aprovada", status_bruto: "demo", nome, telefone: tel, uf: ufPorTelefone(tel), produto: p.nome, valor: p.valor,
        metodo: "pix", ...origemBruta, ...a, contexto: "perpetuo",
      });
    }
  }
}

// Parte dos compradores volta a comprar (renovação/upgrade) — alimenta a LTV Ascensão
for (const v of [...vendas]) {
  if (rnd() < 0.18) {
    const depois = new Date((v.aprovado_em as Date).getTime() + (20 + rnd() * 120) * 86400000);
    if (depois > hoje) continue;
    const p = escolher(produtos);
    vendas.push({ ...v, id_externo: `demo-${vendas.length}`, criado_em: depois, aprovado_em: depois, produto: p.nome, valor: p.valor, status: "aprovada" });
  }
}
// Histórico mais antigo, para a carteira ter clientes de meses atrás
for (let k = 0; k < 400; k++) {
  const quando = new Date(hoje.getTime() - (DIAS + rnd() * 300) * 86400000);
  const tel = telefone();
  const p = escolher(produtos);
  const nome = `${escolher(nomes)} ${escolher(sobrenomes)}`;
  const compras = rnd() < 0.25 ? 2 + Math.floor(rnd() * 3) : 1;
  for (let c = 0; c < compras; c++) {
    const d = new Date(quando.getTime() + c * (40 + rnd() * 80) * 86400000);
    if (d > hoje) break;
    vendas.push({
      cliente_id: cid, provedor: "hotmart", id_externo: `demo-${vendas.length}`, criado_em: d, aprovado_em: d,
      status: "aprovada", status_bruto: "demo", nome, telefone: tel, uf: ufPorTelefone(tel), produto: p.nome, valor: p.valor,
      metodo: "credit_card", categoria: "nao-definido", origem: "Não definido", contexto: "perpetuo",
    });
  }
}
// Leads trabalhados pelos SDRs
const SDRS = ["Camila", "Rafael", "Bianca"];
for (const l of leads) {
  const r = rnd();
  l.etapa = "lead";
  if (r < 0.5) l.sdr = escolher(SDRS);
  if (r < 0.06) l.etapa = "agendamento";
  else if (r < 0.09) l.etapa = "call";
  if (rnd() < 0.05) l.motivo_perda = escolher(["Sem orçamento", "Sem retorno / sumiu", "Adiou a decisão", "Sem perfil"]);
}

const inserir = async (tabela: string, linhas: Record<string, unknown>[]) => {
  for (let i = 0; i < linhas.length; i += 500) await sql`insert into ${sql(tabela)} ${sql(linhas.slice(i, i + 500) as never)}`;
};
// Normaliza as chaves (todas as linhas precisam das mesmas colunas)
const uniformizar = (linhas: Record<string, unknown>[]) => {
  const chaves = [...new Set(linhas.flatMap(Object.keys))];
  return linhas.map((l) => Object.fromEntries(chaves.map((k) => [k, l[k] ?? null])));
};
await inserir("midia_diaria", midia);
await inserir("leads", uniformizar(leads));
await inserir("vendas", uniformizar(vendas));
await inserir("checkouts", uniformizar(checkouts));

const mes = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 1)).toISOString().slice(0, 10);
await sql`insert into metas (cliente_id, mes, kpi, valor) values
  (${cid}, ${mes}, 'faturamento', 220000), (${cid}, ${mes}, 'vendas', 200), (${cid}, ${mes}, 'leads', 3500), (${cid}, ${mes}, 'investido', 75000)`;

console.log(`demo: ${midia.length} linhas de mídia, ${leads.length} leads, ${vendas.length} vendas, ${checkouts.length} checkouts`);
console.log("login de teste: equipe@mantora.local / mantora123  (cliente: cliente@demo.local / mantora123)");
await sql.end();
