"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Marca } from "@/components/Marca";

function Formulario() {
  const router = useRouter();
  const volta = useSearchParams().get("volta");
  const destino = volta && volta.startsWith("/") && !volta.startsWith("//") ? volta : "/";
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function entrar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    const dados = new FormData(e.currentTarget);
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: dados.get("email"), senha: dados.get("senha") }),
      });
      if (r.ok) {
        router.replace(destino);
        router.refresh();
        return;
      }
      setErro(((await r.json().catch(() => null)) as { erro?: string } | null)?.erro ?? "Não foi possível entrar.");
    } catch {
      setErro("Falha de conexão. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={entrar} className="flex flex-col gap-3">
      <input name="email" type="email" required autoComplete="email" placeholder="seu@email.com" aria-label="E-mail" className="controle h-11" />
      <input name="senha" type="password" required autoComplete="current-password" placeholder="Senha" aria-label="Senha" className="controle h-11" />
      {erro && <p className="text-sm text-perigo">{erro}</p>}
      <button type="submit" disabled={enviando} className="botao mt-1 h-11 justify-center disabled:opacity-60">
        {enviando ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}

export default function Login() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="cartao entrar w-full max-w-sm p-8">
        <div className="mb-7 flex justify-center">
          <Marca tamanho={34} />
        </div>
        <Suspense fallback={null}>
          <Formulario />
        </Suspense>
      </div>
    </main>
  );
}
