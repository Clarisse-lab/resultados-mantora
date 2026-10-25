import { clienteAtual, exigirSessao } from "@/lib/auth";
import { MenuLateral } from "@/components/MenuLateral";
import { ClientesProvider } from "@/components/ClientesContexto";

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const sessao = await exigirSessao();
  const { atual, todos } = await clienteAtual(sessao);
  return (
    <div className="flex min-h-screen">
      <MenuLateral email={sessao.email} equipe={sessao.papel === "equipe"} variosClientes={todos.length > 1} />
      <ClientesProvider valor={{ clientes: todos.map(({ id, nome }) => ({ id, nome })), atual: atual?.id ?? null }}>
        <div className="min-w-0 flex-1">{children}</div>
      </ClientesProvider>
    </div>
  );
}
