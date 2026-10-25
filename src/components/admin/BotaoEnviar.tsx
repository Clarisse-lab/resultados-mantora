"use client";

import { useFormStatus } from "react-dom";

// Botão de formulário que mostra que está trabalhando e não aceita clique duplo.
export function BotaoEnviar({ children, pendente, className = "botao" }: { children: React.ReactNode; pendente: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button className={`${className} disabled:cursor-wait disabled:opacity-60`} disabled={pending} aria-busy={pending}>
      {pending ? pendente : children}
    </button>
  );
}
