"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// Gavetas e avisos saem da árvore da página: a animação de entrada do <main> cria um
// contexto de empilhamento que deixaria a barra de filtros por cima deles.
export function Portal({ children }: { children: React.ReactNode }) {
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  return montado ? createPortal(children, document.body) : null;
}
