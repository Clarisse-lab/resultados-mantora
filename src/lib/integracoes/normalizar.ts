// Converte o webhook de cada plataforma de venda num formato único.
// Cada provedor tem um adaptador; os campos de UTM são procurados no payload inteiro
// porque cada plataforma os coloca num lugar diferente.

import { normalizarTelefone, normalizarUf, ufPorTelefone, utmsDaUrl, type Utms } from "../atribuicao";

export type StatusVenda = "aprovada" | "reembolsada" | "chargeback" | "cancelada" | "pendente" | "recusada";

export type Pessoa = {
  nome: string | null;
  email: string | null;
  telefone: string | null;
  documento: string | null;
  uf: string | null;
  cidade: string | null;
};

export type VendaNormalizada = Pessoa &
  Utms & {
    id_externo: string;
    criado_em: Date;
    aprovado_em: Date | null;
    status: StatusVenda;
    status_bruto: string;
    produto: string | null;
    produto_id: string | null;
    valor: number;
    moeda: string;
    metodo: string | null;
    src: string | null;
    sck: string | null;
  };

export type CheckoutNormalizado = Pessoa &
  Utms & {
    id_externo: string;
    criado_em: Date;
    produto: string | null;
    valor: number | null;
  };

export type Resultado =
  | { tipo: "venda"; venda: VendaNormalizada }
  | { tipo: "checkout"; checkout: CheckoutNormalizado }
  | { tipo: "ignorado"; motivo: string };

export type Provedor = "hotmart" | "kiwify" | "pagtrust";

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null =>
  typeof v === "string" ? v.trim() || null : typeof v === "number" ? String(v) : null;

/** Lê um caminho "a.b.c" sem quebrar se algo no meio faltar. */
function ler(o: unknown, caminho: string): unknown {
  let atual: unknown = o;
  for (const parte of caminho.split(".")) {
    if (!isObj(atual)) return undefined;
    atual = atual[parte];
  }
  return atual;
}

/** Primeiro caminho com valor não vazio. */
function primeiro(o: unknown, ...caminhos: string[]): string | null {
  for (const c of caminhos) {
    const v = str(ler(o, c));
    if (v) return v;
  }
  return null;
}

/** Procura chaves em qualquer profundidade (para UTMs espalhadas pelo payload). */
function buscarChave(o: unknown, chave: string, prof = 0): string | null {
  if (prof > 6) return null;
  if (Array.isArray(o)) {
    for (const item of o) {
      const v = buscarChave(item, chave, prof + 1);
      if (v) return v;
    }
    return null;
  }
  if (!isObj(o)) return null;
  for (const [k, v] of Object.entries(o)) {
    if (k.toLowerCase() === chave) {
      const s = str(v);
      if (s) return s;
    }
  }
  for (const v of Object.values(o)) {
    const achado = buscarChave(v, chave, prof + 1);
    if (achado) return achado;
  }
  return null;
}

function utmsDoPayload(p: unknown): Utms & { src: string | null; sck: string | null } {
  const src = buscarChave(p, "src");
  const sck = buscarChave(p, "sck");
  const u: Utms = {
    utm_source: buscarChave(p, "utm_source"),
    utm_medium: buscarChave(p, "utm_medium"),
    utm_campaign: buscarChave(p, "utm_campaign"),
    utm_content: buscarChave(p, "utm_content"),
    utm_term: buscarChave(p, "utm_term"),
  };
  // Algumas plataformas (Hotmart) só repassam src/sck; há quem coloque a query de UTMs inteira neles.
  for (const bruto of [src, sck, buscarChave(p, "xcod")]) {
    if (bruto && bruto.includes("utm_")) {
      const extra = utmsDaUrl(bruto);
      for (const k of Object.keys(extra) as (keyof Utms)[]) u[k] = u[k] ?? extra[k];
    }
  }
  if (!u.utm_source && src && !src.includes("=")) u.utm_source = src;
  return { ...u, src, sck };
}

