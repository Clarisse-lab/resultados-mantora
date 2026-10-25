import { NextResponse } from "next/server";
import { assinaturaValida, integracaoPorToken, processarWebhook } from "@/lib/integracoes/ingestao";

// URL que vai no painel da Hotmart / Kiwify / PagTrust: /api/webhooks/<token da integração>
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const i = await integracaoPorToken(token);
  if (!i || !i.ativo || !["hotmart", "kiwify", "pagtrust"].includes(i.tipo)) {
    return NextResponse.json({ erro: "integração não encontrada" }, { status: 404 });
  }
  const corpo = await req.text();
  if (!assinaturaValida(i, corpo, req.headers, new URL(req.url))) {
    return NextResponse.json({ erro: "assinatura inválida" }, { status: 401 });
  }
  let payload: unknown;
  try {
    payload = corpo.trim().startsWith("{") ? JSON.parse(corpo) : Object.fromEntries(new URLSearchParams(corpo));
  } catch {
    return NextResponse.json({ erro: "JSON inválido" }, { status: 400 });
  }
  try {
    const r = await processarWebhook(i, payload);
    return NextResponse.json({ ok: true, resultado: r.tipo });
  } catch {
    // 500 faz a plataforma tentar de novo; o evento cru já ficou salvo
    return NextResponse.json({ erro: "falha ao processar" }, { status: 500 });
  }
}
