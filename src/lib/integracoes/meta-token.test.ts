import { afterEach, describe, expect, it, vi } from "vitest";
import { diasParaVencer, inspecionarToken, mensagemErro } from "./meta-token";

const resposta = (corpo: unknown, ok = true) => ({ ok, json: async () => corpo }) as Response;

describe("token da Meta", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("lê usuário, validade e permissões", async () => {
    const fetch = vi.fn(async (url: string) =>
      url.includes("/me?")
        ? resposta({ id: "10", name: "Equipe Mantora" })
        : resposta({ data: { expires_at: 1798000000, scopes: ["ads_read", "business_management"] } }),
    );
    vi.stubGlobal("fetch", fetch);
    const info = await inspecionarToken("EAAteste");
    expect(info).toEqual({ nome: "Equipe Mantora", usuarioId: "10", expiraEm: new Date(1798000000 * 1000).toISOString(), escopos: ["ads_read", "business_management"] });
  });

  it("token sem data de expiração (usuário do sistema)", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => (url.includes("/me?") ? resposta({ id: "1" }) : resposta({ data: { expires_at: 0, scopes: ["ads_read"] } }))));
    expect((await inspecionarToken("EAAx")).expiraEm).toBeNull();
  });

  it("token inválido vira mensagem clara", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => resposta({ error: { message: "Invalid OAuth access token", code: 190 } }, false)));
    await expect(inspecionarToken("x")).rejects.toThrow(/inválido ou expirado/);
  });

  it("mensagens e dias", () => {
    expect(mensagemErro({ code: 200, message: "x" })).toMatch(/permissão/);
    expect(diasParaVencer(null)).toBeNull();
    expect(diasParaVencer({ nome: null, usuarioId: null, escopos: [], salvoEm: "", expiraEm: new Date(Date.now() + 10.5 * 86400000).toISOString() })).toBe(10);
  });
});
