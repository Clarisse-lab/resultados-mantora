import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { integracaoPorToken } from "@/lib/integracoes/ingestao";
import { gravarLead } from "@/lib/integracoes/leads";

// Recebe leads de formulários de qualquer site, por isso libera CORS.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const i = await integracaoPorToken(token);
  if (!i || !i.ativo || i.tipo !== "captura_leads") {
    return NextResponse.json({ erro: "integração não encontrada" }, { status: 404, headers: CORS });
  }
  const tipo = req.headers.get("content-type") ?? "";
  const bruto = tipo.includes("application/json")
    ? ((await req.json().catch(() => ({}))) as Record<string, unknown>)
    : Object.fromEntries((await req.formData().catch(() => new FormData())).entries());
  try {
    const r = await gravarLead(i, bruto);
    return NextResponse.json({ ok: true, ...r }, { headers: CORS });
  } catch (e) {
    const msg = e instanceof ZodError ? "campos inválidos" : e instanceof Error ? e.message : "erro";
    return NextResponse.json({ erro: msg }, { status: 400, headers: CORS });
  }
}
