// Regras de atribuição: de onde veio cada lead/venda.
//
// Convenção de UTMs recomendada nos anúncios da Meta (mesma usada por Utmify e afins):
//   utm_source=FB&utm_campaign={{campaign.name}}|{{campaign.id}}
//   &utm_medium={{adset.name}}|{{adset.id}}&utm_content={{ad.name}}|{{ad.id}}&utm_term={{placement}}
// Com ela, cada venda casa com a linha de mídia pelo id, mesmo que o nome mude.

export type Utms = {
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
};

export type Atribuicao = {
  campanha_id: string | null;
  conjunto_id: string | null;
  anuncio_id: string | null;
  categoria: "pago" | "organico" | "nao-definido";
  origem: string;
};

const ID_META = /(?:^|[|_:\s-])(\d{10,20})$/;

/** Extrai o id numérico do fim de "Nome da campanha|1234567890". */
export function extrairId(valor?: string | null): string | null {
  if (!valor) return null;
  const m = valor.trim().match(ID_META);
  return m ? m[1] : null;
}

/** Remove o "|id" do fim, deixando só o nome legível. */
export function nomeSemId(valor?: string | null): string | null {
  if (!valor) return null;
  return valor.replace(/\|\s*\d{10,20}\s*$/, "").trim() || null;
}

const PAGO_SOURCES = /^(fb|facebook|ig|instagram|meta|metaads|facebook_ads|google|googleads|google_ads|adwords|gads|tiktok|tiktokads|kwai|youtube_ads)$/i;
const PAGO_MEDIUMS = /(cpc|cpm|cpa|paid|pago|ads?$|trafego|tráfego)/i;
const ORGANICO = /(organico|orgânico|organic|bio|stories|story|reels|feed|direct|dm|linktree|youtube|email|e-mail|whatsapp|wpp|grupo|newsletter|site|blog)/i;

function rotuloRede(source: string): string {
  const s = source.toLowerCase();
  if (/^(fb|facebook|meta)/.test(s)) return "Meta";
  if (/^(ig|instagram)/.test(s)) return "Instagram";
  if (/google|adwords|gads/.test(s)) return "Google";
  if (/tiktok/.test(s)) return "TikTok";
  if (/youtube|yt/.test(s)) return "YouTube";
  if (/whats|wpp/.test(s)) return "WhatsApp";
  if (/mail/.test(s)) return "E-mail";
  return source.charAt(0).toUpperCase() + source.slice(1);
}

export function atribuir(u: Utms, extra?: { ctwaclid?: string | null }): Atribuicao {
  const campanha_id = extrairId(u.utm_campaign);
  const conjunto_id = extrairId(u.utm_medium);
  const anuncio_id = extrairId(u.utm_content);
  const source = (u.utm_source ?? "").trim();
  const medium = (u.utm_medium ?? "").trim();
  const texto = `${source} ${medium} ${u.utm_campaign ?? ""}`;

  if (extra?.ctwaclid) {
    return { campanha_id, conjunto_id, anuncio_id, categoria: "pago", origem: "Meta Ads · WhatsApp" };
  }
  if (campanha_id || anuncio_id || PAGO_SOURCES.test(source) || (source && PAGO_MEDIUMS.test(medium))) {
    if (ORGANICO.test(texto) && !campanha_id && !anuncio_id && !PAGO_MEDIUMS.test(medium)) {
      return { campanha_id, conjunto_id, anuncio_id, categoria: "organico", origem: origemOrganica(source, medium) };
    }
    const rede = source ? rotuloRede(source) : "Meta";
    return { campanha_id, conjunto_id, anuncio_id, categoria: "pago", origem: `${rede === "Instagram" ? "Meta" : rede} Ads` };
  }
  if (source || medium) {
    return { campanha_id, conjunto_id, anuncio_id, categoria: "organico", origem: origemOrganica(source, medium) };
  }
  return { campanha_id, conjunto_id, anuncio_id, categoria: "nao-definido", origem: "Não definido" };
}

