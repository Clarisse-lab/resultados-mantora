import { afterEach, describe, expect, it } from "vitest";
import { cifrar, decifrar } from "./cripto";

describe("cripto", () => {
  afterEach(() => {
    delete process.env.ENCRYPTION_KEY;
  });

  it("cifra e decifra com a chave", () => {
    process.env.ENCRYPTION_KEY = "11".repeat(32);
    const c = cifrar("EAAB-token-da-meta");
    expect(c.startsWith("enc:v1:")).toBe(true);
    expect(c).not.toContain("token");
    expect(decifrar(c)).toBe("EAAB-token-da-meta");
  });

  it("lê valores antigos em texto puro", () => {
    expect(decifrar("hottok-antigo")).toBe("hottok-antigo");
    expect(decifrar(null)).toBeNull();
  });

  it("falha com a chave errada", () => {
    process.env.ENCRYPTION_KEY = "11".repeat(32);
    const c = cifrar("segredo");
    process.env.ENCRYPTION_KEY = "22".repeat(32);
    expect(() => decifrar(c)).toThrow();
  });
});
