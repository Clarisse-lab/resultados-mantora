"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Recarrega os dados da página a cada poucos segundos enquanto houver sincronização em andamento.
export function AtualizarSozinho({ ativo, segundos = 8 }: { ativo: boolean; segundos?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!ativo) return;
    const t = setInterval(() => router.refresh(), segundos * 1000);
    return () => clearInterval(t);
  }, [ativo, segundos, router]);
  return null;
}
