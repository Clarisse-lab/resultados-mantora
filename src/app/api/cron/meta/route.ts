import { NextResponse } from "next/server";
import { sincronizarTodas } from "@/lib/integracoes/meta-ads";

// Chamado de hora em hora pelo agendador (Railway cron): Authorization: Bearer <CRON_SECRET>
export async function POST(req: Request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo || req.headers.get("authorization") !== `Bearer ${segredo}`) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }
  const dias = Math.min(Number(new URL(req.url).searchParams.get("dias") ?? 3) || 3, 90);
  return NextResponse.json({ ok: true, contas: await sincronizarTodas(dias) });
}
