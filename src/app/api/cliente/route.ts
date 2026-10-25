import { NextResponse } from "next/server";
import { COOKIE_CLIENTE, podeVerCliente, sessaoAtual } from "@/lib/auth";

// Troca o cliente que está sendo visto (seletor na barra lateral).
export async function POST(req: Request) {
  const s = await sessaoAtual();
  const form = await req.formData();
  const id = String(form.get("cliente") ?? "");
  const volta = String(form.get("volta") ?? "/visao-geral");
  const res = NextResponse.redirect(new URL(volta.startsWith("/") && !volta.startsWith("//") ? volta : "/visao-geral", req.url), 303);
  if (s && (await podeVerCliente(s, id))) {
    res.cookies.set(COOKIE_CLIENTE, id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  }
  return res;
}
