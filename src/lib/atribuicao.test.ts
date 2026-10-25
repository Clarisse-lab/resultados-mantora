import { describe, expect, it } from "vitest";
import { atribuir, contextoPorNome, extrairId, nomeSemId, normalizarTelefone, normalizarUf, ufPorTelefone } from "./atribuicao";

describe("atribuir", () => {
  it("anúncio da Meta com ids nas UTMs", () => {
    expect(
      atribuir({ utm_source: "FB", utm_campaign: "fase3|120200000000000001", utm_medium: "conj|120200000000000002", utm_content: "ad|120200000000000003" }),
    ).toEqual({
      campanha_id: "120200000000000001",
      conjunto_id: "120200000000000002",
      anuncio_id: "120200000000000003",
      categoria: "pago",
      origem: "Meta Ads",
    });
  });

  it("bio do Instagram é orgânico", () => {
    expect(atribuir({ utm_source: "ig", utm_medium: "bio" })).toMatchObject({ categoria: "organico", origem: "Bio Instagram orgânico" });
  });

  it("sem UTM fica não definido", () => {
    expect(atribuir({})).toMatchObject({ categoria: "nao-definido", origem: "Não definido" });
  });

  it("ctwaclid é Meta Ads via WhatsApp", () => {
    expect(atribuir({}, { ctwaclid: "abc" })).toMatchObject({ categoria: "pago", origem: "Meta Ads · WhatsApp" });
  });

  it("Google cpc é pago", () => {
    expect(atribuir({ utm_source: "google", utm_medium: "cpc" })).toMatchObject({ categoria: "pago", origem: "Google Ads" });
  });
});

describe("utilitários", () => {
  it("ids e nomes", () => {
    expect(extrairId("Campanha X|120212345678901234")).toBe("120212345678901234");
    expect(extrairId("Campanha X")).toBeNull();
    expect(nomeSemId("Campanha X|120212345678901234")).toBe("Campanha X");
  });

  it("telefone e UF", () => {
    expect(normalizarTelefone("+55 (11) 96191-6029")).toBe("11961916029");
    expect(normalizarTelefone("123")).toBeNull();
    expect(ufPorTelefone("(35) 99814-9821")).toBe("MG");
    expect(normalizarUf("Rio Grande do Sul")).toBe("RS");
    expect(normalizarUf("sp")).toBe("SP");
  });

  it("contexto por palavra-chave", () => {
    expect(contextoPorNome("LANC_BLACK_captacao", ["lanc_"])).toBe("lancamento");
    expect(contextoPorNome("fase3_perpetuo", ["lanc_"])).toBe("perpetuo");
  });
});