function origemOrganica(source: string, medium: string): string {
  const rede = source ? rotuloRede(source) : "";
  const onde = medium ? medium.charAt(0).toUpperCase() + medium.slice(1).toLowerCase() : "";
  return [onde, rede, "orgânico"].filter(Boolean).join(" ");
}

/** Lê UTMs de uma URL ou query string ("utm_source=x&..."), se houver. */
export function utmsDaUrl(url?: string | null): Utms {
  if (!url) return {};
  try {
    const q = url.includes("?") ? url.slice(url.indexOf("?") + 1) : url;
    const p = new URLSearchParams(q);
    return {
      utm_source: p.get("utm_source"),
      utm_medium: p.get("utm_medium"),
      utm_campaign: p.get("utm_campaign"),
      utm_content: p.get("utm_content"),
      utm_term: p.get("utm_term"),
    };
  } catch {
    return {};
  }
}

// DDD → UF. Usado quando a plataforma não manda o estado do comprador.
const DDD_UF: Record<string, string> = {};
const faixas: [string, number[]][] = [
  ["SP", [11, 12, 13, 14, 15, 16, 17, 18, 19]], ["RJ", [21, 22, 24]], ["ES", [27, 28]],
  ["MG", [31, 32, 33, 34, 35, 37, 38]], ["PR", [41, 42, 43, 44, 45, 46]], ["SC", [47, 48, 49]],
  ["RS", [51, 53, 54, 55]], ["DF", [61]], ["GO", [62, 64]], ["TO", [63]], ["MT", [65, 66]],
  ["MS", [67]], ["AC", [68]], ["RO", [69]], ["BA", [71, 73, 74, 75, 77]], ["SE", [79]],
  ["PE", [81, 87]], ["AL", [82]], ["PB", [83]], ["RN", [84]], ["CE", [85, 88]], ["PI", [86, 89]],
  ["PA", [91, 93, 94]], ["AM", [92, 97]], ["RR", [95]], ["AP", [96]], ["MA", [98, 99]],
];
for (const [uf, ddds] of faixas) for (const d of ddds) DDD_UF[String(d)] = uf;

/** Normaliza telefone brasileiro para só dígitos com DDD, sem o 55. */
export function normalizarTelefone(tel?: string | null): string | null {
  if (!tel) return null;
  let d = tel.replace(/\D/g, "");
  if (d.length >= 12 && d.startsWith("55")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return d.length >= 10 && d.length <= 11 ? d : null;
}

export function ufPorTelefone(tel?: string | null): string | null {
  const t = normalizarTelefone(tel);
  return t ? DDD_UF[t.slice(0, 2)] ?? null : null;
}

const UFS = new Set(faixas.map(([uf]) => uf));
const NOMES_UF: Record<string, string> = {
  acre: "AC", alagoas: "AL", amapa: "AP", amazonas: "AM", bahia: "BA", ceara: "CE",
  "distrito federal": "DF", "espirito santo": "ES", goias: "GO", maranhao: "MA",
  "mato grosso": "MT", "mato grosso do sul": "MS", "minas gerais": "MG", para: "PA",
  paraiba: "PB", parana: "PR", pernambuco: "PE", piaui: "PI", "rio de janeiro": "RJ",
  "rio grande do norte": "RN", "rio grande do sul": "RS", rondonia: "RO", roraima: "RR",
  "santa catarina": "SC", "sao paulo": "SP", sergipe: "SE", tocantins: "TO",
};

/** Aceita "SP", "sp", "São Paulo" etc. */
export function normalizarUf(valor?: string | null): string | null {
  if (!valor) return null;
  const v = valor.trim();
  if (UFS.has(v.toUpperCase())) return v.toUpperCase();
  const chave = v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return NOMES_UF[chave] ?? null;
}

/** Campanha de lançamento se o nome casar com alguma palavra configurada no cliente. */
export function contextoPorNome(nome: string | null | undefined, palavrasLancamento: string[]): "perpetuo" | "lancamento" {
  if (!nome || palavrasLancamento.length === 0) return "perpetuo";
  const n = nome.toLowerCase();
  return palavrasLancamento.some((p) => p.trim() && n.includes(p.trim().toLowerCase())) ? "lancamento" : "perpetuo";
}
