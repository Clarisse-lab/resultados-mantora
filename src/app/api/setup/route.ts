import bcrypt from "bcryptjs";
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

// Cria o primeiro usuário da equipe. Só funciona enquanto não houver nenhum usuário
// e exige o SETUP_TOKEN (visível apenas nas variáveis do serviço no Railway).
export async function GET() {
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from usuarios`;
  return NextResponse.json({ disponivel: n === 0 && Boolean(process.env.SETUP_TOKEN) });
}

export async function POST(req: Request) {
  const esperado = process.env.SETUP_TOKEN ?? "";
  const { codigo, email, nome, senha } = (await req.json().catch(() => ({}))) as Record<string, string | undefined>;
  const a = Buffer.from(codigo ?? "");
  const b = Buffer.from(esperado);
  if (!esperado || a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ erro: "Código de configuração inválido." }, { status: 401 });
  }
  if (!email?.includes("@") || !senha || senha.length < 10) {
    return NextResponse.json({ erro: "Informe um e-mail válido e uma senha com pelo menos 10 caracteres." }, { status: 400 });
  }
  const hash = await bcrypt.hash(senha, 10);
  // Insere só se a tabela ainda estiver vazia (evita corrida entre dois envios)
  const r = await sql`
    insert into usuarios (email, nome, senha_hash, papel)
    select ${email.trim().toLowerCase()}, ${nome?.trim() || null}, ${hash}, 'equipe'
    where not exists (select 1 from usuarios)`;
  if (r.count === 0) return NextResponse.json({ erro: "A configuração inicial já foi feita." }, { status: 409 });
  return NextResponse.json({ ok: true });
}
