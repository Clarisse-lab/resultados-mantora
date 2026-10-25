import { NextResponse } from "next/server";

/**
 * Redireciona com caminho relativo. Atrás do proxy do Railway, req.url aponta para o
 * endereço interno (localhost:8080); um Location relativo faz o navegador ficar no domínio público.
 */
export function redirecionar(caminho: string) {
  const seguro = caminho.startsWith("/") && !caminho.startsWith("//") && !caminho.startsWith("/\\") ? caminho : "/";
  return new NextResponse(null, { status: 303, headers: { Location: seguro } });
}