/** Datas chegam como epoch (ms ou s), ISO ou "AAAA-MM-DD HH:mm" sem fuso (assumimos Brasília). */
export function lerData(v: unknown): Date | null {
  if (v == null || v === "") return null;
  if (typeof v === "number" || (typeof v === "string" && /^\d{10,13}$/.test(v))) {
    const n = Number(v);
    return new Date(n < 1e12 ? n * 1000 : n);
  }
  if (typeof v !== "string") return null;
  const s = v.trim();
  const semFuso = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(s);
  const d = new Date(semFuso ? `${s.replace(" ", "T")}-03:00` : s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function lerNumero(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string" || !v.trim()) return null;
  const s = v.trim();
  // "1.197,00" (pt-BR) ou "1197.00"
  const n = /,\d{1,2}$/.test(s) ? Number(s.replace(/\./g, "").replace(",", ".")) : Number(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function pessoa(dados: {
  nome?: string | null;
  email?: string | null;
  telefone?: string | null;
  documento?: string | null;
  uf?: string | null;
  cidade?: string | null;
}): Pessoa {
  const telefone = normalizarTelefone(dados.telefone);
  return {
    nome: dados.nome ?? null,
    email: dados.email?.toLowerCase() ?? null,
    telefone,
    documento: dados.documento?.replace(/\D/g, "") || null,
    uf: normalizarUf(dados.uf) ?? ufPorTelefone(telefone),
    cidade: dados.cidade ?? null,
  };
}

// ---------------------------------------------------------------- Hotmart (postback 2.0)

const HOTMART_STATUS: Record<string, StatusVenda | null> = {
  PURCHASE_APPROVED: "aprovada",
  PURCHASE_COMPLETE: "aprovada",
  PURCHASE_REFUNDED: "reembolsada",
  PURCHASE_CHARGEBACK: "chargeback",
  PURCHASE_CANCELED: "cancelada",
  PURCHASE_EXPIRED: "cancelada",
  PURCHASE_BILLET_PRINTED: "pendente",
  PURCHASE_DELAYED: "pendente",
  PURCHASE_PROTEST: null, // pedido de reembolso: mantém o status atual até a Hotmart decidir
};

function hotmart(p: Obj): Resultado {
  const evento = str(p.event) ?? "";
  const d = isObj(p.data) ? p.data : p;

  if (evento === "PURCHASE_OUT_OF_SHOPPING_CART") {
    return {
      tipo: "checkout",
      checkout: {
        // Hotmart manda um id único por evento; a PagTrust manda o e-mail do comprador no id
        id_externo:
          str(p.id) && !str(p.id)!.includes("@")
            ? str(p.id)!
            : `${str(p.id) ?? primeiro(d, "buyer.email") ?? ""}-${str(p.creation_date) ?? Date.now()}`,
        criado_em: lerData(p.creation_date) ?? new Date(),
        produto: primeiro(d, "product.name"),
        valor: lerNumero(ler(d, "offer.price.value") ?? ler(d, "purchase.price.value")),
        ...pessoa({
          nome: primeiro(d, "buyer.name"),
          email: primeiro(d, "buyer.email"),
          telefone: primeiro(d, "buyer.phone", "buyer.checkout_phone"),
        }),
        ...utmsDoPayload(d),
      },
    };
  }

  if (!(evento in HOTMART_STATUS)) return { tipo: "ignorado", motivo: `evento Hotmart não tratado: ${evento || "(vazio)"}` };
  const status = HOTMART_STATUS[evento];
  if (!status) return { tipo: "ignorado", motivo: `${evento}: mantém o status atual` };

  const transacao = primeiro(d, "purchase.transaction");
  if (!transacao) return { tipo: "ignorado", motivo: "Hotmart sem purchase.transaction" };

  const ddi = primeiro(d, "buyer.checkout_phone_code");
  const tel = primeiro(d, "buyer.checkout_phone", "buyer.phone");
  return {
    tipo: "venda",
    venda: {
      id_externo: transacao,
      criado_em: lerData(ler(d, "purchase.order_date")) ?? lerData(p.creation_date) ?? new Date(),
      aprovado_em: status === "aprovada" ? lerData(ler(d, "purchase.approved_date")) ?? lerData(p.creation_date) ?? new Date() : null,
      status,
      status_bruto: evento,
      produto: primeiro(d, "product.name"),
      produto_id: primeiro(d, "product.id"),
      valor: lerNumero(ler(d, "purchase.price.value") ?? ler(d, "purchase.full_price.value")) ?? 0,
      moeda: primeiro(d, "purchase.price.currency_value") ?? "BRL",
      metodo: primeiro(d, "purchase.payment.type"),
      ...pessoa({
        nome: primeiro(d, "buyer.name"),
        email: primeiro(d, "buyer.email"),
        telefone: tel && ddi && ddi !== "55" && !tel.startsWith(ddi) ? null : tel,
        documento: primeiro(d, "buyer.document"),
        uf: primeiro(d, "buyer.address.state"),
        cidade: primeiro(d, "buyer.address.city"),
      }),
      ...utmsComOrigem(d),
    },
  };
}

/** UTMs da compra: Hotmart (src/sck) e PagTrust (purchase.origin.utmsource, utmcampaign, content, term). */
function utmsComOrigem(d: unknown) {
  const u = utmsDoPayload(ler(d, "purchase.origin") ?? d);
  const o = ler(d, "purchase.origin");
  return {
    ...u,
    utm_source: primeiro(o, "utmsource") ?? u.utm_source ?? null,
    utm_medium: primeiro(o, "utmmedium") ?? u.utm_medium ?? null,
    utm_campaign: primeiro(o, "utmcampaign") ?? u.utm_campaign ?? null,
    utm_content: primeiro(o, "utmcontent", "content") ?? u.utm_content ?? null,
    utm_term: primeiro(o, "utmterm", "term") ?? u.utm_term ?? null,
  };
}

// ---------------------------------------------------------------- Kiwify

const KIWIFY_STATUS: Record<string, StatusVenda> = {
  paid: "aprovada",
  approved: "aprovada",
  refunded: "reembolsada",
  chargedback: "chargeback",
  chargeback: "chargeback",
  waiting_payment: "pendente",
  pending: "pendente",
  refused: "recusada",
  canceled: "cancelada",
};

function kiwify(p: Obj): Resultado {
  // Carrinho abandonado tem formato próprio (sem order_id)
  if (str(p.status) === "abandoned" || str(p.webhook_event_type) === "abandoned_cart") {
    return {
      tipo: "checkout",
      checkout: {
        id_externo: primeiro(p, "id", "checkout_link") ?? `${str(p.email)}-${str(p.created_at)}`,
        criado_em: lerData(p.created_at) ?? new Date(),
        produto: primeiro(p, "product_name", "offer_name"),
        valor: null,
        ...pessoa({ nome: str(p.name), email: str(p.email), telefone: str(p.phone) }),
        ...utmsDoPayload(p),
      },
    };
  }

  const pedido = str(p.order_id);
  if (!pedido) return { tipo: "ignorado", motivo: "Kiwify sem order_id" };
  const bruto = (str(p.order_status) ?? "").toLowerCase();
  const status = KIWIFY_STATUS[bruto];
  if (!status) return { tipo: "ignorado", motivo: `status Kiwify não tratado: ${bruto || "(vazio)"}` };

  // Kiwify manda valores em centavos (ex.: 9700 = R$ 97,00)
  const centavos = lerNumero(ler(p, "Commissions.charge_amount") ?? ler(p, "Commissions.product_base_price"));
  return {
    tipo: "venda",
    venda: {
      id_externo: pedido,
      criado_em: lerData(p.created_at) ?? new Date(),
      aprovado_em: status === "aprovada" ? lerData(p.approved_date) ?? lerData(p.updated_at) ?? new Date() : null,
      status,
      status_bruto: str(p.webhook_event_type) ?? bruto,
      produto: primeiro(p, "Product.product_name"),
      produto_id: primeiro(p, "Product.product_id"),
      valor: centavos != null ? centavos / 100 : 0,
      moeda: primeiro(p, "Commissions.currency", "Commissions.product_base_price_currency") ?? "BRL",
      metodo: str(p.payment_method),
      ...pessoa({
        nome: primeiro(p, "Customer.full_name", "Customer.first_name"),
        email: primeiro(p, "Customer.email"),
        telefone: primeiro(p, "Customer.mobile"),
        documento: primeiro(p, "Customer.CPF", "Customer.cnpj"),
        uf: primeiro(p, "Customer.state"),
        cidade: primeiro(p, "Customer.city"),
      }),
      ...utmsDoPayload(ler(p, "TrackingParameters") ?? p),
    },
  };
}

// ---------------------------------------------------------------- PagTrust e genérico
// Não há documentação pública estável do payload da PagTrust; o adaptador procura os
// nomes de campo mais comuns. O payload cru fica salvo, então dá para ajustar e reprocessar
// assim que chegar o primeiro webhook real.

const STATUS_GENERICO: [RegExp, StatusVenda][] = [
  [/chargeback|chargedback|contestad/i, "chargeback"],
  [/refund|reembols|estorn|devolv/i, "reembolsada"],
  [/cancel|expired|expirad/i, "cancelada"],
  [/refus|recusad|declin|fail|negad/i, "recusada"],
  [/abandon/i, "pendente"],
  [/wait|pend|aguard|billet|boleto_gerado|pix_gerado|created|process/i, "pendente"],
  [/approv|aprovad|paid|pago|complete|conclu|success|confirm/i, "aprovada"],
];

function generico(p: Obj): Resultado {
  const bruto =
    primeiro(p, "status", "payment_status", "transaction_status", "data.status", "sale.status", "order.status", "event", "type") ?? "";
  if (/abandon/i.test(bruto)) {
    return {
      tipo: "checkout",
      checkout: {
        id_externo: primeiro(p, "id", "checkout_id", "data.id") ?? `${buscarChave(p, "email")}-${Date.now()}`,
        criado_em: lerData(buscarChave(p, "created_at")) ?? new Date(),
        produto: buscarChave(p, "product_name") ?? primeiro(p, "product.name", "data.product.name"),
        valor: null,
        ...pessoa({ nome: buscarChave(p, "name"), email: buscarChave(p, "email"), telefone: buscarChave(p, "phone") ?? buscarChave(p, "mobile") }),
        ...utmsDoPayload(p),
      },
    };
  }
  const status = STATUS_GENERICO.find(([re]) => re.test(bruto))?.[1];
  if (!status) return { tipo: "ignorado", motivo: `status não reconhecido: ${bruto || "(vazio)"}` };

  const id =
    primeiro(p, "transaction_id", "transaction", "order_id", "sale_id", "code", "data.transaction_id", "data.id", "sale.id", "order.id", "id");
  if (!id) return { tipo: "ignorado", motivo: "sem identificador da transação" };

  const valorBruto =
    ler(p, "amount") ?? ler(p, "value") ?? ler(p, "total") ?? ler(p, "price") ?? ler(p, "data.amount") ??
    ler(p, "sale.amount") ?? ler(p, "order.amount") ?? ler(p, "payment.amount") ?? ler(p, "offer.price");
  const valor = lerNumero(isObj(valorBruto) ? valorBruto.value ?? valorBruto.amount : valorBruto) ?? 0;

  const cliente = ["customer", "buyer", "client", "cliente", "comprador", "data.customer", "sale.customer"]
    .map((c) => ler(p, c))
    .find(isObj) ?? p;
  const endereco = (isObj(cliente.address) ? cliente.address : isObj(cliente.endereco) ? cliente.endereco : cliente) as Obj;

  return {
    tipo: "venda",
    venda: {
      id_externo: id,
      criado_em: lerData(primeiro(p, "created_at", "createdAt", "order_date", "date", "data.created_at")) ?? new Date(),
      aprovado_em:
        status === "aprovada"
          ? lerData(primeiro(p, "approved_at", "approved_date", "paid_at", "data.paid_at", "updated_at")) ?? new Date()
          : null,
      status,
      status_bruto: bruto,
      produto: primeiro(p, "product.name", "product_name", "data.product.name", "offer.name", "items.0.name"),
      produto_id: primeiro(p, "product.id", "product_id", "data.product.id"),
      valor,
      moeda: primeiro(p, "currency", "data.currency") ?? "BRL",
      metodo: primeiro(p, "payment_method", "payment.method", "payment_type", "data.payment_method"),
      ...pessoa({
        nome: primeiro(cliente, "name", "full_name", "nome"),
        email: primeiro(cliente, "email"),
        telefone: primeiro(cliente, "phone", "mobile", "cellphone", "telefone", "phone_number"),
        documento: primeiro(cliente, "document", "cpf", "doc", "documento"),
        uf: primeiro(endereco, "state", "uf", "estado"),
        cidade: primeiro(endereco, "city", "cidade"),
      }),
      ...utmsDoPayload(p),
    },
  };
}

function porProvedor(provedor: Provedor, payload: Obj): Resultado {
  if (provedor === "hotmart") return hotmart(payload);
  // A PagTrust (webhook versão 2.0) segue o formato da Hotmart: event + data.purchase/buyer
  if (provedor === "pagtrust" && typeof payload.event === "string" && isObj(payload.data)) return hotmart(payload);
  if (provedor === "kiwify") return kiwify(payload);
  return generico(payload);
}

const DIA = 86400000;

/**
 * Eventos de teste das plataformas trazem datas de exemplo (às vezes de anos atrás). Se a data
 * informada estiver a mais de um ano do recebimento, ou no futuro, vale o momento do recebimento.
 */
function dataPlausivel(d: Date | null, recebidoEm: Date): Date | null {
  if (!d) return d;
  const dif = recebidoEm.getTime() - d.getTime();
  return dif > 365 * DIA || dif < -DIA ? recebidoEm : d;
}

export function normalizar(provedor: Provedor, payload: unknown, recebidoEm: Date = new Date()): Resultado {
  if (!isObj(payload)) return { tipo: "ignorado", motivo: "payload não é um objeto JSON" };
  const r = porProvedor(provedor, payload);
  if (r.tipo === "venda") {
    r.venda.criado_em = dataPlausivel(r.venda.criado_em, recebidoEm)!;
    r.venda.aprovado_em = dataPlausivel(r.venda.aprovado_em, recebidoEm);
  } else if (r.tipo === "checkout") {
    r.checkout.criado_em = dataPlausivel(r.checkout.criado_em, recebidoEm)!;
  }
  return r;
}

/** Nome do evento para o log. */
export function tipoEvento(payload: unknown): string | null {
  if (!isObj(payload)) return null;
  return primeiro(payload, "event", "webhook_event_type", "type", "status", "order_status");
}
