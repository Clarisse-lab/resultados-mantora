"use client";

import { useActionState } from "react";
import { salvarTokenMeta } from "../acoes";

export function FormToken({ temToken }: { temToken: boolean }) {
  const [estado, enviar, enviando] = useActionState(salvarTokenMeta, null);
  return (
    <form action={enviar} className="mt-4 space-y-3">
      <textarea
        name="token"
        required
        autoComplete="off"
        spellCheck={false}
        placeholder={temToken ? "Cole aqui um novo token para substituir o atual" : "Cole aqui o token (começa com EAA…)"}
        className="controle num h-24 w-full py-2 text-xs"
      />
      {estado?.erro && <p className="text-sm text-perigo">{estado.erro}</p>}
      {estado?.ok && <p className="text-sm text-sucesso">{estado.ok}</p>}
      <button className="botao" disabled={enviando}>
        {enviando ? "Validando na Meta…" : temToken ? "Substituir token" : "Salvar token"}
      </button>
    </form>
  );
}
