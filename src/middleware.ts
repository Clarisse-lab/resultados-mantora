import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESSAO, lerSessao } from "./lib/sessao-token";

// Rotas públicas: login e os endpoints que as plataformas chamam (protegidos por token próprio).
const PUBLICAS = [/^\/login/, /^\/api\/auth\//, /^\/api\/webhooks\//, /^\/api\/captura\//, /^\/api\/cron\//, /^\/api\/saude/];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLICAS.some((r) => r.test(pathname))) return NextResponse.next();
  const sessao = await lerSessao(req.cookies.get(COOKIE_SESSAO)?.value);
  if (sessao) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ erro: "não autenticado" }, { status: 401 });
  const url = new URL("/login", req.url);
  if (pathname !== "/") url.searchParams.set("volta", pathname + req.nextUrl.search);
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/((?!_next/|favicon|icon|.*\\.(?:png|svg|ico|webmanifest)$).*)"] };
