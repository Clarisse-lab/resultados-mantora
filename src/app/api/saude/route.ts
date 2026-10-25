import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

// Diz se o banco responde e se as variáveis obrigatórias estão no formato certo,
// sem expor nenhum valor.
export async function GET() {
  await sql`select 1`;
  const env = process.env;
  return NextResponse.json({
    ok: true,
    config: {
      sessao: (env.SESSION_SECRET ?? "").length >= 32 && !env.SESSION_SECRET!.includes("${{"),
      cripto: /^[0-9a-f]{64}$/i.test(env.ENCRYPTION_KEY ?? ""),
      cron: (env.CRON_SECRET ?? "").length >= 24 && !env.CRON_SECRET!.includes("${{"),
    },
  });
}
