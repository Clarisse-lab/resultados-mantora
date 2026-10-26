import { describe, expect, it } from "vitest";
import { lerData, normalizar } from "./normalizar";

describe("Hotmart", () => {
  const base = {
    id: "evt-1",
    creation_date: 1729780000000,
    event: "PURCHASE_APPROVED",
    version: "2.0.0",
    data: {
      product: { id: 123, name: "Consultoria Anual" },
      buyer: {
        name: "Maria Teste",
        email: "MARIA@exemplo.com",
        checkout_phone: "11987654321",
        document: "123.456.789-00",
        address: { state: "São Paulo", city: "Campinas" },
      },
      purchase: {
        transaction: "HP123",
        order_date: 1729779000000,
        approved_date: 1729780000000,
        price: { value: 1197, currency_value: "BRL" },
        payment: { type: "PIX" },
        origin: { src: "utm_source=FB&utm_campaign=Perpetuo|120200000000000001&utm_content=Ad 1|120200000000000003" },
      },
    },
  };

  it("converte compra aprovada com UTMs dentro do src", () => {
    const r = normalizar("hotmart", base);
    expect(r.tipo).toBe("venda");
    if (r.tipo !== "venda") return;
    expect(r.venda).toMatchObject({
      id_externo: "HP123",
      status: "aprovada",
      valor: 1197,
      produto: "Consultoria Anual",
      email: "maria@exemplo.com",
      telefone: "11987654321",
      documento: "12345678900",
      uf: "SP",
      utm_source: "FB",
      utm_campaign: "Perpetuo|120200000000000001",
    });
    expect(r.venda.aprovado_em?.getTime()).toBe(1729780000000);
  });

  it("reembolso vira status reembolsada", () => {
    const r = normalizar("hotmart", { ...base, event: "PURCHASE_REFUNDED" });
    expect(r.tipo === "venda" && r.venda.status).toBe("reembolsada");
  });

  it("carrinho abandonado vira checkout", () => {
    const r = normalizar("hotmart", {
      id: "evt-2",
      creation_date: 1729780000000,
      event: "PURCHASE_OUT_OF_SHOPPING_CART",
      data: { product: { name: "X" }, buyer: { name: "A", email: "a@b.com", phone: "+55 (21) 99999-0000" } },
    });
    expect(r.tipo).toBe("checkout");
    if (r.tipo === "checkout") expect(r.checkout).toMatchObject({ id_externo: "evt-2", telefone: "21999990000", uf: "RJ" });
  });

  it("pedido de reembolso não altera a venda", () => {
    expect(normalizar("hotmart", { ...base, event: "PURCHASE_PROTEST" }).tipo).toBe("ignorado");
  });
});

describe("Kiwify", () => {
  const pedido = {
    order_id: "kw-9",
    order_status: "paid",
    webhook_event_type: "order_approved",
    payment_method: "credit_card",
    created_at: "2026-10-23 14:30",
    approved_date: "2026-10-23 14:31",
    Product: { product_id: "p1", product_name: "Consultoria Bimestral" },
    Customer: { full_name: "João", email: "joao@x.com", mobile: "+5567992793848", state: "MS", city: "Campo Grande" },
    Commissions: { charge_amount: 49400, currency: "BRL" },
    TrackingParameters: { utm_source: "ig", utm_medium: "bio", utm_campaign: null, src: null, sck: null },
  };

  it("converte pedido pago (valor em centavos, data sem fuso = Brasília)", () => {
    const r = normalizar("kiwify", pedido);
    expect(r.tipo).toBe("venda");
    if (r.tipo !== "venda") return;
    expect(r.venda).toMatchObject({ id_externo: "kw-9", status: "aprovada", valor: 494, telefone: "67992793848", uf: "MS", utm_medium: "bio" });
    expect(r.venda.aprovado_em?.toISOString()).toBe("2026-10-23T17:31:00.000Z");
  });

  it("carrinho abandonado vira checkout", () => {
    const r = normalizar("kiwify", { id: "ab1", status: "abandoned", name: "Z", email: "z@z.com", phone: "11911112222", product_name: "P", created_at: "2026-10-23T10:00:00Z" });
    expect(r.tipo).toBe("checkout");
  });

  it("status desconhecido é ignorado", () => {
    expect(normalizar("kiwify", { ...pedido, order_status: "algo" }).tipo).toBe("ignorado");
  });
});

