"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Marca } from "@/components/Marca";

export default function Setup() {
  const [disponivel, setDisponivel] = useState<boolean | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState(false);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    fetch("/api/setup")
      .then((r) => r.json())
      .then((j) => setDisponivel(Boolean(j.disponivel)))
      .catch(() => setDisponivel(false));
  }, []);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    const f = new FormData(e.currentTarget);
    if (f.get("senha") !== f.get("senha2")) {
      setEnviando(false);
      return setErro("As senhas não conferem.");
    }
    const r = await fetch("/api/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(f)),
    });
    setEnviando(false);
    if (r.ok) setFeito(true);
    else setErro(((await r.json().catch(() => null)) as { erro?: string } | null)?.erro ?? "Não foi possível concluir.");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="cartao entrar w-full max-w-sm p-8">
        <div className="mb-6 flex justify-center">
          <Marca tamanho={34} />
        </div>
        {disponivel === null ? (
          <p className="text-center text-sm text-texto-3">Carregando…</p>
        ) : feito ? (
          <div className="text-center">
            <p className="font-semibold">Pronto! Usuário da equipe criado.</p>
            <Link href="/login" className="botao mt-5">Entrar</Link>
          </div>
        ) : !disponivel ? (
          <div className="text-center">
            <p className="text-sm text-texto-2">A configuração inicial já foi feita.</p>
            <Link href="/login" className="botao mt-5">Ir para o login</Link>
          </div>
        ) : (
          <form onSubmit={enviar} className="flex flex-col gap-3">
            <p className="mb-1 text-sm text-texto-2">Crie o primeiro acesso da equipe Mantora.</p>
            <input name="codigo" required placeholder="Código de configuração (SETUP_TOKEN)" className="controle h-11" autoComplete="off" />
            <input name="nome" placeholder="Seu nome" className="controle h-11" />
            <input name="email" type="email" required placeholder="seu@email.com" className="controle h-11" autoComplete="email" />
            <input name="senha" type="password" required minLength={10} placeholder="Senha (mín. 10 caracteres)" className="controle h-11" autoComplete="new-password" />
            <input name="senha2" type="password" required minLength={10} placeholder="Repita a senha" className="controle h-11" autoComplete="new-password" />
            {erro && <p className="text-sm text-perigo">{erro}</p>}
            <button className="botao mt-1 h-11 justify-center" disabled={enviando}>
              {enviando ? "Criando…" : "Criar acesso"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
