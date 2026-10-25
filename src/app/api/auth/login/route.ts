import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { COOKIE_SESSAO, assinarSessao } from "@/lib/sessao-token";

// Limite simples por processo contra força bruta (suficiente para uma instância).
const tentativas = new Map<string, { n: number; ate: number }>();

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const t = tentativas.get(ip);
  if (t && t.ate > Date.now() && t.n >= 8) {
    return NextResponse.json({ erro: "Muitas tentativas. Aguarde um instante e tente de novo." }, { status: 429 });
  }
  const { email, senha } = (await req.json().catch(() => ({}))) as { email?: string; senha?: string };
  const [u] = email
    ? await sql<{ id: string; senha_hash: string; papel: "equipe" | "cliente"; ativo: boolean }[]>`
        select id, senha_hash, papel, ativo from usuarios where email = ${email.trim().toLowerCase()}`
    : [];
  if (!u || !u.ativo || !senha || !(await bcrypt.compare(senha, u.senha_hash))) {
    tentativas.set(ip, { n: (t && t.ate > Date.now() ? t.n : 0) + 1, ate: Date.now() + 10 * 60_000 });
    return NextResponse.json({ erro: "E-mail ou senha inválidos." }, { status: 401 });
  }
  tentativas.delete(ip);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_SESSAO, await assinarSessao({ uid: u.id, papel: u.papel, email: email!.trim().toLowerCase() }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
