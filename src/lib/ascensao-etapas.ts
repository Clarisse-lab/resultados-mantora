// Separado de ascensao.ts para poder ser importado em componentes do navegador (sem o banco).
export type EtapaAscensao = "fila" | "contato" | "proposta" | "recomprou" | "sem_interesse";

export const ETAPAS_ASCENSAO: { chave: EtapaAscensao; rotulo: string }[] = [
  { chave: "contato", rotulo: "Em contato" },
  { chave: "proposta", rotulo: "Proposta enviada" },
  { chave: "recomprou", rotulo: "Recomprou" },
  { chave: "sem_interesse", rotulo: "Sem interesse" },
];
