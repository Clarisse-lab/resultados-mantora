// Assinatura da sessão. Fica separado de auth.ts porque roda também no middleware (Edge).
import { SignJWT, jwtVerify } from "jose";

export const COOKIE_SESSAO = "sessao";
export type Sessao = { uid: string; papel: "equipe" | "cliente"; email: string };

function chave() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("SESSION_SECRET ausente ou curto demais");
  return new TextEncoder().encode(s);
}

export async function assinarSessao(s: Sessao) {
  return new SignJWT(s).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("30d").sign(chave());
}

export async function lerSessao(token?: string | null): Promise<Sessao | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, chave());
    return { uid: String(payload.uid), papel: payload.papel as Sessao["papel"], email: String(payload.email) };
  } catch {
    return null;
  }
}