describe("PagTrust / genérico", () => {
  it("lê os nomes de campo mais comuns", () => {
    const r = normalizar("pagtrust", {
      event: "sale.approved",
      transaction_id: "pt-77",
      status: "paid",
      amount: "1.077,30",
      created_at: "2026-10-23T14:30:00-03:00",
      customer: { name: "Ana", email: "ana@x.com", phone: "(91) 98133-0000", address: { state: "PA" } },
      product: { id: "9", name: "Semestral" },
      tracking: { utm_source: "FB", utm_campaign: "Camp|120200000000000009" },
    });
    expect(r.tipo).toBe("venda");
    if (r.tipo === "venda") expect(r.venda).toMatchObject({ id_externo: "pt-77", status: "aprovada", valor: 1077.3, uf: "PA", produto: "Semestral", utm_source: "FB" });
  });
});

describe("lerData", () => {
  it("aceita epoch em segundos e milissegundos", () => {
    expect(lerData(1729780000)?.getTime()).toBe(1729780000000);
    expect(lerData("1729780000000")?.getTime()).toBe(1729780000000);
  });
});

describe("PagTrust (webhook 2.0, formato Hotmart)", () => {
  const compra = (event: string, status: string) => ({
    id: "123",
    orderId: "456",
    creation_date: 1792991515000,
    event,
    version: "2.0.0",
    data: {
      product: { id: 99, name: "Produto Teste", has_co_production: false },
      buyer: { email: "c@x.com", name: "Cliente Teste", document: "12345678900", checkout_phone: "11987654321", address: { state: "", city: "" } },
      commissions: [{ value: 90, currency_value: "BRL", source: "PRODUCER" }],
      purchase: {
        approved_date: 1792991515000,
        price: { value: 197.9, currency_value: "BRL" },
        full_price: { value: 197.9, currency_value: "BRL" },
        origin: { xcod: "", src: "", sck: "", utmcampaign: "camp|120200000000000001", utmmedium: "conj", utmsource: "FB", content: "ad|120200000000000003", term: "" },
        order_date: 1792991500000,
        status,
        transaction: "789",
        payment: { installments_number: 1, type: "PIX" },
      },
    },
  });

  it("venda aprovada com valor, comprador e UTMs da origem", () => {
    const r = normalizar("pagtrust", compra("PURCHASE_APPROVED", "APPROVED"));
    expect(r.tipo).toBe("venda");
    if (r.tipo !== "venda") return;
    expect(r.venda).toMatchObject({
      id_externo: "789",
      status: "aprovada",
      valor: 197.9,
      nome: "Cliente Teste",
      telefone: "11987654321",
      uf: "SP",
      produto: "Produto Teste",
      utm_source: "FB",
      utm_campaign: "camp|120200000000000001",
      utm_content: "ad|120200000000000003",
    });
  });

  it("reembolso e chargeback atualizam a mesma transação", () => {
    const a = normalizar("pagtrust", compra("PURCHASE_REFUNDED", "REFUNDED"));
    const b = normalizar("pagtrust", compra("PURCHASE_CHARGEBACK", "CHARGEBACK"));
    expect(a.tipo === "venda" && a.venda.status).toBe("reembolsada");
    expect(b.tipo === "venda" && b.venda.id_externo).toBe("789");
    expect(b.tipo === "venda" && b.venda.status).toBe("chargeback");
  });

  it("carrinho abandonado vira checkout com UTMs", () => {
    const r = normalizar("pagtrust", {
      id: "c@x.com",
      creation_date: 1792991515000,
      event: "PURCHASE_OUT_OF_SHOPPING_CART",
      version: "2.0.0",
      data: {
        product: { id: 99, name: "Produto Teste" },
        buyer: { name: "Cliente Teste", email: "c@x.com", phone: "11987654321" },
        utms: { utm_source: "FB", utm_medium: "conj", utm_campaign: "camp", utm_content: "ad", utm_term: "feed" },
      },
    });
    expect(r.tipo).toBe("checkout");
    if (r.tipo === "checkout") expect(r.checkout).toMatchObject({ id_externo: "c@x.com-1792991515000", telefone: "11987654321", utm_source: "FB", utm_campaign: "camp" });
  });
});
