"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function CopiarTexto({ texto }: { texto: string }) {
  const [ok, setOk] = useState(false);
  return (
    <div className="mt-2 flex items-center gap-2 rounded-lg border border-borda bg-superficie-2 px-3 py-2">
      <code className="num min-w-0 flex-1 truncate text-xs text-texto-2">{texto}</code>
      <button
        type="button"
        className="text-texto-3 hover:text-texto"
        aria-label="Copiar"
        onClick={async () => {
          await navigator.clipboard.writeText(texto);
          setOk(true);
          setTimeout(() => setOk(false), 1500);
        }}
      >
        {ok ? <Check size={14} className="text-sucesso" /> : <Copy size={14} />}
      </button>
    </div>
  );
}
