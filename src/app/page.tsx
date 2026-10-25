import { redirect } from "next/navigation";
import { clientesDoUsuario, exigirSessao } from "@/lib/auth";

// Equipe (ou quem vê vários clientes) começa pela lista de clientes; os demais, pela visão geral.
export default async function Inicio() {
  const sessao = await exigirSessao();
  const clientes = await clientesDoUsuario(sessao);
  redirect(sessao.papel === "equipe" || clientes.length > 1 ? "/clientes" : "/visao-geral");
}
